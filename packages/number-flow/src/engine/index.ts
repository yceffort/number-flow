import {
  supportsMod,
  supportsLinear,
  supportsAtProperty,
  dxVar,
  widthDeltaVar,
  opacityDeltaVar,
  deltaVar,
} from '../styles'
import {digitYPercent, queue} from './compositor'
import {parseEasing, type EasingFn} from './easing'

export {digitYPercent}
export {animationsOf, discard, flush, prepare} from './compositor'

/**
 * Whether the browser can run the original, fully-native animation path
 * (WAAPI `linear()` easing + CSS `mod()`/`round()` + `@property`):
 */
export const supportsNativeAnimations =
  supportsMod && supportsLinear && supportsAtProperty

export type EngineMode = 'auto' | 'native' | 'raf'
let mode: EngineMode = 'auto'
/**
 * Force a specific animation engine. Mainly useful for testing the rAF
 * fallback in modern browsers. Must be called before any animations start.
 */
export const setEngineMode = (m: EngineMode) => {
  mode = m
}
export const usesNativeEngine = () =>
  mode === 'native' || (mode === 'auto' && supportsNativeAnimations)

// ---------------------------------------------------------------------------
// rAF fallback engine: replicates WAAPI's `composite: 'accumulate'` semantics
// by summing the contributions of all active tweens per (element, property)
// channel and writing the result to inline styles/custom properties, which the
// original stylesheet then consumes exactly like the native path.
// ---------------------------------------------------------------------------

const clamp = (min: number, n: number, max: number) =>
  Math.max(min, Math.min(n, max))

type Applier = (el: HTMLElement, total: number, idle: boolean) => void

const appliers: Record<string, Applier> = {
  transform: (el, total, idle) => {
    el.style.transform = idle || !total ? '' : `translateX(${total}px)`
  },
  [dxVar]: (el, total) => {
    el.style.setProperty(dxVar, `${total}px`)
  },
  [widthDeltaVar]: (el, total) => {
    // The stylesheet computes --scale-x from this var via `mod()`-free math,
    // but old browsers choke on dividing by a var() that substitutes to a
    // calc(), so write the resolved scale directly:
    const width = parseFloat(el.style.getPropertyValue('--width'))
    el.style.setProperty('--scale-x', String(width > 0 ? 1 + total / width : 1))
  },
  [opacityDeltaVar]: (el, total, idle) => {
    if (idle) {
      // Fall back to the stylesheet's calc(1 + var(base)):
      el.style.opacity = ''
      return
    }
    const base = parseFloat(el.style.getPropertyValue(opacityDeltaVar)) || 0
    el.style.opacity = String(clamp(0, 1 + base + total, 1))
  },
  [deltaVar]: (el, total) => {
    // Digit spin: compute each .digit__num's translateY like the CSS would:
    const current = parseFloat(el.style.getPropertyValue('--current')) || 0
    const length = el.children.length
    const c = current + total
    for (let i = 0; i < length; i++) {
      const child = el.children[i] as HTMLElement
      // Keep writing resting values at idle: without mod()/round() the
      // stylesheet can't compute --y, and `is-spinning` — removed on the
      // flow-wide animationsfinish, not per digit — may still be exposing
      // the inert numerals of a digit whose own spin already settled.
      // Digit removes the inline values once the whole flow is at rest, so
      // they can't go stale for a later non-animated `--current` change:
      child.style.setProperty('--y', `${digitYPercent(c, length, i)}%`)
    }
  },
}

class Channel {
  readonly anims = new Set<JSAnimation>()
  constructor(
    readonly el: HTMLElement,
    readonly applier: Applier,
  ) {}

  apply(now: number) {
    let total = 0
    let running = false
    this.anims.forEach((anim) => {
      const value = anim.valueAt(now)
      total += value
      if (!anim.done) running = true
      // A forwards fill keeps contributing its end value once done:
      else if (!value) this.anims.delete(anim)
    })
    this.applier(this.el, total, this.anims.size === 0)
    if (!running) activeChannels.delete(this)
  }
}

// The WAAPI timing model, for an effect started at a known time on a
// monotonic clock (https://drafts.csswg.org/web-animations-1/#the-effect-timing-model):
type Timing = {
  delay: number
  endDelay: number
  duration: number
  iterations: number
  iterationStart: number
  direction: PlaybackDirection
  fill: FillMode
  ease: EasingFn
}

const normalize = (t: EffectTiming): Timing => ({
  delay: t.delay ?? 0,
  endDelay: t.endDelay ?? 0,
  duration: typeof t.duration === 'number' ? t.duration : 0,
  iterations: t.iterations ?? 1,
  iterationStart: t.iterationStart ?? 0,
  direction: t.direction ?? 'normal',
  fill: t.fill ?? 'auto',
  ease: parseEasing(typeof t.easing === 'string' ? t.easing : undefined),
})

const activeDuration = (t: Timing) =>
  t.duration && t.iterations ? t.duration * t.iterations : 0
// When the effect is over and `finished` resolves:
const endTime = (t: Timing) =>
  Math.max(t.delay + activeDuration(t) + t.endDelay, 0)

// Transformed progress at a local time, or null while the effect is not in
// effect (before or after its active phase, with no fill covering that):
const progressAt = (t: Timing, local: number): number | null => {
  const active = activeDuration(t)
  const end = endTime(t)
  const before = local < Math.max(Math.min(t.delay, end), 0)
  const after = !before && local >= Math.max(Math.min(t.delay + active, end), 0)
  const fills =
    t.fill === 'both' || t.fill === (before ? 'backwards' : 'forwards')
  if ((before || after) && !fills) return null

  const activeTime = clamp(0, local - t.delay, active)
  const overall =
    (t.duration ? activeTime / t.duration : before ? 0 : t.iterations) +
    t.iterationStart
  let progress = (overall === Infinity ? t.iterationStart : overall) % 1
  // The end of the last iteration is 1, not the 0 of the one after:
  if (!progress && !before && activeTime === active && t.iterations)
    progress = 1
  const iteration = Math.floor(overall) - (progress === 1 ? 1 : 0)
  const odd = isFinite(iteration) && iteration % 2 === 1
  const reverse =
    t.direction === 'reverse' ||
    (t.direction === 'alternate'
      ? odd
      : t.direction === 'alternate-reverse' && !odd)
  return t.ease(reverse ? 1 - progress : progress)
}

class JSAnimation {
  readonly finished: Promise<void>
  private _resolve!: () => void
  done = false
  // What it contributes once done: non-zero only with a forwards fill
  private _end = 0

  constructor(
    private _channel: Channel,
    private _scope: object,
    private _from: number,
    private _start: number,
    private _timing: Timing,
  ) {
    this.finished = new Promise<void>((resolve) => {
      this._resolve = resolve
    })
  }

  private _valueAt(local: number): number {
    const progress = progressAt(this._timing, local)
    return progress == null ? 0 : this._from * (1 - progress)
  }

  valueAt(now: number): number {
    if (this.done) return this._end
    const local = now - this._start
    if (local >= endTime(this._timing)) {
      this._finish()
      return this._end
    }
    return this._valueAt(local)
  }

  private _finish() {
    this.done = true
    this._end = this._valueAt(endTime(this._timing))
    scopeAnims.get(this._scope)?.delete(this)
    this._resolve()
  }

  // Jump to the end state, like Animation.finish():
  finish() {
    if (this.done) return
    this._finish()
    this._channel.apply(performance.now())
  }
}

const activeChannels = new Set<Channel>()
const channelsByEl = new WeakMap<HTMLElement, Map<string, Channel>>()
const scopeAnims = new WeakMap<object, Set<JSAnimation>>()

let rafId: number | null = null
let backstopId: ReturnType<typeof setTimeout> | null = null
const tick = () => {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (backstopId != null) {
    clearTimeout(backstopId)
    backstopId = null
  }
  const now = performance.now()
  activeChannels.forEach((channel) => channel.apply(now))
  if (activeChannels.size) ensureLoop()
}
const ensureLoop = () => {
  rafId ??= requestAnimationFrame(tick)
  // rAF can be throttled or entirely absent (hidden pages, some old WebViews,
  // headless virtual time); a timer backstop keeps animations progressing:
  backstopId ??= setTimeout(tick, 34)
}

const numberIn = (val: string | number): number =>
  typeof val === 'number'
    ? val
    : parseFloat(/-?\d*\.?\d+(?:e[+-]?\d+)?/i.exec(val)?.[0] ?? '0')

export type EngineKeyframes = Record<string, [string | number, string | number]>

/**
 * Drop-in replacement for the original
 * `el.animate(keyframes, { ...timing, composite: 'accumulate' })` calls.
 * All keyframes must animate from a delta to 0/identity.
 */
export const animate = (
  scope: object,
  el: HTMLElement,
  keyframes: EngineKeyframes,
  timing: EffectTiming,
) => {
  if (usesNativeEngine()) {
    // Committed together at the end of the update by flush():
    queue(scope, el, keyframes as PropertyIndexedKeyframes, timing)
    return
  }

  const t = normalize(timing)
  const now = performance.now()

  let anims = scopeAnims.get(scope)
  if (!anims) scopeAnims.set(scope, (anims = new Set()))

  for (const prop in keyframes) {
    const applier = appliers[prop]
    if (!applier) continue

    let channels = channelsByEl.get(el)
    if (!channels) channelsByEl.set(el, (channels = new Map()))
    let channel = channels.get(prop)
    if (!channel) channels.set(prop, (channel = new Channel(el, applier)))

    const from = numberIn(keyframes[prop]![0])
    const anim = new JSAnimation(channel, scope, from, now, t)

    if (endTime(t) <= 0) {
      // Nothing to tween; jump straight to the end state:
      channel.anims.add(anim)
      activeChannels.add(channel)
      anim.finish()
      continue
    }

    channel.anims.add(anim)
    anims.add(anim)
    activeChannels.add(channel)
    ensureLoop()
  }
}

/** Engine equivalent of `shadowRoot.getAnimations().forEach((a) => a.finish())` */
export const finishAll = (scope: object) => {
  const anims = scopeAnims.get(scope)
  if (!anims) return
  Array.from(anims).forEach((anim) => anim.finish())
}

/** Engine equivalent of `shadowRoot.getAnimations().map((a) => a.finished)` */
export const finishedOf = (scope: object): Promise<void>[] => {
  const anims = scopeAnims.get(scope)
  return anims ? Array.from(anims, (a) => a.finished) : []
}
