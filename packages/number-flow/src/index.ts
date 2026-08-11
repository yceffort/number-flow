import {buildStyles} from './csp'
import {formatToData, type Value, type Format} from './formatter'
import NumberFlowLite from './lite'
import {renderInnerHTML as defaultRenderInnerHTML} from './ssr'
import {define} from './util/dom'
export const styles = buildStyles()
export * from './lite'

export const CONNECT_EVENT = 'number-flow-connect'
export const UPDATE_EVENT = 'number-flow-update'

// Override the export from ./lite
export const renderInnerHTML = (
  value: Value,
  {
    locales,
    format,
    numberPrefix: prefix,
    numberSuffix: suffix,
    nonce,
  }: {
    locales?: Intl.LocalesArgument
    format?: Intl.NumberFormatOptions
    numberPrefix?: string
    numberSuffix?: string
    nonce?: string
  } = {},
) => {
  const data = formatToData(
    value,
    new Intl.NumberFormat(locales, format),
    prefix,
    suffix,
  )

  return defaultRenderInnerHTML(data, {nonce})
}

export default class NumberFlow extends NumberFlowLite {
  /**
   * @internal for grouping
   */
  connected = false
  connectedCallback() {
    this.connected = true
    this.dispatchEvent(new Event(CONNECT_EVENT, {bubbles: true}))
  }
  disconnectedCallback() {
    this.connected = false
  }

  format?: Format
  locales?: Intl.LocalesArgument
  // This can't be called prefix because that conflicts:
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/prefix
  numberPrefix?: string
  numberSuffix?: string

  private _formatter?: Intl.NumberFormat

  private _prevFormat?: string
  private _prevLocales?: string

  private _value?: Value
  get value() {
    return this._value
  }

  update(value?: Value) {
    // Compare serialized, not by identity: constructing an Intl.NumberFormat
    // is far more expensive than stringifying these, and callers routinely
    // pass a fresh object literal on every update. Canonicalize the locales
    // first — Intl.Locale instances have no own enumerable properties, so
    // JSON.stringify alone would collapse them all to '{}':
    const format = this.format ? JSON.stringify(this.format) : ''
    const locales = this.locales
      ? // getCanonicalLocales accepts Intl.Locale per spec; TS lib types lag:
        JSON.stringify(
          Intl.getCanonicalLocales(this.locales as string | string[]),
        )
      : ''
    if (
      !this._formatter ||
      this._prevFormat !== format ||
      this._prevLocales !== locales
    ) {
      this._formatter = new Intl.NumberFormat(this.locales, this.format)
      this._prevFormat = format
      this._prevLocales = locales
    }
    if (value != null) {
      this._value = value
    }

    // For group, has to be before setting data:
    this.dispatchEvent(new Event(UPDATE_EVENT, {bubbles: true}))

    this.data = formatToData(
      this._value!,
      this._formatter!,
      this.numberPrefix,
      this.numberSuffix,
    )
  }
}

define('number-flow', NumberFlow)

declare global {
  interface HTMLElementTagNameMap {
    'number-flow': NumberFlow
  }
}
