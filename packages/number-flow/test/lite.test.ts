import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {setEngineMode} from '../src/engine'
import {formatToData} from '../src/formatter'
import NumberFlowLite, {canAnimate} from '../src/lite'

// jsdom's ElementInternals only half-implements ARIAMixin, so take the
// attribute fallback — which is also the path old browsers use:
class TestFlow extends NumberFlowLite {
  override attachInternals(): never {
    throw new Error('unsupported')
  }
}

let defined = 0
const create = () => {
  const name = `nf-test-${defined++}`
  customElements.define(name, class extends TestFlow {})
  const el = document.createElement(name) as TestFlow
  document.body.appendChild(el)
  return el
}

const fmt = new Intl.NumberFormat('en-US')
const set = (el: TestFlow, value: number) => {
  el.data = formatToData(value, fmt)
}
// Prefix and suffix included, like the #17 setup:
const pct = new Intl.NumberFormat('en-US', {
  style: 'percent',
  signDisplay: 'always',
  maximumFractionDigits: 0,
})

const digits = (el: TestFlow) =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.digit'))
const symbols = (el: TestFlow) =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.symbol'))
const yOf = (digit: HTMLElement, n: number) =>
  (digit.children[n] as HTMLElement).style.getPropertyValue('--y')

type LayoutGetter = (el: HTMLElement, original: () => unknown) => unknown

// Popped chars are absolutely positioned, i.e. out of the flow:
const inFlow = (c: Element) => !c.hasAttribute('inert')

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// Replaces HTMLElement layout getters (offsetWidth etc.) while fn() runs:
const withLayout = (getters: Record<string, LayoutGetter>, fn: () => void) => {
  const saved = Object.entries(getters).map(([prop, get]) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      prop,
    )!
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get() {
        return get(this, () => descriptor.get!.call(this))
      },
    })
    return [prop, descriptor] as const
  })
  try {
    fn()
  } finally {
    saved.forEach(([prop, descriptor]) =>
      Object.defineProperty(HTMLElement.prototype, prop, descriptor),
    )
  }
}

// Counts the layouts a browser would be forced to run during fn(): every
// layout read that follows a DOM write since the previous read. jsdom does no
// layout, so the writes are observed through MutationObserver's synchronous
// takeRecords() instead (yceffort/number-flow#17):
const forcedLayouts = (el: TestFlow, fn: () => void) => {
  const observer = new MutationObserver(() => {})
  observer.observe(el, {attributes: true})
  observer.observe(el.shadowRoot!, {
    subtree: true,
    childList: true,
    attributes: true,
  })
  let forced = 0
  const read = () => {
    if (observer.takeRecords().length) forced++
  }

  const rect = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      read()
      return rect.call(this)
    },
  )
  // Resolving a computed value also flushes pending style changes (it may be
  // a spy from the native suite, so wrap by assignment, not vi.spyOn):
  const computed = window.getComputedStyle
  window.getComputedStyle = (...args) => {
    read()
    return computed.apply(window, args)
  }
  const counting: LayoutGetter = (_el, original) => {
    read()
    return original()
  }

  observer.takeRecords() // writes before fn() aren't its fault
  try {
    withLayout(
      {
        offsetWidth: counting,
        offsetHeight: counting,
        offsetTop: counting,
        offsetLeft: counting,
      },
      fn,
    )
  } finally {
    window.getComputedStyle = computed
    observer.disconnect()
  }
  return forced
}

describe('NumberFlowLite (rAF engine)', () => {
  let now = 0
  let frames: FrameRequestCallback[] = []
  const step = (ms: number) => {
    now += ms
    const cbs = frames
    frames = []
    cbs.forEach((cb) => cb(now))
  }
  // animationsfinish is dispatched from a Promise.all continuation, and
  // exiting children are only removed from the DOM once it fires:
  const settle = async (ms = 2000) => {
    step(0)
    step(ms)
    await new Promise((resolve) => setTimeout(resolve, 0))
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
    // jsdom does no layout, so visible() would always be false:
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 10,
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 10,
    })
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setEngineMode('auto')
  })

  it('can animate in this environment', () => {
    // Guards the rest of the suite: if rAF were missing, computedAnimated
    // would be false everywhere and every assertion below would pass vacuously
    expect(canAnimate).toBe(true)
  })

  it('renders the value and exposes it to assistive tech', () => {
    const el = create()
    set(el, 12345.6)

    // Each .digit holds all ten numbers, so assert on structure + the label
    // rather than textContent:
    expect(digits(el)).toHaveLength(6) // 12345 + the 6 after the decimal point
    expect(symbols(el).map((s) => s.textContent)).toEqual([',', '.'])
    expect(el.getAttribute('role')).toBe('img')
    expect(el.getAttribute('aria-label')).toBe('12,345.6')
  })

  it('spins a digit and settles with no inline --y left behind', async () => {
    const el = create()
    set(el, 3)
    set(el, 7)
    expect(el.computedAnimated).toBe(true)

    const digit = digits(el)[0]!
    step(0)
    expect(yOf(digit, 3)).toBe('0%') // starts where it was
    // The numerals stay pinned inline until the whole flow settles, then
    // animationsfinish hands them back to the stylesheet:
    await settle()
    expect(digit.style.getPropertyValue('--current')).toBe('7')
    expect(digit.classList.contains('is-spinning')).toBe(false)
    expect(yOf(digit, 7)).toBe('')
  })

  // Regression: an inline --y outranks the stylesheet formula forever, so a
  // later update that can't animate used to render the active number a full
  // digit-height off — i.e. the digit looked blank.
  it.each([
    ['animated=false', (el: TestFlow) => (el.animated = false)],
    [
      'hidden document',
      () =>
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'),
    ],
    [
      'invisible element',
      () =>
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
          configurable: true,
          get: () => 0,
        }),
    ],
  ])(
    'leaves no stale --y for a non-animated update (%s)',
    async (_name, disable) => {
      const el = create()
      set(el, 3)
      set(el, 7)
      await settle()

      const digit = digits(el)[0]!
      disable(el)
      set(el, 6)

      expect(el.computedAnimated).toBe(false)
      expect(digit.style.getPropertyValue('--current')).toBe('6')
      expect(yOf(digit, 6)).toBe('')
    },
  )

  // Regression: a non-animated update landing mid-spin used to leave the old
  // tween running, deriving --y from the NEW --current plus the stale delta
  // remainder — rendering the wrong numeral until the tween expired:
  it('finishes in-flight tweens when an update lands with animations off', async () => {
    const el = create()
    set(el, 3)
    set(el, 7)
    step(0)
    step(450) // mid-spin

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    set(el, 6)
    // Finishing the tweens resolves animationsfinish on a microtask:
    await new Promise((resolve) => setTimeout(resolve, 0))

    const digit = digits(el)[0]!
    expect(digit.style.getPropertyValue('--current')).toBe('6')
    expect(digit.classList.contains('is-spinning')).toBe(false)
    expect(yOf(digit, 6)).toBe('')
    // And no orphaned tween keeps ticking:
    step(2000)
    expect(yOf(digit, 6)).toBe('')
  })

  it('keeps digits and symbols in sync as the number grows and shrinks', async () => {
    const el = create()
    set(el, 1)
    expect(digits(el)).toHaveLength(1)

    set(el, 1234)
    await settle()
    // Three digits are added and a group separator appears:
    expect(digits(el)).toHaveLength(4)
    expect(symbols(el).map((s) => s.textContent)).toEqual([','])
    expect(el.getAttribute('aria-label')).toBe('1,234')

    set(el, 5)
    await settle()
    // Removed children are popped, then dropped on animationsfinish:
    expect(digits(el)).toHaveLength(1)
    expect(symbols(el)).toHaveLength(0)
    expect(el.getAttribute('aria-label')).toBe('5')
  })

  it('ignores an identity-equal re-set instead of re-measuring', () => {
    const el = create()
    set(el, 1)
    const data = formatToData(2, fmt)
    el.data = data

    const willUpdate = vi.spyOn(el, 'willUpdate')
    el.data = data
    expect(willUpdate).not.toHaveBeenCalled()
  })

  // Regression for yceffort/number-flow#17: reads and writes used to
  // interleave per section and per digit, forcing a layout for each.
  it.each([
    {
      name: 'same length', // +123,456,789% -> +987,654,321%
      from: formatToData(1234567.89, pct),
      to: formatToData(9876543.21, pct),
      max: 1,
    },
    {
      name: 'grows', // one more, to measure where the added chars start
      from: formatToData(0.05, pct),
      to: formatToData(1234567.89, pct),
      max: 2,
    },
    {
      name: 'shrinks', // one more, to measure where the dropped digits settle
      from: formatToData(1234567.89, pct),
      to: formatToData(0.05, pct),
      max: 2,
    },
    {
      name: 'drops symbols', // they stay where they were: nothing to measure
      from: formatToData(0.05, pct), // +5%
      to: formatToData(5, fmt),
      max: 1,
    },
  ])(
    'forces at most $max layouts per update ($name)',
    async ({from, to, max}) => {
      const el = create()
      el.data = from
      await settle()

      const forced = forcedLayouts(el, () => {
        el.data = to
      })
      expect(forced).toBeLessThanOrEqual(max)
    },
  )

  // Dropped digits fade out pinned where they'd sit once the kept digits have
  // their new values, so in a proportional font they travel with neighbours
  // whose width changes instead of being overlapped by them:
  it('pins dropped digits where they sit in the updated layout', async () => {
    const el = create()
    set(el, 1111)
    await settle()

    // Fake a proportional layout: a "1" is 10px wide, any other char 20px,
    // and a section's in-flow chars sit left to right from 0:
    const widthOf = (c: HTMLElement): number =>
      c.classList.contains('section')
        ? Array.from(c.children)
            .filter(inFlow)
            .reduce((w, s) => w + widthOf(s as HTMLElement), 0)
        : c.style.getPropertyValue('--current') === '1'
          ? 10
          : 20
    const leftOf = (c: HTMLElement) => {
      let left = 0
      for (let s = c.previousElementSibling; s; s = s.previousElementSibling)
        if (inFlow(s)) left += widthOf(s as HTMLElement)
      return left
    }
    withLayout(
      {
        offsetWidth: widthOf,
        offsetLeft: leftOf,
        offsetParent: (c) => c.parentElement,
      },
      () => set(el, 222),
    )

    // 1,111 -> 222 drops the "1" and the ",", and the kept digits widen from
    // 10px to 20px each. Measured in the updated layout (with the dropped "1"
    // already spun to 0) the section is 20 + 20 + 3 * 20 = 100px wide:
    const [one] = digits(el)
    const [comma] = symbols(el)
    expect(one!.style.right).toBe('80px') // 100 - 20 - 0
    expect(comma!.style.right).toBe('60px') // 100 - 20 - 20
  })
})

describe('NumberFlowLite (native engine)', () => {
  // jsdom has no Web Animations; stand in just enough for the compositor
  // path, with `finished` resolving on finish():
  type Fake = {
    el: HTMLElement
    startTime: number | null
    playState: string
    currentTime: number
    finished: Promise<void>
    finish: () => void
  }
  let now = 0
  let anims: Fake[] = []

  beforeEach(() => {
    setEngineMode('native')
    now = 1000
    anims = []
    vi.stubGlobal('requestAnimationFrame', () => 0) // canAnimate
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      get: () => ({currentTime: now}),
    })
    HTMLElement.prototype.animate = function (this: HTMLElement) {
      let resolve!: () => void
      const a: Fake = {
        el: this,
        startTime: null,
        playState: 'running',
        get currentTime() {
          return this.startTime == null ? 0 : now - this.startTime
        },
        finished: new Promise<void>((r) => (resolve = r)),
        finish() {
          this.playState = 'finished'
          resolve()
        },
      }
      anims.push(a)
      return a as unknown as Animation
    }
    ShadowRoot.prototype.getAnimations = function (this: ShadowRoot) {
      return anims.filter(
        (a) => a.playState !== 'finished' && this.contains(a.el),
      ) as unknown as Animation[]
    }
    // jsdom computes no transforms; the stylesheet's resting values:
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el) =>
        ({
          transform: (el as HTMLElement).classList.contains('number')
            ? 'matrix(1, 0, 0, 1, 0, 0)'
            : 'none',
          opacity: '1',
        }) as CSSStyleDeclaration,
    )
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 10,
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 10,
    })
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setEngineMode('auto')
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    delete (ShadowRoot.prototype as Partial<ShadowRoot>).getAnimations
  })

  // flush() used to read computed styles and the spin height after the
  // commits had written `is-spinning` and `--width`, forcing another style
  // update, and getAnimations() right after it forced one more:
  it('forces at most 1 layout per same-length update', () => {
    const el = create()
    el.data = formatToData(1234567.89, pct)
    // The first animated update still reads in flush(): the engine only
    // learns which channels to prepare() from it.
    el.data = formatToData(9876543.21, pct)
    anims.forEach((a) => a.finish())

    const forced = forcedLayouts(el, () => {
      el.data = formatToData(1234567.89, pct)
    })
    expect(forced).toBeLessThanOrEqual(1)
  })

  it('fires animationsfinish from the animations it started, without getAnimations()', async () => {
    const el = create()
    set(el, 3)
    anims.forEach((a) => a.finish())
    const getAnimations = vi.spyOn(ShadowRoot.prototype, 'getAnimations')
    const finished = vi.fn()
    el.addEventListener('animationsfinish', finished)

    set(el, 7)
    expect(getAnimations).not.toHaveBeenCalled()
    const started = anims.filter((a) => a.playState === 'running')
    expect(started.length).toBeGreaterThan(0)
    await tick()
    expect(finished).not.toHaveBeenCalled()

    started.forEach((a) => a.finish())
    await tick()
    expect(finished).toHaveBeenCalledTimes(1)
  })
})
