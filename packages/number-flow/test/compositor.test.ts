import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {animate, digitYPercent, flush, setEngineMode} from '../src/engine'
import {parseEasing} from '../src/engine/easing'
import {deltaVar, dxVar, opacityDeltaVar, widthDeltaVar} from '../src/styles'

// jsdom has no Web Animations, so stand one in that records every animation
// and evaluates keyframe effects the way the spec does: the effect easing
// turns time into progress, then keyframes are interpolated around it.
type Fake = {
  el: HTMLElement
  keyframes: Keyframe[] | PropertyIndexedKeyframes
  timing: KeyframeAnimationOptions
  startTime: number | null
  playState: string
  currentTime: number | null
  finished: Promise<void>
  finish: () => void
}

let now = 0
let anims: Fake[] = []
const SPRING = `linear(0,.005,.019,.039,.066,.096,.129,.165,.202,.24,.278,.316,.354,.39,.426,.461,.494,.526,.557,.586,.614,.64,.665,.689,.711,.731,.751,.769,.786,.802,.817,.831,.844,.856,.867,.877,.887,.896,.904,.912,.919,.925,.931,.937,.942,.947,.951,.955,.959,.962,.965,.968,.971,.973,.976,.978,.98,.981,.983,.984,.986,.987,.988,.989,.99,.991,.992,.992,.993,.994,.994,.995,.995,.996,.996,.9963,.9967,.9969,.9972,.9975,.9977,.9979,.9981,.9982,.9984,.9985,.9987,.9988,.9989,1)`

const nums = (s: unknown) =>
  String(s)
    .match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)!
    .map(Number)

// All numbers in a property's value at time t (null outside the active phase):
const valueOf = (a: Fake, prop: string, t = now): number[] | null => {
  const {duration = 0, delay = 0, easing} = a.timing
  const local = t - a.startTime! - delay
  if (local < 0 || local >= (duration as number)) return null
  const p = parseEasing(easing)(local / (duration as number))
  const frames = Array.isArray(a.keyframes)
    ? a.keyframes.map((k) => ({offset: k.offset!, v: nums(k[prop])}))
    : (a.keyframes[prop] as unknown[]).map((v, i, all) => ({
        offset: i / (all.length - 1),
        v: nums(v),
      }))
  let i = 0
  while (i < frames.length - 2 && frames[i + 1]!.offset <= p) i++
  const [f0, f1] = [frames[i]!, frames[i + 1]!]
  const f =
    f1.offset === f0.offset ? 1 : (p - f0.offset) / (f1.offset - f0.offset)
  return f0.v.map((v, k) => v + (f1.v[k]! - v) * f)
}
const of = (el: Element) =>
  anims.filter((a) => a.el === el && a.playState !== 'finished')

describe('compositor path', () => {
  beforeEach(() => {
    setEngineMode('native')
    now = 1000
    anims = []
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      get: () => ({currentTime: now}),
    })
    HTMLElement.prototype.animate = function (
      this: HTMLElement,
      keyframes: Keyframe[] | PropertyIndexedKeyframes,
      timing: KeyframeAnimationOptions,
    ) {
      const a: Fake = {
        el: this,
        keyframes,
        timing,
        startTime: null,
        playState: 'running',
        get currentTime() {
          return this.startTime == null ? 0 : now - this.startTime
        },
        finished: Promise.resolve(),
        finish() {
          this.playState = 'finished'
        },
      }
      anims.push(a)
      return a as unknown as Animation
    }
    // jsdom computes no transforms; the stylesheet's resting values:
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) =>
        ({
          transform: (el as HTMLElement).classList.contains('number')
            ? 'matrix(1, 0, 0, 1, 0, 0)'
            : 'none',
          opacity: String(
            Math.min(
              1,
              1 +
                (parseFloat(
                  (el as HTMLElement).style.getPropertyValue(opacityDeltaVar),
                ) || 0),
            ),
          ),
        }) as CSSStyleDeclaration,
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setEngineMode('auto')
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
  })

  it('keeps a lone animation as-is, with its own easing, on replace', () => {
    const scope = {}
    const el = document.createElement('span')
    const timing = {duration: 900, easing: 'cubic-bezier(0.33, 1, 0.68, 1)'}
    animate(scope, el, {transform: ['translateX(10px)', 'none']}, timing)
    expect(anims).toHaveLength(0) // committed by flush()
    flush(scope)

    const [a] = of(el)
    expect(a!.timing).toMatchObject(timing)
    expect(a!.timing).not.toHaveProperty('composite')
    expect(a!.startTime).toBe(1000)
    expect(valueOf(a!, 'transform')).toEqual([10])
    now += 450
    const p = parseEasing(timing.easing)(0.5)
    expect(valueOf(a!, 'transform')![0]).toBeCloseTo(10 * (1 - p), 9)
  })

  it('re-bakes an interrupted stack into what accumulate would show', () => {
    const scope = {}
    const el = document.createElement('span')
    const first = {duration: 900, easing: SPRING}
    const second = {duration: 600, easing: 'ease-in-out'}
    animate(scope, el, {transform: ['translateX(30px)', 'none']}, first)
    flush(scope)
    now += 250
    animate(scope, el, {transform: ['translateX(-12px)', 'none']}, second)
    flush(scope)

    const [a] = of(el)
    const accumulated = (t: number) =>
      30 * (1 - parseEasing(SPRING)((250 + t) / 900)) +
      -12 * (1 - parseEasing('ease-in-out')(t / 600))
    for (let t = 0; t < 650; t += 7) {
      expect(
        Math.abs(valueOf(a!, 'transform', 1250 + t)![0]! - accumulated(t)),
      ).toBeLessThan(0.01)
    }
    // Ends with the longest remaining contribution:
    expect(a!.timing.duration).toBe(650)
  })

  it('spins only the numerals that come into view, along the mod() math', () => {
    const scope = {}
    const digit = document.createElement('span')
    digit.style.setProperty('--current', '7')
    for (let i = 0; i < 10; i++) {
      const num = digit.appendChild(document.createElement('span'))
      if (i !== 7) num.setAttribute('inert', '')
    }
    // 3 -> 7, then interrupted back down to 5 (current: 5):
    animate(
      scope,
      digit,
      {[deltaVar]: [-4, 0]},
      {duration: 900, easing: SPRING},
    )
    flush(scope)
    now += 200
    digit.style.setProperty('--current', '5')
    ;(digit.children[7] as HTMLElement).setAttribute('inert', '')
    ;(digit.children[5] as HTMLElement).removeAttribute('inert')
    animate(scope, digit, {[deltaVar]: [2, 0]}, {duration: 900, easing: SPRING})
    flush(scope)

    const c = (t: number) =>
      5 +
      -4 * (1 - parseEasing(SPRING)((200 + t) / 900)) +
      2 * (1 - parseEasing(SPRING)(t / 900))
    const animated = new Set<number>()
    const seen = new Set<number>()
    for (let n = 0; n < 10; n++) {
      const num = digit.children[n]!
      const [a] = of(num)
      if (a) animated.add(n)
      for (let t = 0; t < 1100; t += 9) {
        const expected = digitYPercent(c(t), 10, n)
        if (Math.abs(expected) < 100) seen.add(n)
        // Outside its animation a numeral shows the stylesheet's resting value:
        const actual = (a && valueOf(a, 'transform', 1200 + t)) || [
          digitYPercent(5, 10, n),
        ]
        // Numerals at ±100% sit fully outside the mask, and only ever
        // wrap around there:
        if (Math.abs(expected) === 100 && Math.abs(actual.at(-1)!) === 100)
          continue
        expect(
          Math.abs(actual.at(-1)! - expected),
          `numeral ${n} at ${t}ms`,
        ).toBeLessThan(0.01)
        // translateX(-50%) first when inert:
        if (a && n !== 5 && actual.length > 1) expect(actual[0]).toBe(-50)
      }
    }
    // Exactly the numerals that ever come within 1 of c:
    expect([...animated].toSorted((a, b) => a - b)).toEqual(
      [...seen].toSorted((a, b) => a - b),
    )
  })

  it('clamps opacity like calc(1 + var(--d-opacity)) over the inline base', () => {
    const scope = {}
    const el = document.createElement('span')
    const timing = {duration: 450, easing: 'ease-out'}
    // Exit, then re-enter while still fading out:
    el.style.setProperty(opacityDeltaVar, '-.999')
    animate(scope, el, {[opacityDeltaVar]: [0.999, 0]}, timing)
    flush(scope)
    now += 100
    el.style.setProperty(opacityDeltaVar, '0')
    animate(scope, el, {[opacityDeltaVar]: [-0.9999, 0]}, timing)
    flush(scope)

    const [a] = of(el)
    const ease = parseEasing('ease-out')
    for (let t = 0; t < 450; t += 5) {
      const expected = Math.min(
        1,
        Math.max(
          0,
          1 +
            0.999 * (1 - ease((100 + t) / 450)) -
            0.9999 * (1 - ease(t / 450)),
        ),
      )
      expect(
        Math.abs(valueOf(a!, 'opacity', 1100 + t)![0]! - expected),
      ).toBeLessThan(0.0002)
    }
  })

  it('moves .number and counter-moves its inner span, keeping the mask exact', () => {
    const scope = {}
    const el = document.createElement('span')
    el.className = 'number'
    const inner = el.appendChild(document.createElement('span'))
    el.style.setProperty('--width', '200')
    const timing = {duration: 900, easing: SPRING}
    animate(
      scope,
      el,
      {[dxVar]: ['20px', '0px'], [widthDeltaVar]: [50, 0]},
      timing,
    )
    flush(scope)

    const [outer, mask] = of(el)
    const [counter] = of(inner)
    for (let t = 0; t < 900; t += 11) {
      const [dx, sx] = valueOf(outer!, 'transform', 1000 + t)!
      const [isx, idx] = valueOf(counter!, 'transform', 1000 + t)!
      // Any point x of the content stays put: sx * (isx * (x + idx)) + dx
      // (each value holds 0.01px, so a point is off by at most twice that):
      for (const x of [0, 100, 200])
        expect(Math.abs(sx! * isx! * (x + idx!) + dx! - x)).toBeLessThan(0.02)
      // The width delta keeps reaching the stylesheet's mask for as long as
      // a mask at rest would be an 8-bit alpha step off:
      const dW = valueOf(mask!, widthDeltaVar, 1000 + t)
      if (dW) expect(dW[0]).toBeCloseTo((sx! - 1) * 200, 1)
      else expect(Math.abs(1 - 1 / sx!)).toBeLessThanOrEqual(1 / 512)
    }

    // No width change, no main-thread mask animation:
    now += 2000
    animate(
      scope,
      el,
      {[dxVar]: ['5px', '0px'], [widthDeltaVar]: [0, 0]},
      timing,
    )
    flush(scope)
    expect(of(el)).toHaveLength(1)
  })

  it('falls back to accumulate, and hands a live stack back to it, for timings it cannot reproduce', () => {
    const scope = {}
    const el = document.createElement('span')
    animate(
      scope,
      el,
      {transform: ['translateX(30px)', 'none']},
      {duration: 900, easing: SPRING},
    )
    flush(scope)
    now += 300
    animate(
      scope,
      el,
      {transform: ['translateX(-8px)', 'none']},
      {duration: 600, easing: 'steps(4)'},
    )
    flush(scope)

    const live = of(el)
    expect(live.map((a) => a.timing.composite)).toEqual([
      'accumulate',
      'accumulate',
    ])
    // The first one picks up where it was, started back when it did:
    expect(live[0]!.startTime).toBe(1000)
    expect(live[0]!.keyframes).toEqual({
      transform: ['translateX(30px)', 'none'],
    })
    expect(live[1]!.timing.easing).toBe('steps(4)')
  })

  it('leaves targets whose author styles it would override on accumulate', () => {
    const scope = {}
    const el = document.createElement('span')
    vi.mocked(window.getComputedStyle).mockReturnValue({
      transform: 'matrix(1, 0, 0, 1, 0, -3)',
    } as CSSStyleDeclaration)
    animate(
      scope,
      el,
      {transform: ['translateX(10px)', 'none']},
      {duration: 900},
    )
    flush(scope)
    expect(of(el)[0]!.timing.composite).toBe('accumulate')
  })
})
