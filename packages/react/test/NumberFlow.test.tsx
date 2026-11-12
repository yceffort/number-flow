import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, describe, expect, it} from 'vitest'

import NumberFlow, {NumberFlowElement} from '../src/index'

// jsdom's ElementInternals only half-implements ARIAMixin:
NumberFlowElement.prototype.attachInternals = () => {
  throw new Error('unsupported')
}

const create = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createRoot(container)
}

describe('NumberFlow locales', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  // Regression: Intl.Locale instances have no own enumerable properties, so
  // JSON.stringify collapses every one of them to '{}' — every Intl.Locale
  // got the formatter cached for the first one:
  it('formats each Intl.Locale with its own formatter', () => {
    const root = create()
    act(() =>
      root.render(
        <>
          <NumberFlow value={1234.5} locales={new Intl.Locale('en-US')} />
          <NumberFlow value={1234.5} locales={new Intl.Locale('de-DE')} />
        </>,
      ),
    )
    const [en, de] = document.querySelectorAll('number-flow-yceffort-react')
    expect(en!.getAttribute('aria-label')).toBe('1,234.5')
    expect(de!.getAttribute('aria-label')).toBe('1.234,5')
  })

  // Regression: Intl.Locale instances have no own enumerable properties, so
  // JSON.stringify collapses every one of them to '{}' — switching locales
  // never rebuilt the formatter:
  it('rebuilds the formatter when an Intl.Locale locale changes', () => {
    const root = create()
    act(() =>
      root.render(
        <NumberFlow value={1234.5} locales={new Intl.Locale('en-US')} />,
      ),
    )
    const el = document.querySelector('number-flow-yceffort-react')!
    expect(el.getAttribute('aria-label')).toBe('1,234.5')

    act(() =>
      root.render(
        <NumberFlow value={1234.5} locales={new Intl.Locale('de-DE')} />,
      ),
    )
    expect(el.getAttribute('aria-label')).toBe('1.234,5')
  })
})
