import {describe, expect, it} from 'vitest'

import {formatToData} from '../src/formatter'
import {renderFallbackStyles, renderInnerHTML} from '../src/ssr'

const fmt = new Intl.NumberFormat('en-US')
const render = (value: number, prefix?: string, suffix?: string) =>
  renderInnerHTML(formatToData(value, fmt, prefix, suffix))

describe('renderInnerHTML', () => {
  it('renders the value in both the shadow template and the fallback span', () => {
    const html = render(1234.5)
    expect(html).toContain('aria-label="1,234.5"')
    expect(html).toContain('<span>1,234.5</span>')
    expect(html).toContain('shadowrootmode="open"')
  })

  // This string is injected verbatim by framework wrappers (React's
  // dangerouslySetInnerHTML), and prefix/suffix routinely carry caller data:
  it('escapes a prefix that tries to inject markup', () => {
    const html = render(1, '<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('escapes a suffix that tries to break out of the aria-label', () => {
    const html = render(1, undefined, '"><script>alert(1)</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('escapes the nonce instead of letting it close the attribute', () => {
    const html = renderInnerHTML(formatToData(1, fmt), {
      nonce: 'abc"><script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('nonce="abc&quot;&gt;&lt;script&gt;')
  })

  it('leaves a well-formed nonce alone', () => {
    const html = renderInnerHTML(formatToData(1, fmt), {
      nonce: 'r4nd0m+B4se64=',
    })
    expect(html).toContain('nonce="r4nd0m+B4se64="')
  })
})

describe('renderFallbackStyles', () => {
  it('accepts a custom element suffix', () => {
    expect(renderFallbackStyles('-yceffort-react')).toContain(
      'number-flow-yceffort-react > span',
    )
  })

  it('rejects a suffix that could escape the selector or the <style> tag', () => {
    expect(() => renderFallbackStyles('</style><script>')).toThrow(
      /Invalid elementSuffix/,
    )
    expect(() => renderFallbackStyles('-a, body')).toThrow(
      /Invalid elementSuffix/,
    )
  })
})
