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

const digits = (el: TestFlow) =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.digit'))
const symbols = (el: TestFlow) =>
  Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.symbol'))
const yOf = (digit: HTMLElement, n: number) =>
  (digit.children[n] as HTMLElement).style.getPropertyValue('--y')

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
})
