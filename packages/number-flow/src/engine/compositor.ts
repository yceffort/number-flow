import {deltaVar, dxVar, opacityDeltaVar, widthDeltaVar} from '../styles'
import {easingInfo, type EasingFn} from './easing'

// ---------------------------------------------------------------------------
// Compositor path for the native engine. The stylesheet's custom properties
// animated with `composite: 'accumulate'` can't run off the main thread, so
// each target instead gets one `composite: 'replace'` transform/opacity
// animation whose keyframes are the values the stylesheet would compute from
// the stacked deltas. An interruption re-bakes the remaining stack into the
// new animation, so positions and velocities stay what accumulate produced.
// ---------------------------------------------------------------------------

const clamp = (min: number, n: number, max: number) =>
  Math.max(min, Math.min(n, max))
const cssMod = (a: number, m: number) => ((a % m) + m) % m

// JS port of the .digit__num CSS formula from styles.ts (mod()/round() math):
export const digitYPercent = (c: number, length: number, n: number): number => {
  const raw = cssMod(length + n - cssMod(c, length), length)
  const offset = raw - length * Math.floor(raw / (length / 2))
  return clamp(-1, offset, 1) * 100
}

const numberIn = (val: string | number): number =>
  typeof val === 'number'
    ? val
    : parseFloat(/-?\d*\.?\d+(?:e[+-]?\d+)?/i.exec(val)?.[0] ?? '0')

type Kind = 'tx' | 'number' | 'spin' | 'opacity'

type Contribution = {
  from: number[]
  // Relative to the start of the channel's current animation:
  start: number
  delay: number
  duration: number
  endDelay: number
  easing: string
  ease: EasingFn
  stops: number[] | null
  overshoots: boolean
}

type Channel = {
  kind: Kind
  el: HTMLElement
  contribs: Contribution[]
  anims: Animation[]
  inputs: string
  legacy: Animation[]
}

type Req = {
  el: HTMLElement
  kind: Kind | null
  from: number[]
  keyframes: PropertyIndexedKeyframes
  timing: EffectTiming
}

const pending = new WeakMap<object, Req[]>()
const channels = new WeakMap<HTMLElement, Partial<Record<Kind, Channel>>>()
// Spins read --current and the numerals' inert state, which Digit can change
// without starting a new spin (e.g. a plugin returning a 0 delta):
const spins = new WeakMap<object, Set<Channel>>()

const channel = (el: HTMLElement, kind: Kind): Channel => {
  let byKind = channels.get(el)
  if (!byKind) channels.set(el, (byKind = {}))
  return (byKind[kind] ??= {
    kind,
    el,
    contribs: [],
    anims: [],
    inputs: '',
    legacy: [],
  })
}

const classify = (
  kf: PropertyIndexedKeyframes,
): {kind: Kind | null; from: number[]} => {
  const props = Object.keys(kf)
  const first = (p: string) => numberIn((kf[p] as (string | number)[])[0]!)
  if (props.length === 1) {
    if (props[0] === 'transform')
      return {kind: 'tx', from: [first('transform')]}
    if (props[0] === deltaVar) return {kind: 'spin', from: [first(deltaVar)]}
    if (props[0] === opacityDeltaVar)
      return {kind: 'opacity', from: [first(opacityDeltaVar)]}
  } else if (props.length === 2 && dxVar in kf && widthDeltaVar in kf) {
    return {kind: 'number', from: [first(dxVar), first(widthDeltaVar)]}
  }
  return {kind: null, from: []}
}

export const queue = (
  scope: object,
  el: HTMLElement,
  keyframes: PropertyIndexedKeyframes,
  timing: EffectTiming,
) => {
  let reqs = pending.get(scope)
  if (!reqs) pending.set(scope, (reqs = []))
  reqs.push({el, keyframes, timing, ...classify(keyframes)})
}

/** Drop queued animations that won't be committed (non-animated update). */
export const discard = (scope: object) => {
  pending.delete(scope)
}

// The keyframes lite.ts animates a contribution with on the accumulate path:
const original = (kind: Kind, [a, b]: number[]): PropertyIndexedKeyframes =>
  kind === 'tx'
    ? {transform: [`translateX(${a}px)`, 'none']}
    : kind === 'number'
      ? {[dxVar]: [`${a}px`, '0px'], [widthDeltaVar]: [b!, 0]}
      : {[kind === 'spin' ? deltaVar : opacityDeltaVar]: [a!, 0]}

// Only timings whose effect value we can reproduce exactly:
const toContribution = (
  from: number[],
  t: EffectTiming,
): Contribution | null => {
  const easing = typeof t.easing === 'string' ? t.easing : 'linear'
  const info = easingInfo(easing)
  if (
    !info ||
    typeof t.duration !== 'number' ||
    !(t.duration > 0) ||
    !isFinite(t.duration) ||
    (t.iterations ?? 1) !== 1 ||
    (t.iterationStart ?? 0) !== 0 ||
    (t.direction ?? 'normal') !== 'normal' ||
    !['auto', 'none'].includes(t.fill ?? 'auto') ||
    !isFinite(t.delay ?? 0) ||
    !isFinite(t.endDelay ?? 0)
  )
    return null
  return {
    from,
    start: 0,
    delay: t.delay ?? 0,
    duration: t.duration,
    endDelay: t.endDelay ?? 0,
    easing,
    ease: info.fn,
    stops: info.stops,
    overshoots: info.overshoots,
  }
}

const inFlight = (a: Animation) =>
  a.playState !== 'finished' && a.playState !== 'idle'

const localTime = (ch: Channel): number | null => {
  const a = ch.anims[0]
  if (!a || !inFlight(a)) return null
  const t = a.currentTime
  return typeof t === 'number' ? t : null
}

const activeEnd = (c: Contribution) => c.start + c.delay + c.duration

// Re-base the stack onto a new animation starting now:
const shift = (contribs: Contribution[], by: number) =>
  contribs
    .map((c) => ({...c, start: c.start - by}))
    .filter((c) => activeEnd(c) > 0)

const IDENTITY = /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/
const opacityBase = (el: HTMLElement) =>
  parseFloat(el.style.getPropertyValue(opacityDeltaVar)) || 0

// Author styles on ::part()s can override the stylesheet's transform/opacity,
// in which case the accumulate path behaves differently (it builds on top of
// the override, or has no effect at all). Keep that path for such targets:
const overridden = (ch: Channel): boolean => {
  const {el, kind} = ch
  if (kind === 'tx') return getComputedStyle(el).transform !== 'none'
  if (kind === 'opacity')
    return (
      Math.abs(
        parseFloat(getComputedStyle(el).opacity) -
          clamp(0, 1 + opacityBase(el), 1),
      ) > 1e-6
    )
  if (kind === 'number') {
    const inner = el.firstElementChild as HTMLElement | null
    return (
      !inner ||
      !(parseFloat(el.style.getPropertyValue('--width')) > 0) ||
      !IDENTITY.test(getComputedStyle(el).transform) ||
      !IDENTITY.test(getComputedStyle(inner).transform)
    )
  }
  return false
}

// Everything besides the deltas that the stylesheet reads:
const readInputs = (ch: Channel): string => {
  const {el, kind} = ch
  if (kind === 'spin')
    return [
      el.style.getPropertyValue('--current'),
      ...Array.from(el.children, (n) => +n.hasAttribute('inert')),
    ].join()
  if (kind === 'number') return el.style.getPropertyValue('--width')
  if (kind === 'opacity') return String(opacityBase(el))
  return ''
}

// Precision the re-baked keyframes keep, in CSS px (opacity: its own unit):
const PX = 0.01
const OPACITY = 0.0001
// See the mask in bake(): 1.42/512 is still under 1/255.
const MASK = 1 / 512

// `unit`: how many px one unit of the channel's delta moves things (a spin
// moves by whole numerals), to hold every channel to the same precision:
type Plan = {ch: Channel; contribs: Contribution[]; unit: number}

export const flush = (scope: object) => {
  const reqs = pending.get(scope) ?? []
  pending.delete(scope)

  const groups = new Map<Channel, Req[]>()
  const legacy: Req[] = []
  reqs.forEach((r) => {
    if (!r.kind) {
      legacy.push(r)
      return
    }
    const ch = channel(r.el, r.kind)
    const group = groups.get(ch)
    if (group) group.push(r)
    else groups.set(ch, [r])
  })
  spins.get(scope)?.forEach((ch) => {
    if (!groups.has(ch)) groups.set(ch, [])
  })

  // Read everything first, so the checks cost one style update at most:
  const plans: Plan[] = []
  const demote: {ch: Channel; contribs: Contribution[]}[] = []
  const plan = (ch: Channel, contribs: Contribution[]) =>
    plans.push({
      ch,
      contribs,
      unit: ch.kind === 'spin' ? ch.el.offsetHeight || 100 : 1,
    })
  groups.forEach((rs, ch) => {
    ch.legacy = ch.legacy.filter(inFlight)
    const t = localTime(ch)
    const rest = t == null ? [] : shift(ch.contribs, t)
    if (!rs.length) {
      if (!rest.length) spins.get(scope)?.delete(ch)
      else if (readInputs(ch) !== ch.inputs) plan(ch, rest)
      return
    }
    const added = rs.map((r) => toContribution(r.from, r.timing))
    if (
      ch.legacy.length ||
      added.some((c) => !c) ||
      (!rest.length && overridden(ch))
    ) {
      if (rest.length) demote.push({ch, contribs: rest})
      legacy.push(...rs)
    } else plan(ch, rest.concat(added as Contribution[]))
  })

  // Start everything from this update together, like the pending
  // accumulate animations did:
  const now = document.timeline?.currentTime

  // A stack that has to continue on the accumulate path (e.g. a timing we
  // can't reproduce arrived mid-flight) goes back to its original
  // animations, started back when they did:
  demote.forEach(({ch, contribs}) => {
    ch.anims.forEach((a) => a.finish())
    ch.anims = []
    ch.contribs = []
    contribs.forEach((c) => {
      const a = ch.el.animate(original(ch.kind, c.from), {
        duration: c.duration,
        delay: c.delay,
        endDelay: c.endDelay,
        easing: c.easing,
        composite: 'accumulate',
      })
      if (typeof now === 'number') a.startTime = now + c.start
      ch.legacy.push(a)
    })
  })
  legacy.forEach((r) => {
    const a = r.el.animate(r.keyframes, {...r.timing, composite: 'accumulate'})
    if (r.kind) channel(r.el, r.kind).legacy.push(a)
  })

  const memo = new Map<string, Grid>()
  plans.forEach(({ch, contribs, unit}) => {
    // finish() rather than cancel(): it resolves `finished` instead of
    // rejecting it, and either way the effect is gone before the next frame:
    ch.anims.forEach((a) => a.finish())
    ch.contribs = contribs
    ch.inputs = readInputs(ch)
    ch.anims = bake(ch, contribs, unit, memo).map(({el, keyframes, timing}) => {
      const a = el.animate(keyframes, timing)
      if (typeof now === 'number') a.startTime = now
      return a
    })
    if (ch.kind === 'spin') {
      let set = spins.get(scope)
      if (!set) spins.set(scope, (set = new Set()))
      set.add(ch)
    }
  })
}

// ---------------------------------------------------------------------------
// Baking
// ---------------------------------------------------------------------------

type Sample = {x: number; v: number[]}
type Target = {el: HTMLElement; keyframes: Keyframe[]; timing: EffectTiming}

// Sampling step for easings that aren't piecewise linear (ms):
const GRID = 1000 / 240
// Dense progress sampling for the nonlinear inverse scale:
const INVERSE_SAMPLES = 64

// Where to sample a stack over time and how much of each contribution is
// left there: exactly at the points of piecewise-linear easings, on a fine
// grid for curves, with both sides of any start. Channels re-baked together
// mostly share their stack's timings, so this is memoized per flush:
type Grid = {x: number[]; w: number[][]; end: number; endDelay: number}
const grid = (contribs: Contribution[], memo: Map<string, Grid>): Grid => {
  const key = contribs
    .map((c) => [c.start, c.delay, c.duration, c.endDelay, c.easing].join())
    .join('|')
  let g = memo.get(key)
  if (g) return g
  const end = Math.max(...contribs.map(activeEnd))
  const times = [0, end]
  contribs.forEach((c) => {
    const a = c.start + c.delay
    const b = a + c.duration
    times.push(a, b)
    if (c.stops) c.stops.forEach((s) => times.push(a + s * c.duration))
    else for (let t = a + GRID; t < b; t += GRID) times.push(t)
  })
  times.sort((a, b) => a - b)
  // From the right or from the left of t (they only differ where a
  // contribution's active phase starts):
  const weights = (t: number, left: boolean) =>
    contribs.map((c) => {
      const p = (t - c.start - c.delay) / c.duration
      return (left ? p <= 0 || p > 1 : p < 0 || p >= 1) ? 0 : 1 - c.ease(p)
    })
  const x: number[] = []
  const w: number[][] = []
  let prev = NaN
  times.forEach((t) => {
    if (t < 0 || t > end || t === prev) return
    prev = t
    if (t > 0) {
      x.push(t / end)
      w.push(weights(t, true))
    }
    if (t < end) {
      const right = weights(t, false)
      const last = w[w.length - 1]
      if (!last || right.some((v, i) => v !== last[i])) {
        x.push(t / end)
        w.push(right)
      }
    }
  })
  g = {
    x,
    w,
    end,
    endDelay: Math.max(
      0,
      Math.max(...contribs.map((c) => activeEnd(c) + c.endDelay)) - end,
    ),
  }
  memo.set(key, g)
  return g
}

const bake = (
  ch: Channel,
  contribs: Contribution[],
  unit: number,
  memo: Map<string, Grid>,
): Target[] => {
  const dims = contribs[0]!.from.length
  const only = contribs.length === 1 ? contribs[0]! : null
  let samples: Sample[]
  let timing: EffectTiming
  let end = 0
  let endDelay = 0

  // A lone animation starting now keeps its own easing: keyframes are laid
  // out in eased progress, where every channel is exactly piecewise linear.
  // An overshooting easing would extrapolate past the last keyframe, which is
  // only exact for channels that stay linear throughout:
  const fresh =
    !!only &&
    only.start === 0 &&
    !(only.overshoots && (ch.kind === 'spin' || ch.kind === 'number'))
  if (fresh) {
    const n = ch.kind === 'number' ? INVERSE_SAMPLES : 1
    samples = []
    for (let k = 0; k <= n; k++)
      samples.push({x: k / n, v: only.from.map((f) => f * (1 - k / n))})
    timing = {
      duration: only.duration,
      delay: only.delay,
      endDelay: only.endDelay,
      easing: only.easing,
    }
  } else {
    const g = grid(contribs, memo)
    samples = g.x.map((x, j) => ({
      x,
      v: Array.from({length: dims}, (_, i) =>
        contribs.reduce((sum, c, k) => sum + c.from[i]! * g.w[j]![k]!, 0),
      ),
    }))
    end = g.end
    endDelay = g.endDelay
    timing = {duration: end, endDelay, easing: 'linear'}
  }

  const {el} = ch

  if (ch.kind === 'number') {
    const width = parseFloat(el.style.getPropertyValue('--width'))
    const inner = el.firstElementChild as HTMLElement
    const scale = (dW: number) => 1 + dW / width
    // The scales are held to the same precision over the element's width:
    const outer = simplify(
      samples.map((s) => [s.x, s.v[0]!, scale(s.v[1]!)]),
      [PX, PX / width],
    ).map(([offset, dx, sx]) => ({
      offset,
      transform: `translateX(${dx}px) scaleX(${sx})`,
    }))
    const inv = simplify(
      samples.map((s) => [s.x, 1 / scale(s.v[1]!), -s.v[0]!]),
      [PX / width, PX],
    ).map(([offset, sx, dx]) => ({
      offset,
      transform: `scaleX(${sx}) translateX(${dx}px)`,
    }))
    const targets: Target[] = [
      {el, keyframes: outer, timing},
      {el: inner, keyframes: inv, timing},
    ]
    // The mask's fade is divided by the scale (through --scale-x) to keep its
    // width on screen, and masks can't animate on the compositor. So the
    // width delta keeps animating on the main thread, but only for as long as
    // a mask left at rest would be off by more than an 8-bit alpha step
    // (which |1 - 1/scale| bounds, corners included, below MASK):
    const g = grid(contribs, memo)
    const dWs = g.x.map((x, j) => [
      x * g.end,
      contribs.reduce((sum, c, k) => sum + c.from[1]! * g.w[j]![k]!, 0),
    ])
    let last = -1
    dWs.forEach(([, dW], j) => {
      if (Math.abs(1 - 1 / scale(dW!)) > MASK) last = j
    })
    if (last >= 0) {
      const until = dWs[last + 1]![0]!
      targets.push({
        el,
        keyframes: simplify(
          dWs.slice(0, last + 2).map(([t, dW]) => [t! / until, dW!]),
          [PX],
        ).map(([offset, dW]) => ({offset, [widthDeltaVar]: dW})),
        timing: {duration: until},
      })
    }
    return targets
  }

  // The rest are one-dimensional: each target shows a piecewise-linear
  // function F of the summed delta d, with kinks or jumps at `breaks`.
  type Target1 = {
    el: HTMLElement
    F: (d: number) => number
    breaks: (lo: number, hi: number) => number[]
    frame: (y: number) => Keyframe
  }
  const ds = samples.map((s) => s.v[0]!)
  const lo = Math.min(...ds)
  const hi = Math.max(...ds)
  const targets: Target1[] = []
  let tol: number
  if (ch.kind === 'tx') {
    tol = PX
    targets.push({
      el,
      F: (d) => d,
      breaks: () => [],
      frame: (y) => ({transform: `translateX(${y}px)`}),
    })
  } else if (ch.kind === 'opacity') {
    tol = OPACITY
    const base = opacityBase(el)
    targets.push({
      el,
      F: (d) => clamp(0, 1 + base + d, 1),
      // Clamping kinks where the sum crosses 0 or 1:
      breaks: (from, to) =>
        [-1 - base, -base].filter((b) => b > from && b < to),
      frame: (opacity) => ({opacity}),
    })
  } else {
    // Spin: numerals clamp to ±100%, just outside the mask, beyond 1 of the
    // current position, and wrap around while there. Only the ones that come
    // within 1 at some point are ever seen moving, so only they animate:
    tol = PX / unit
    const current = parseFloat(el.style.getPropertyValue('--current')) || 0
    const nums = Array.from(el.children) as HTMLElement[]
    const length = nums.length
    nums.forEach((num, n) => {
      // Where the numeral's offset clamps or wraps around, as values of d:
      const periodic = [n - 1, n + 1, n - length / 2].map((b) =>
        cssMod(b - current, length),
      )
      // Within 1 somewhere on (lo, hi): some n - 1 + k*length in (lo - 2, hi)
      // (with no room to clamp in a length of 2 or less):
      const first =
        periodic[0]! + Math.floor((lo - 2 - periodic[0]!) / length + 1) * length
      if (!(hi > lo && (length <= 2 || first < hi))) return
      const inert = num.hasAttribute('inert')
      targets.push({
        el: num,
        F: (d) => digitYPercent(current + d, length, n),
        breaks: (from, to) => {
          const out: number[] = []
          periodic.forEach((b) => {
            for (
              let k = Math.ceil((from - b) / length);
              b + k * length < to;
              k++
            )
              if (b + k * length > from) out.push(b + k * length)
          })
          return out
        },
        frame: (y) => ({
          transform: inert
            ? `translateX(-50%) translateY(${y}%)`
            : `translateY(${y}%)`,
        }),
      })
    })
  }

  // When re-baking, the summed delta follows one curve over time, shared by
  // all of the channel's targets. It becomes the easing (a linear() through
  // the normalized samples), so each target only needs keyframes where its
  // own function bends:
  const shared = !fresh && hi > lo
  const curve = shared
    ? {
        duration: end,
        endDelay,
        easing: `linear(${simplify(
          samples.map((s) => [s.x, (s.v[0]! - lo) / (hi - lo)]),
          [tol / (hi - lo)],
        )
          .map(([x, g]) => `${g} ${x! * 100}%`)
          .join(', ')})`,
      }
    : timing
  return targets.map(({el: target, F, breaks, frame}) => ({
    el: target,
    keyframes: (shared
      ? piecewise(
          [
            {x: 0, v: [lo]},
            {x: 1, v: [hi]},
          ],
          F,
          breaks,
        )
      : simplify(piecewise(samples, F, breaks), [tol])
    ).map(([offset, y]) => ({offset, ...frame(y!)})),
    timing: curve,
  }))
}

type Point = number[] // [x, ...values]

// Maps samples of a channel value d (linear between samples) through a
// piecewise function F, inserting its kinks and jumps (at the given breaks
// of d) as extra points. Jumps become two points at the same offset (the
// later one wins there, like on the compositor, which keeps keyframe times
// in whole microseconds). They only happen between hidden resting spots:
const piecewise = (
  samples: Sample[],
  F: (d: number) => number,
  breaks: (lo: number, hi: number) => number[],
): Point[] => {
  const out: Point[] = []
  const push = (x: number, y: number) => {
    const last = out[out.length - 1]
    if (!last || last[0] !== x || last[1] !== y) out.push([x, y])
  }
  // F just to one side of d, where that differs from F(d) (a jump):
  const side = (d: number, s: number) => {
    const y = F(d + s * 1e-9 * Math.max(1, Math.abs(d)))
    return Math.abs(y - F(d)) < 1e-4 ? F(d) : y
  }
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]!
    const b = samples[i + 1]!
    const da = a.v[0]!
    const db = b.v[0]!
    const dir = Math.sign(db - da)
    push(a.x, side(da, dir))
    if (dir) {
      const within = breaks(Math.min(da, db), Math.max(da, db))
      within.sort((p, q) => (p - q) * dir)
      within.forEach((d) => {
        const x = a.x + ((d - da) / (db - da)) * (b.x - a.x)
        push(x, side(d, -dir))
        push(x, side(d, dir))
      })
    }
    push(b.x, side(db, -dir))
  }
  return out
}

// Drops points that the line between the kept ones already reproduces within
// `tol` (per value), keeping jumps intact. Tracks, per value, the range of
// slopes from the last kept point that stay within `tol` of everything
// skipped since, so it runs in linear time:
const simplify = (pts: Point[], tol: number[]): Point[] => {
  if (pts.length <= 2) return pts
  const out: Point[] = [pts[0]!]
  let a = pts[0]!
  let lo: number[] = []
  let hi: number[] = []
  const reset = () => {
    lo = tol.map(() => -Infinity)
    hi = tol.map(() => Infinity)
  }
  reset()
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!
    const next = pts[i + 1]!
    const dx = p[0]! - a[0]!
    // Keep both sides of a jump, and whatever the next point can't reach:
    let keep = !dx || next[0] === p[0]
    if (!keep) {
      const ndx = next[0]! - a[0]!
      for (let k = 0; k < tol.length; k++) {
        lo[k] = Math.max(lo[k]!, (p[k + 1]! - tol[k]! - a[k + 1]!) / dx)
        hi[k] = Math.min(hi[k]!, (p[k + 1]! + tol[k]! - a[k + 1]!) / dx)
        const slope = (next[k + 1]! - a[k + 1]!) / ndx
        if (slope < lo[k]! || slope > hi[k]!) keep = true
      }
    }
    if (keep) {
      out.push(p)
      a = p
      reset()
    }
  }
  out.push(pts[pts.length - 1]!)
  return out
}
