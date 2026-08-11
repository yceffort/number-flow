import {
  supportsMod,
  supportsLinear,
  supportsAtProperty,
  dxVar,
  widthDeltaVar,
  opacityDeltaVar,
  deltaVar,
} from '../styles'
import {parseEasing, type EasingFn} from './easing'

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
const cssMod = (a: number, m: number) => ((a % m) + m) % m

type Applier = (el: HTMLElement, total: number, idle: boolean) => void

// JS port of the .digit__num CSS formula from styles.ts (mod()/round() math):
export const digitYPercent = (c: number, length: number, n: number): number => {
  const raw = cssMod(length + n - cssMod(c, length), length)
  const offset = raw - length * Math.floor(raw / (length / 2))
  return clamp(-1, offset, 1) * 100
}

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
    this.anims.forEach((anim) => {
      total += anim.valueAt(now)
      if (anim.done) this.anims.delete(anim)
    })
    this.applier(this.el, total, this.anims.size === 0)
    if (this.anims.size === 0) activeChannels.delete(this)
  }
}

class JSAnimation {
  readonly finished: Promise<void>
  private _resolve!: () => void
  done = false

  constructor(
    private _channel: Channel,
    private _scope: object,
    private _from: number,
    private _start: number,
    private _duration: number,
    private _ease: EasingFn,
  ) {
    this.finished = new Promise<void>((resolve) => {
      this._resolve = resolve
    })
  }

  valueAt(now: number): number {
    if (this.done) return 0
    const t = (now - this._start) / this._duration
    // Like WAAPI with the default fill, a delayed animation contributes
    // nothing until its active phase starts:
    if (t < 0) return 0
    if (t >= 1) {
      this._finish()
      return 0
    }
    return this._from * (1 - this._ease(t))
  }

  private _finish() {
    this.done = true
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
    el.animate(keyframes as PropertyIndexedKeyframes, {
      ...timing,
      composite: 'accumulate',
    })
    return
  }

  const duration = typeof timing.duration === 'number' ? timing.duration : 0
  const delay = timing.delay ?? 0
  const ease = parseEasing(
    typeof timing.easing === 'string' ? timing.easing : undefined,
  )
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
    const anim = new JSAnimation(
      channel,
      scope,
      from,
      now + delay,
      duration,
      ease,
    )

    if (duration <= 0) {
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
