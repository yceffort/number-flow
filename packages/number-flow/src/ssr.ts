import {BROWSER} from 'esm-env'

import type {Data, KeyedNumberPart} from './formatter'
import {
  halfMaskHeight,
  halfMaskHeightFallback,
  maskHeight,
  maskHeightFallback,
} from './styles'
import {css, html} from './util/string'

export const ServerSafeHTMLElement =
  BROWSER && typeof HTMLElement !== 'undefined'
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement) // for types

export const styles = css`
  :host {
    display: inline-block;
    direction: ltr;
    white-space: nowrap;
    line-height: 1;
  }

  span {
    display: inline-block;
  }

  :host([data-will-change]) span {
    will-change: transform;
  }

  .number,
  .digit {
    padding: ${halfMaskHeightFallback} 0;
  }

  /* var()-free probe; see styles.ts for why a double declaration won't work: */
  @supports (padding: round(nearest, 0.125em, 1px)) {
    .number,
    .digit {
      padding: ${halfMaskHeight} 0;
    }
  }

  .symbol {
    white-space: pre; /* some symbols are spaces or thin spaces */
  }
`

// This module builds raw HTML that frameworks inject verbatim (e.g. React's
// dangerouslySetInnerHTML), so every interpolated value has to be escaped.
// `prefix`/`suffix` and therefore `valueAsString` can carry caller data:
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
const escape = (value: string | number) =>
  String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]!)

const renderPart = (part: KeyedNumberPart) =>
  `<span class="${part.type === 'integer' || part.type === 'fraction' ? 'digit' : 'symbol'}" part="${part.type === 'integer' || part.type === 'fraction' ? `digit ${part.type}-digit` : `symbol ${part.type}`}">${escape(part.value)}</span>`

const renderSection = (section: KeyedNumberPart[], part: string) =>
  `<span part="${part}">${section.reduce((str, p) => str + renderPart(p), '')}</span>`

export const renderFallbackStyles = (elementSuffix = '') => {
  // This lands in a selector inside a <style> tag. Custom element names can
  // legally contain more than [a-z0-9-] (underscores, dots, most non-ASCII),
  // and this sits on a render path — so instead of rejecting, hex-escape
  // anything that isn't ident-safe (CSS.escape doesn't exist server-side).
  // That keeps every legal name matchable while caller data can't break out
  // of the selector or close the tag:
  const suffix = elementSuffix.replace(
    /[^a-zA-Z0-9_\u00A0-\uFFFF-]/g,
    (c) => `\\${c.codePointAt(0)!.toString(16)} `,
  )
  return css`
    :where(number-flow${suffix}) {
      line-height: 1;
    }

    number-flow${suffix} > span {
      font-kerning: none;
      display: inline-block;
      padding: ${maskHeightFallback} 0;
    }

    @supports (padding: round(nearest, 0.25em, 1px)) {
      number-flow${suffix} > span {
        padding: ${maskHeight} 0;
      }
    }
  `
}

export const renderInnerHTML = (
  data: Data,
  {nonce, elementSuffix}: {nonce?: string; elementSuffix?: string} = {},
) => {
  const nonceAttr = nonce ? ` nonce="${escape(nonce)}"` : ''
  const label = escape(data.valueAsString)
  // shadowroot="open" non-standard attribute for old Chrome:
  return html`<template shadowroot="open" shadowrootmode="open"
			><style${nonceAttr}>${styles}</style
			><span role="img" aria-label="${label}"
				>${renderSection(data.pre, 'left')}<span part="number" class="number"
					>${renderSection(data.integer, 'integer')}${renderSection(data.fraction, 'fraction')}</span
				>${renderSection(data.post, 'right')}</span
			></template
		><style${nonceAttr}>${renderFallbackStyles(elementSuffix)}</style
		><span>${label}</span>`
}
