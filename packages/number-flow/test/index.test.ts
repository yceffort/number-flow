import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import NumberFlow from '../src/index'

class TestFlow extends NumberFlow {
  // jsdom's ElementInternals only half-implements ARIAMixin:
  override attachInternals(): never {
    throw new Error('unsupported')
  }
}
customElements.define('nf-index-test', TestFlow)

describe('NumberFlow.update', () => {
  const NativeNumberFormat = Intl.NumberFormat
  let constructed: number

  beforeEach(() => {
    constructed = 0
    vi.spyOn(Intl, 'NumberFormat').mockImplementation((...args) => {
      constructed++
      return new NativeNumberFormat(...args)
    })
  })
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  const create = () => {
    const el = document.createElement('nf-index-test') as TestFlow
    document.body.appendChild(el)
    return el
  }

  // Constructing an Intl.NumberFormat is far more expensive than serializing
  // the options, and callers routinely pass a fresh object literal each time:
  it('reuses the formatter across equal-but-not-identical format options', () => {
    const el = create()
    el.locales = 'en-US'
    for (let i = 0; i < 5; i++) {
      el.format = {maximumFractionDigits: 1}
      el.update(i)
    }
    expect(constructed).toBe(1)
    expect(el.getAttribute('aria-label')).toBe('4')
  })

  it('rebuilds the formatter when the options actually change', () => {
    const el = create()
    el.format = {maximumFractionDigits: 1}
    el.update(1.25)
    expect(el.getAttribute('aria-label')).toBe('1.3')

    el.format = {maximumFractionDigits: 3}
    el.update(1.25)
    expect(constructed).toBe(2)
    expect(el.getAttribute('aria-label')).toBe('1.25')
  })

  it('rebuilds the formatter when only the locales change', () => {
    const el = create()
    el.locales = 'en-US'
    el.update(1234.5)
    expect(el.getAttribute('aria-label')).toBe('1,234.5')

    el.locales = 'de-DE'
    el.update(1234.5)
    expect(constructed).toBe(2)
    expect(el.getAttribute('aria-label')).toBe('1.234,5')
  })

  it('keeps the last value when update() is called with none', () => {
    const el = create()
    el.update(42)
    el.update()
    expect(el.value).toBe(42)
    expect(el.getAttribute('aria-label')).toBe('42')
  })
})
