import {BROWSER} from 'esm-env'

import {
  animate,
  animationsOf,
  discard,
  finishAll,
  finishedOf,
  flush,
  prepare,
  usesNativeEngine,
} from './engine'
import {
  type KeyedDigitPart,
  type KeyedNumberPart,
  type KeyedSymbolPart,
  type NumberPartKey,
  type Data,
} from './formatter'
import type {Plugin} from './plugins'
import {ServerSafeHTMLElement} from './ssr'
import styles, {
  dxVar,
  opacityDeltaVar,
  prefersReducedMotion,
  widthDeltaVar,
  deltaVar,
} from './styles'
import {
  createElement,
  offset,
  visible,
  type HTMLProps,
  type Justify,
} from './util/dom'
import {forEach} from './util/iterable'
import type {Mutable as MakeMutable} from './util/types'

export {define} from './util/dom'
export {prefersReducedMotion} from './styles'
export {renderInnerHTML} from './ssr'
export {
  setEngineMode,
  supportsNativeAnimations,
  type EngineMode,
} from './engine'
export * from './plugins'
export * from './formatter'

// The rAF fallback engine only needs rAF itself; browsers that additionally
// support linear() + mod()/round() + @property get the original native path:
export const canAnimate =
  BROWSER && typeof requestAnimationFrame !== 'undefined'

// Hoping to use -1 | 0 | 1 in the future if Math.sign types ever get fixed.
// Don't do ReturnType<Math['sign']> cause it breaks Vue prop types:
export type Trend = number | ((oldValue: number, value: number) => number)

export type DigitOptions = {max?: number}
export type Digits = Record<number, DigitOptions>

export interface Props {
  transformTiming: EffectTiming
  spinTiming: EffectTiming | undefined
  opacityTiming: EffectTiming
  animated: boolean
  respectMotionPreference: boolean
  trend: Trend
  plugins?: Plugin[]
  digits: Digits | undefined
}

// Workaround for Object.assign in constructor and TS:
// https://github.com/microsoft/TypeScript/issues/26792#issuecomment-617541464
export default interface NumberFlowLite extends Props {}

// Workaround for no outside-readable/inside-writable members in TS:
// https://github.com/microsoft/TypeScript/issues/37487
type Mutable = MakeMutable<NumberFlowLite>

/**
 * @internal Used for framework wrappers
 */
export default class NumberFlowLite
  extends ServerSafeHTMLElement
  implements Props
{
  /**
   * Use `private _private` properties instead of `#private` to avoid # polyfill and
   * reduce bundle size. Also, use `readonly` properties instead of getters to save on bundle
   * size, even though you have to do gross stuff like `(this as Mutable<...>)` until TS
   * supports e.g. https://github.com/microsoft/TypeScript/issues/37487
   */

  static defaultProps: Props = {
    transformTiming: {
      duration: 900,
      // Make sure to keep this minified:
      easing: `linear(0,.005,.019,.039,.066,.096,.129,.165,.202,.24,.278,.316,.354,.39,.426,.461,.494,.526,.557,.586,.614,.64,.665,.689,.711,.731,.751,.769,.786,.802,.817,.831,.844,.856,.867,.877,.887,.896,.904,.912,.919,.925,.931,.937,.942,.947,.951,.955,.959,.962,.965,.968,.971,.973,.976,.978,.98,.981,.983,.984,.986,.987,.988,.989,.99,.991,.992,.992,.993,.994,.994,.995,.995,.996,.996,.9963,.9967,.9969,.9972,.9975,.9977,.9979,.9981,.9982,.9984,.9985,.9987,.9988,.9989,1)`,
    },
    spinTiming: undefined,
    opacityTiming: {duration: 450, easing: 'ease-out'},
    animated: true,
    trend: (oldValue, value) => Math.sign(value - oldValue),
    respectMotionPreference: true,
    plugins: undefined,
    digits: undefined,
  }

  constructor() {
    super()
    const {animated, ...props} = (this.constructor as typeof NumberFlowLite)
      .defaultProps
    this._animated = this.computedAnimated = animated
    Object.assign(this, props)
  }

  private _animated: boolean
  get animated() {
    return this._animated
  }
  set animated(val: boolean) {
    if (this.animated === val) return
    this._animated = val
    // Finish any in-flight animations (instead of cancel, which won't trigger their finish events):
    if (usesNativeEngine()) {
      discard(this)
      this.shadowRoot?.getAnimations().forEach((a) => a.finish())
    } else finishAll(this)
  }

  readonly created: boolean = false

  private _pre?: Section
  private _num?: Num
  private _post?: Section

  readonly computedTrend?: number

  readonly computedAnimated: boolean

  private _internals?: ElementInternals

  private _data?: Data

  /**
   * @internal
   */
  batched = false

  /**
   * @internal
   */
  set data(data: Data | undefined) {
    if (data == null) {
      return
    }

    // Skip identity-equal re-sets. React 19 sets the `data` property during
    // its commit, then the React wrapper's componentDidMount sets the same
    // object again; without this check the second set takes the update path
    // below and measures every section and digit, forcing a synchronous
    // reflow per mounted element (barvian/number-flow#195):
    if (data === this._data) {
      return
    }

    const {pre, integer, fraction, post, value} = data

    // Initialize if needed
    if (!this.created) {
      this._data = data

      // This will overwrite the DSD if any:
      this.attachShadow({mode: 'open'})

      try {
        this._internals ??= this.attachInternals()
        this._internals.role = 'img'
      } catch {
        // Don't error in old browsers that don't support ElementInternals
        // Try/catch is less code than an if check.
      }

      // Add stylesheet; don't use adoptedStylesheets because it works unreliably in Safari:
      const style = document.createElement('style')
      if (this.nonce) style.nonce = this.nonce
      style.textContent = styles
      this.shadowRoot!.appendChild(style)

      this._pre = new Section(this, pre, {
        justify: 'right',
        part: 'left',
      })
      this.shadowRoot!.appendChild(this._pre.el)

      this._num = new Num(this, integer, fraction)
      this.shadowRoot!.appendChild(this._num.el)

      this._post = new Section(this, post, {
        justify: 'left',
        part: 'right',
      })
      this.shadowRoot!.appendChild(this._post.el)
      ;(this as Mutable).created = true
    } else {
      const prev = this._data!
      this._data = data

      // Compute trend
      ;(this as Mutable).computedTrend =
        typeof this.trend === 'function'
          ? this.trend(prev.value, value)
          : this.trend
      ;(this as Mutable).computedAnimated =
        canAnimate &&
        this._animated &&
        (!this.respectMotionPreference || !prefersReducedMotion?.matches) &&
        // https://github.com/barvian/number-flow/issues/9
        visible(this) &&
        // https://github.com/barvian/number-flow/issues/165
        this.ownerDocument.visibilityState === 'visible'

      this.plugins?.forEach((p) => p.onUpdate?.(data, prev, this))

      if (!this.batched) this.willUpdate()

      // Each phase finishes its DOM writes across every section before the
      // next one reads layout, so an update forces one layout (one more when
      // it adds chars, one more when it drops digits) instead of one per
      // section plus one per digit (yceffort/number-flow#17):
      this._pre!.update(pre)
      this._num!.update({integer, fraction})
      this._post!.update(post)
      const sections = [this._pre!, this._num!, this._post!]
      sections.forEach((s) => s.measureAdded())
      sections.forEach((s) => s.updateValues())
      this._num!.measureRemoved()
      this._num!.popRemoved()

      if (!this.batched) this.didUpdate()
    }

    // Old browsers may lack ElementInternals entirely, or have it without
    // ARIAMixin (e.g. Chrome 77-80) where the assignment silently no-ops —
    // fall back to attributes so accessibility still works there:
    if (this._internals && 'ariaLabel' in this._internals) {
      this._internals.ariaLabel = data.valueAsString
    } else {
      this.setAttribute('role', 'img')
      this.setAttribute('aria-label', data.valueAsString)
    }
  }

  private _preUpdated = false

  /**
   * @internal
   */
  willUpdate() {
    // Animations queued by an update whose didUpdate never ran (e.g. a
    // grouped flow disconnected in between) must not leak into this one:
    discard(this)
    // Skip the measurement pass when animations can't run: it reads layout
    // (a forced reflow) for every section and digit, and didUpdate — its only
    // consumer — would discard the measurements anyway
    // (barvian/number-flow#195). `visible(this)` reads layout itself, so it
    // comes last: a flow that can't animate anyway never touches layout here.
    // didUpdate also checks `_preUpdated`, so a prop that changes between the
    // two passes degrades to skipping that animation rather than animating
    // from missing measurements:
    this._preUpdated =
      canAnimate &&
      this._animated &&
      (!this.respectMotionPreference || !prefersReducedMotion?.matches) &&
      this.ownerDocument.visibilityState === 'visible' &&
      visible(this)
    if (!this._preUpdated) return

    this._pre!.willUpdate()
    this._num!.willUpdate()
    this._post!.willUpdate()
  }

  private _abortAnimationsFinish?: AbortController

  /**
   * @internal
   */
  didUpdate() {
    // Safe to call this here because we know the animated prop is up-to-date.
    // Also make sure willUpdate didn't skip its measurement pass:
    if (!this.computedAnimated || !this._preUpdated) {
      // A non-animated update landing mid-flight (hidden tab, reduced
      // motion, invisible element) must not leave the old tweens running:
      // they'd keep deriving offsets from the already-updated --current:
      if (usesNativeEngine()) {
        discard(this)
        this.shadowRoot?.getAnimations().forEach((a) => a.finish())
      } else finishAll(this)
      return
    }

    // If we're already animating, cancel the previous animationsfinish event:
    if (this._abortAnimationsFinish) this._abortAnimationsFinish.abort()
    // Otherwise, dispatch a start event:
    else this.dispatchEvent(new Event('animationsstart'))

    // Measure every section and char (and what the engine will need) before
    // any of them writes to the DOM:
    const sections = [this._pre!, this._num!, this._post!]
    const commits = sections.map((s) => s.measure())
    if (usesNativeEngine()) prepare(this)
    commits.forEach((commit) => commit())
    if (usesNativeEngine()) flush(this)

    const controller = new AbortController()
    const finished = usesNativeEngine()
      ? animationsOf(this).map((a) => a.finished)
      : finishedOf(this)
    Promise.all(finished).then(() => {
      if (!controller.signal.aborted) {
        this.dispatchEvent(new Event('animationsfinish'))
        this._abortAnimationsFinish = undefined
      }
    })
    this._abortAnimationsFinish = controller
  }
}

class Num {
  readonly el: HTMLSpanElement
  readonly _inner: HTMLSpanElement

  private _integer: NumberSection
  private _fraction: NumberSection

  constructor(
    readonly flow: NumberFlowLite,
    integer: KeyedNumberPart[],
    fraction: KeyedNumberPart[],
    {className, ...props}: HTMLProps<'span'> = {},
  ) {
    this._integer = new NumberSection(flow, integer, {
      justify: 'right',
      part: 'integer',
    })
    this._fraction = new NumberSection(flow, fraction, {
      justify: 'left',
      part: 'fraction',
    })

    this._inner = createElement(
      'span',
      {
        className: `number__inner`,
      },
      [this._integer.el, this._fraction.el],
    )
    this.el = createElement(
      'span',
      {
        ...props,
        part: 'number',
        className: `number ${className ?? ''}`,
      },
      [this._inner],
    )

    // The rAF engine writes --scale-x as a resolved number (instead of
    // animating the width delta var), so give it a resting value that the
    // mask/transform calcs in old browsers can divide by:
    if (!usesNativeEngine()) {
      this.el.style.setProperty('--scale-x', '1')
      this.el.style.setProperty(dxVar, '0px')
    }
  }

  private _prevWidth?: number
  private _prevLeft?: number

  willUpdate() {
    this._prevWidth = this.el.offsetWidth
    this._prevLeft = this.el.getBoundingClientRect().left

    this._integer.willUpdate()
    this._fraction.willUpdate()
  }

  update({integer, fraction}: Pick<Data, 'integer' | 'fraction'>) {
    this._integer.update(integer)
    this._fraction.update(fraction)
  }

  measureAdded() {
    this._integer.measureAdded()
    this._fraction.measureAdded()
  }

  updateValues() {
    this._integer.updateValues()
    this._fraction.updateValues()
  }

  measureRemoved() {
    this._integer.measureRemoved()
    this._fraction.measureRemoved()
  }

  popRemoved() {
    this._integer.popRemoved()
    this._fraction.popRemoved()
  }

  measure(): Commit {
    const rect = this.el.getBoundingClientRect()
    const commits = [this._integer.measure(), this._fraction.measure()]

    const dx = this._prevLeft! - rect.left

    const width = this.el.offsetWidth
    // We convert scale to width delta in px to better handle interruptions and keep them in
    // sync with translations:
    const dWidth = this._prevWidth! - width

    return () => {
      commits.forEach((commit) => commit())
      this.el.style.setProperty('--width', String(width))

      animate(
        this.flow,
        this.el,
        {
          [dxVar]: [`${dx}px`, '0px'],
          [widthDeltaVar]: [dWidth, 0],
        },
        this.flow.transformTiming,
      )
    }
  }
}

// Lets the sections diff against the incoming parts in one pass instead of
// scanning `parts` once per existing child:
const keySet = (parts: KeyedNumberPart[]) => new Set(parts.map((p) => p.key))

// The DOM writes a measure() pass deferred until every read is done:
type Commit = () => void
const noop: Commit = () => {}

type SectionProps = {justify: Justify} & HTMLProps<'span'>

class Section {
  readonly el: HTMLSpanElement
  readonly justify: Justify

  // All children in the DOM:
  protected children = new Map<NumberPartKey, Char>()

  constructor(
    readonly flow: NumberFlowLite,
    parts: KeyedNumberPart[],
    {justify, className, ...props}: SectionProps,
    children?: (chars: Node[]) => Node[],
  ) {
    this.justify = justify
    const chars = parts.map<Node>((p) => this.addChar(p).el)

    this.el = createElement(
      'span',
      {
        ...props,
        className: `section section--justify-${justify} ${className ?? ''}`,
      },
      children ? children(chars) : chars,
    )
  }

  protected addChar(
    part: KeyedNumberPart,
    {
      startDigitsAtZero = false,
      ...props
    }: {startDigitsAtZero?: boolean} & Pick<
      AnimatePresenceProps,
      'animateIn'
    > = {},
  ) {
    const comp =
      part.type === 'integer' || part.type === 'fraction'
        ? new Digit(
            this,
            part.type,
            startDigitsAtZero ? 0 : part.value,
            part.pos,
            {
              ...props,
              onRemove: this.onCharRemove(part.key),
            },
          )
        : new Sym(this, part.type, part.value, {
            ...props,
            onRemove: this.onCharRemove(part.key),
          })
    this.children.set(part.key, comp)
    return comp
  }

  private onCharRemove =
    (key: NumberPartKey): OnRemove =>
    () => {
      this.children.delete(key)
    }

  // The chars update() added or kept, with the values updateValues() gives them:
  private _added = new Map<Char, KeyedNumberPart['value']>()
  private _updated = new Map<Char, KeyedNumberPart['value']>()

  // Writes only: takes the chars that are gone out of the flow and puts the
  // rest in place.
  update(parts: KeyedNumberPart[]) {
    const keys = keySet(parts)
    this.children.forEach((comp, key) => {
      if (!keys.has(key)) this.remove(comp)
    })

    const reverse = this.justify === 'left'
    const op = reverse ? 'prepend' : 'append'
    forEach(
      parts,
      (part) => {
        let comp: Char
        if (this.children.has(part.key)) {
          comp = this.children.get(part.key)!
          this._updated.set(comp, part.value)
          comp.unpop()
          comp.present = true
        } else {
          comp = this.addChar(part, {startDigitsAtZero: true, animateIn: true})
          this._added.set(comp, part.value)
        }
        this.el[op](comp.el)
      },
      {reverse},
    )
  }

  // A symbol fades out where it was, under whatever replaces it:
  protected remove(comp: Char) {
    if (comp.present) comp.pop()
  }

  // Reads only: where the added chars start, before updateValues() moves
  // everything.
  measureAdded() {
    if (!this._added.size || !this.flow.computedAnimated) return
    const rect = this.el.getBoundingClientRect()
    this._added.forEach((_, comp) => comp.willUpdate(rect))
  }

  // Writes only.
  updateValues() {
    this._added.forEach((value, comp) => comp.update(value))
    this._updated.forEach((value, comp) => comp.update(value))
    this._added.clear()
    this._updated.clear()
  }

  private _prevOffset?: number

  willUpdate() {
    const rect = this.el.getBoundingClientRect()
    this._prevOffset = rect[this.justify]

    this.children.forEach((comp) => comp.willUpdate(rect))
  }

  measure(): Commit {
    const rect = this.el.getBoundingClientRect()
    const commits = Array.from(this.children.values(), (comp) =>
      comp.measure(rect),
    )
    const dx = this._prevOffset! - rect[this.justify]

    return () => {
      commits.forEach((commit) => commit())

      // Technically checking for children could get weird during multiple interruptions
      // but probably still worth it;
      if (dx && this.children.size)
        animate(
          this.flow,
          this.el,
          {
            transform: [`translateX(${dx}px)`, 'none'],
          },
          this.flow.transformTiming,
        )
    }
  }
}

// A dropped digit fades out where it would sit once the kept digits have their
// new values, so that it travels with neighbours whose width changes: the
// dropped chars go back into the flow until the values are in, then get
// measured and popped again.
class NumberSection extends Section {
  private _removed: Char[] = []

  protected override remove(comp: Char) {
    comp.unpop()
    this._removed.push(comp)
  }

  override updateValues() {
    super.updateValues()
    // Set dropped digits to 0, for mathematical correctness:
    this._removed.forEach((comp) => {
      if (comp instanceof Digit) comp.update(0)
    })
  }

  // Reads only.
  measureRemoved() {
    if (!this.flow.computedAnimated) return
    this._removed.forEach((comp) => comp.measureLayout())
  }

  // Writes only.
  popRemoved() {
    this._removed.forEach((comp) => comp.pop())
    this._removed = []
  }
}

type OnRemove = () => void
interface AnimatePresenceProps {
  onRemove?: OnRemove
  animateIn?: boolean
}

class AnimatePresence {
  private _present = true
  private _onRemove?: OnRemove

  constructor(
    readonly flow: NumberFlowLite,
    readonly el: HTMLElement,
    {onRemove, animateIn = false}: AnimatePresenceProps = {},
  ) {
    this.el.classList.add('animate-presence')
    // This craziness is the only way I could figure out how to get the opacity
    // accumulation to work in all browsers. Accumulating -1 onto opacity directly
    // failed in both FF and Safari, and setting a delta to -1 still failed in FF
    if (this.flow.computedAnimated && animateIn) {
      animate(
        this.flow,
        this.el,
        {
          [opacityDeltaVar]: [-0.9999, 0],
        },
        this.flow.opacityTiming,
      )
    }

    this._onRemove = onRemove
  }

  get present() {
    return this._present
  }

  private _remove = () => {
    this.el.remove()
    this._onRemove?.()
  }

  set present(val) {
    if (this._present === val) return
    this._present = val
    if (val) this.el.removeAttribute('inert')
    else this.el.setAttribute('inert', '')

    if (!this.flow.computedAnimated) {
      if (!val) this._remove()
      return
    }

    this.el.style.setProperty(opacityDeltaVar, val ? '0' : '-.999')
    animate(
      this.flow,
      this.el,
      {
        [opacityDeltaVar]: val ? [-0.9999, 0] : [0.999, 0],
      },
      this.flow.opacityTiming,
    )

    if (val) this.flow.removeEventListener('animationsfinish', this._remove)
    else
      this.flow.addEventListener('animationsfinish', this._remove, {
        once: true,
      })
  }
}

interface CharProps extends AnimatePresenceProps {}

abstract class Char<
  P extends KeyedNumberPart = KeyedNumberPart,
> extends AnimatePresence {
  constructor(
    readonly section: Section,
    protected value: P['value'],
    override readonly el: HTMLSpanElement,
    props?: AnimatePresenceProps,
  ) {
    super(section.flow, el, props)
  }

  // Layout position (transforms excluded, unlike the rects the subclasses
  // measure), to pin the char there when it gets popped out of the flow:
  private _top?: number
  private _offset?: number

  measureLayout() {
    this._top = this.el.offsetTop
    this._offset = offset(this.el, this.section.justify)
  }

  abstract willUpdate(parentRect: DOMRect): void
  abstract update(value: P['value']): void
  abstract measure(parentRect: DOMRect): Commit

  pop() {
    // Unset when nothing measured it, i.e. the update doesn't animate and
    // `present` removes the char right away:
    if (this._top != null) {
      this.el.style.top = `${this._top}px`
      this.el.style[this.section.justify] = `${this._offset}px`
    }
    this.el.setAttribute('inert', '')
    this.present = false
  }

  unpop() {
    this.el.removeAttribute('inert')
    this.el.style.top = ''
    this.el.style[this.section.justify] = ''
  }
}

export class Digit extends Char<KeyedDigitPart> {
  private _numbers: HTMLSpanElement[]
  readonly length: number

  constructor(
    section: Section,
    type: KeyedDigitPart['type'],
    value: KeyedDigitPart['value'],
    readonly pos: number,
    props?: CharProps,
  ) {
    const length = (section.flow.digits?.[pos]?.max ?? 9) + 1
    const numbers = Array.from({length}).map((_, i) => {
      const num = createElement('span', {className: `digit__num`}, [
        document.createTextNode(String(i)),
      ])
      // Use the attribute for now because it has a little better browser support:
      if (i !== value) num.setAttribute('inert', '')
      num.style.setProperty('--n', String(i))
      return num
    })
    const el = createElement(
      'span',
      {
        part: `digit ${type}-digit`,
        className: `digit`,
      },
      numbers,
    )
    el.style.setProperty('--current', String(value))
    el.style.setProperty('--length', String(length))

    super(section, value, el, props)

    this._numbers = numbers
    this.length = length
  }

  private _prevValue?: KeyedDigitPart['value']

  // Relative to parent:
  private _prevCenter?: number

  willUpdate(parentRect: DOMRect) {
    const rect = this.el.getBoundingClientRect()

    this._prevValue = this.value

    const prevOffset =
      rect[this.section.justify] - parentRect[this.section.justify]
    const halfWidth = rect.width / 2
    this._prevCenter =
      this.section.justify === 'left'
        ? prevOffset + halfWidth
        : prevOffset - halfWidth
  }

  update(value: KeyedDigitPart['value']) {
    this.el.style.setProperty('--current', String(value))
    this._numbers.forEach((num, i) =>
      i === value
        ? num.removeAttribute('inert')
        : num.setAttribute('inert', ''),
    )
    this.value = value
  }

  measure(parentRect: DOMRect): Commit {
    const rect = this.el.getBoundingClientRect()
    const offset = rect[this.section.justify] - parentRect[this.section.justify]
    const halfWidth = rect.width / 2
    const center =
      this.section.justify === 'left' ? offset + halfWidth : offset - halfWidth
    const dx = this._prevCenter! - center

    return () => {
      if (dx)
        animate(
          this.flow,
          this.el,
          {
            transform: [`translateX(${dx}px)`, 'none'],
          },
          this.flow.transformTiming,
        )

      const delta = this.getDelta()
      if (!delta) return

      this.el.classList.add('is-spinning')
      animate(
        this.flow,
        this.el,
        {
          [deltaVar]: [-delta, 0],
        },
        this.flow.spinTiming ?? this.flow.transformTiming,
      )
      // Hoisting the callback out prevents duplicates:
      this.flow.addEventListener('animationsfinish', this._onAnimationsFinish, {
        once: true,
      })
    }
  }

  getDelta() {
    if (this.flow.plugins)
      for (const plugin of this.flow.plugins) {
        const diff = plugin.getDelta?.(this.value, this._prevValue!, this)
        if (diff != null) return diff
      }

    const diff = this.value - this._prevValue!
    // Make it per-digit if no root trend:
    const trend = this.flow.computedTrend || Math.sign(diff)
    // Loop around if need be:
    if (trend < 0 && this.value > this._prevValue!)
      return this.value - this.length - this._prevValue!
    else if (trend > 0 && this.value < this._prevValue!)
      return this.length - this._prevValue! + this.value

    return diff
  }

  private _onAnimationsFinish = () => {
    this.el.classList.remove('is-spinning')
    // The rAF engine keeps resting --y values inline while other digits may
    // still be animating; once the whole flow settles, hand the numerals
    // back to the stylesheet so nothing stale outranks it later:
    this._numbers.forEach((num) => num.style.removeProperty('--y'))
  }
}

class Sym extends Char<KeyedSymbolPart> {
  constructor(
    section: Section,
    private type: KeyedSymbolPart['type'],
    value: KeyedSymbolPart['value'],
    props?: CharProps,
  ) {
    const val = createElement('span', {
      className: 'symbol__value',
      textContent: value,
    })
    super(
      section,
      value,
      createElement(
        'span',
        {
          part: `symbol ${type}`,
          className: `symbol`,
        },
        [val],
      ),
      props,
    )
    this._children.set(
      value,
      new AnimatePresence(this.flow, val, {
        onRemove: this._onChildRemove(value),
      }),
    )
  }

  private _children = new Map<KeyedSymbolPart['value'], AnimatePresence>()

  private _prevOffset?: number

  willUpdate(parentRect: DOMRect) {
    // A symbol section pins a dropped symbol where it was (Section.remove),
    // so take that before anything moves:
    this.measureLayout()
    if (this.type === 'decimal') return // decimal never needs animation b/c it's the first in a left aligned section and never moves

    const rect = this.el.getBoundingClientRect()
    this._prevOffset =
      rect[this.section.justify] - parentRect[this.section.justify]
  }

  private _onChildRemove =
    (key: KeyedSymbolPart['value']): OnRemove =>
    () => {
      this._children.delete(key)
    }

  update(value: KeyedSymbolPart['value']) {
    if (this.value !== value) {
      // Pop the current value:
      const current = this._children.get(this.value)
      if (current) current.present = false

      // If we already have the new value and it hasn't finished removing, reclaim it:
      const prev = this._children.get(value)
      if (prev) {
        prev.present = true
      } else {
        // Otherwise, create a new one:
        const newVal = createElement('span', {
          className: 'symbol__value',
          textContent: value,
        })
        this.el.appendChild(newVal)
        this._children.set(
          value,
          new AnimatePresence(this.flow, newVal, {
            animateIn: true,
            onRemove: this._onChildRemove(value),
          }),
        )
      }
    }
    this.value = value
  }

  measure(parentRect: DOMRect): Commit {
    if (this.type === 'decimal') return noop

    const rect = this.el.getBoundingClientRect()
    const offset = rect[this.section.justify] - parentRect[this.section.justify]
    const dx = this._prevOffset! - offset

    return () => {
      if (dx)
        animate(
          this.flow,
          this.el,
          {
            transform: [`translateX(${dx}px)`, 'none'],
          },
          this.flow.transformTiming,
        )
    }
  }
}
