import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {
  animate,
  finishAll,
  finishedOf,
  digitYPercent,
  setEngineMode,
} from '../src/engine'
import {dxVar, opacityDeltaVar, deltaVar, widthDeltaVar} from '../src/styles'

const tx = (el: HTMLElement) => el.style.transform

describe('digitYPercent (JS port of the CSS mod()/round() formula)', () => {
  it('keeps the current number at 0 and neighbors at ±100%', () => {
    expect(digitYPercent(5, 10, 5)).toBe(0)
    expect(digitYPercent(5, 10, 6)).toBe(100)
    expect(digitYPercent(5, 10, 4)).toBe(-100)
    // Far numbers clamp to ±100%; offsets wrap into [-length/2, length/2):
    expect(digitYPercent(5, 10, 0)).toBe(-100)
    expect(digitYPercent(5, 10, 9)).toBe(100)
  })

  it('is periodic in the digit length', () => {
    for (let n = 0; n < 10; n++) {
      expect(digitYPercent(-2.3, 10, n)).toBeCloseTo(
        digitYPercent(7.7, 10, n),
        9,
      )
      expect(digitYPercent(3.14, 10, n)).toBeCloseTo(
        digitYPercent(13.14, 10, n),
        9,
      )
    }
  })

  it('interpolates fractional positions during a spin', () => {
    expect(digitYPercent(4.5, 10, 5)).toBe(50)
    expect(digitYPercent(4.5, 10, 4)).toBe(-50)
  })
})

describe('rAF engine', () => {
  let now = 0
  let frames: FrameRequestCallback[] = []
  const step = (ms: number) => {
    now += ms
    const cbs = frames
    frames = []
    cbs.forEach((cb) => cb(now))
  }

  beforeEach(() => {
    setEngineMode('raf')
    now = 0
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  })
  afterEach(() => {
    // Drain the loop: the engine takes a frame it requested as pending until
    // it runs, so a test ending mid-flight would leave the next one waiting
    // on a callback its reset has dropped:
    while (frames.length) step(1000)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setEngineMode('auto')
  })

  it('tweens transform and cleans up to an empty inline style', () => {
    const scope = {}
    const el = document.createElement('span')
    animate(
      scope,
      el,
      {transform: ['translateX(10px)', 'none']},
      {duration: 100, easing: 'linear'},
    )

    step(0) // first frame at t=0
    expect(el.style.transform).toBe('translateX(10px)')
    step(50)
    expect(el.style.transform).toBe('translateX(5px)')
    step(50)
    expect(el.style.transform).toBe('')
  })

  it('accumulates concurrent animations like composite: accumulate', () => {
    const scope = {}
    const el = document.createElement('span')
    animate(
      scope,
      el,
      {transform: ['translateX(10px)', 'none']},
      {duration: 100, easing: 'linear'},
    )
    step(0)
    step(50) // first anim at 5px remaining
    animate(
      scope,
      el,
      {transform: ['translateX(-4px)', 'none']},
      {duration: 100, easing: 'linear'},
    )
    step(0)
    expect(el.style.transform).toBe('translateX(1px)') // 5 + -4
    step(50) // anim1 done (0), anim2 halfway (-2)
    expect(el.style.transform).toBe('translateX(-2px)')
    step(50)
    expect(el.style.transform).toBe('')
  })

  it('writes custom properties for dx and resolved --scale-x for width deltas', () => {
    const scope = {}
    const el = document.createElement('span')
    el.style.setProperty('--width', '200')
    animate(
      scope,
      el,
      {[dxVar]: ['20px', '0px'], [widthDeltaVar]: [50, 0]},
      {duration: 100, easing: 'linear'},
    )
    step(0)
    expect(el.style.getPropertyValue(dxVar)).toBe('20px')
    expect(el.style.getPropertyValue('--scale-x')).toBe('1.25') // 1 + 50/200
    step(50)
    expect(el.style.getPropertyValue(dxVar)).toBe('10px')
    expect(el.style.getPropertyValue('--scale-x')).toBe('1.125')
    step(50)
    expect(el.style.getPropertyValue(dxVar)).toBe('0px')
    expect(el.style.getPropertyValue('--scale-x')).toBe('1')
  })

  it('composes opacity from the inline base var like the CSS calc()', () => {
    const scope = {}
    const el = document.createElement('span')
    // Pop out: base goes to -.999, delta animates 0.999 -> 0:
    el.style.setProperty(opacityDeltaVar, '-.999')
    animate(
      scope,
      el,
      {[opacityDeltaVar]: [0.999, 0]},
      {duration: 100, easing: 'linear'},
    )
    step(0)
    expect(parseFloat(el.style.opacity)).toBeCloseTo(1, 3)
    step(50)
    expect(parseFloat(el.style.opacity)).toBeCloseTo(0.5, 2)
    step(50)
    // Idle: falls back to the stylesheet (calc(1 + var(base)) = ~0):
    expect(el.style.opacity).toBe('')
  })

  it('spins digit children by writing --y', () => {
    const scope = {}
    const digit = document.createElement('span')
    digit.style.setProperty('--current', '7')
    for (let i = 0; i < 10; i++) {
      const num = document.createElement('span')
      num.style.setProperty('--n', String(i))
      digit.appendChild(num)
    }
    // Spin 3 -> 7: delta 4, animate -4 -> 0 on top of --current: 7
    animate(
      scope,
      digit,
      {[deltaVar]: [-4, 0]},
      {duration: 100, easing: 'linear'},
    )
    step(0) // c = 3
    expect(
      (digit.children[3] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('0%')
    expect(
      (digit.children[4] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('100%')
    step(50) // c = 5
    expect(
      (digit.children[5] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('0%')
    step(50) // c = 7, and the spin is over
    // Resting values stay inline at idle: without mod()/round() the
    // stylesheet can't compute --y, and the digit may still be exposing its
    // inert numerals until the flow-wide animationsfinish removes
    // is-spinning. NumberFlowLite removes them once the flow settles:
    expect(
      (digit.children[7] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('0%')
    expect(
      (digit.children[6] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('-100%')
    expect(
      (digit.children[8] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('100%')
  })

  // Regression: removing --y as soon as the digit's own spin settled left
  // `translateY(var(--y))` invalid-at-computed-value-time on rAF-path
  // browsers, stacking all ten numerals while is-spinning (removed on the
  // flow-wide animationsfinish) still exposed them — e.g. whenever
  // spinTiming is shorter than transformTiming, or a digit's delta is 0 in
  // an interrupting update:
  it('keeps resting --y while other channels are still animating', () => {
    const scope = {}
    const digit = document.createElement('span')
    digit.style.setProperty('--current', '7')
    for (let i = 0; i < 10; i++) {
      const num = document.createElement('span')
      num.style.setProperty('--n', String(i))
      digit.appendChild(num)
    }
    animate(
      scope,
      digit,
      {[deltaVar]: [-4, 0]},
      {duration: 100, easing: 'linear'},
    )
    animate(
      scope,
      digit,
      {transform: ['translateX(10px)', 'none']},
      {duration: 200, easing: 'linear'},
    )
    step(0)
    step(100) // the spin settles; the translate is still mid-flight
    expect(
      (digit.children[7] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('0%')
    expect(
      (digit.children[6] as HTMLElement).style.getPropertyValue('--y'),
    ).toBe('-100%')
    step(100)
    expect(digit.style.transform).toBe('')
  })

  it('supports finish-all and finished promises', async () => {
    const scope = {}
    const el = document.createElement('span')
    animate(
      scope,
      el,
      {transform: ['translateX(10px)', 'none']},
      {duration: 100, easing: 'linear'},
    )
    step(0)
    expect(finishedOf(scope)).toHaveLength(1)
    const all = Promise.all(finishedOf(scope))
    finishAll(scope)
    expect(el.style.transform).toBe('')
    await expect(all).resolves.toBeDefined()
    expect(finishedOf(scope)).toHaveLength(0)
  })

  // yceffort/number-flow#25: the fallback read only duration, delay and
  // easing, so the same timing object ran for a different time, in a
  // different direction and resolved `finished` at a different moment than
  // on the native path.
  describe('EffectTiming', () => {
    // A 10px translate, with its first frame at t=0:
    const start = (timing: EffectTiming) => {
      const scope = {}
      const el = document.createElement('span')
      animate(
        scope,
        el,
        {transform: ['translateX(10px)', 'none']},
        {easing: 'linear', ...timing},
      )
      step(0)
      return {scope, el}
    }

    it('repeats for `iterations`', () => {
      const {scope, el} = start({duration: 100, iterations: 2})
      step(50)
      expect(tx(el)).toBe('translateX(5px)')
      step(50) // the second iteration starts over
      expect(tx(el)).toBe('translateX(10px)')
      expect(finishedOf(scope)).toHaveLength(1)
      step(50)
      expect(tx(el)).toBe('translateX(5px)')
      step(50)
      expect(tx(el)).toBe('')
      expect(finishedOf(scope)).toHaveLength(0)
    })

    it('plays backwards with `direction: reverse`', () => {
      const {el} = start({duration: 100, direction: 'reverse'})
      expect(tx(el)).toBe('') // starts at the end value
      step(25)
      expect(tx(el)).toBe('translateX(2.5px)')
      step(75)
      expect(tx(el)).toBe('')
    })

    it('plays odd iterations backwards with `direction: alternate`', () => {
      const {el} = start({duration: 100, iterations: 2, direction: 'alternate'})
      step(125) // a quarter into the second iteration, reversed: 75%
      expect(tx(el)).toBe('translateX(2.5px)')
    })

    it('starts partway through with `iterationStart`', () => {
      const {scope, el} = start({duration: 100, iterationStart: 0.5})
      expect(tx(el)).toBe('translateX(5px)')
      step(50) // one whole iteration in: the next one starts over
      expect(tx(el)).toBe('translateX(10px)')
      step(50) // the active duration is still one iteration long
      expect(tx(el)).toBe('')
      expect(finishedOf(scope)).toHaveLength(0)
    })

    it('contributes nothing through the delay by default', () => {
      const {el} = start({duration: 100, delay: 100})
      expect(tx(el)).toBe('')
      step(50)
      expect(tx(el)).toBe('')
      step(100)
      expect(tx(el)).toBe('translateX(5px)')
    })

    it('holds the start value through the delay with `fill: backwards`', () => {
      const {el} = start({duration: 100, delay: 100, fill: 'backwards'})
      expect(tx(el)).toBe('translateX(10px)')
      step(50)
      expect(tx(el)).toBe('translateX(10px)')
      step(100)
      expect(tx(el)).toBe('translateX(5px)')
    })

    // A step easing on an exact boundary sits on the step below while the
    // before flag is set: in the before phase going forwards, and in the
    // after phase going backwards (what a fill shows):
    it('holds a step easing on the lower step through the delay', () => {
      const {el} = start({
        duration: 100,
        delay: 100,
        iterationStart: 0.5,
        fill: 'backwards',
        easing: 'steps(4, start)',
      })
      expect(tx(el)).toBe('translateX(5px)') // step 2 of 4, not 3
      step(100) // active: the flag is off
      expect(tx(el)).toBe('translateX(2.5px)')
    })

    it('keeps a reversed step easing on the lower step after the end', () => {
      const {el} = start({
        duration: 100,
        direction: 'reverse',
        iterationStart: 0.5,
        fill: 'forwards',
        easing: 'steps(4, start)',
      })
      step(100)
      expect(tx(el)).toBe('translateX(5px)') // step 2 of 4, not 3
    })

    it('keeps the end value with `fill: forwards` without ticking on', () => {
      const {scope, el} = start({
        duration: 100,
        direction: 'reverse',
        fill: 'forwards',
      })
      step(100)
      expect(tx(el)).toBe('translateX(10px)')
      expect(finishedOf(scope)).toHaveLength(0)
      // The frame already scheduled finds nothing running and schedules no more:
      step(16)
      expect(tx(el)).toBe('translateX(10px)')
      expect(frames).toHaveLength(0)
    })

    it('resolves `finished` only after `endDelay`', () => {
      const {scope, el} = start({duration: 100, endDelay: 100})
      step(100)
      expect(tx(el)).toBe('')
      expect(finishedOf(scope)).toHaveLength(1)
      step(100)
      expect(finishedOf(scope)).toHaveLength(0)
    })
  })
})
