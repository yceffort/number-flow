export type EasingFn = (t: number) => number

const linear: EasingFn = (t) => t

// Newton-Raphson + bisection fallback, based on the standard bezier-easing algorithm:
export const cubicBezier = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EasingFn => {
  if (x1 === y1 && x2 === y2) return linear

  const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1
  const b = (a1: number, a2: number) => 3 * a2 - 6 * a1
  const c = (a1: number) => 3 * a1

  const calc = (t: number, a1: number, a2: number) =>
    ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t
  const slope = (t: number, a1: number, a2: number) =>
    3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1)

  const solveX = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2)
      if (s === 0) break
      t -= (calc(t, x1, x2) - x) / s
      t = Math.min(1, Math.max(0, t))
    }
    // Verify; fall back to bisection if Newton drifted:
    if (Math.abs(calc(t, x1, x2) - x) > 1e-5) {
      let lo = 0,
        hi = 1
      t = x
      while (hi - lo > 1e-7) {
        t = (lo + hi) / 2
        if (calc(t, x1, x2) < x) lo = t
        else hi = t
      }
    }
    return t
  }

  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return calc(solveX(t), y1, y2)
  }
}

type LinearStop = {v: number; pos: number | null}

// Parses the body of linear(...) per the CSS spec (values with optional percentages):
const parseLinearBody = (body: string): EasingFn | null => {
  const stops: LinearStop[] = []
  for (const entry of body.split(',')) {
    const tokens = entry.trim().split(/\s+/).filter(Boolean)
    if (!tokens.length) return null
    const v = parseFloat(tokens[0]!)
    if (isNaN(v)) return null
    const positions = tokens.slice(1).map((t) => {
      if (!t.endsWith('%')) return NaN
      return parseFloat(t) / 100
    })
    if (positions.some(isNaN) || positions.length > 2) return null
    if (positions.length === 0) stops.push({v, pos: null})
    else positions.forEach((pos) => stops.push({v, pos}))
  }
  if (stops.length < 2) return null

  // Fill in missing positions: first defaults to 0, last to 1,
  // in-between spaced evenly between the surrounding specified positions.
  // Positions are also forced to be monotonically non-decreasing:
  if (stops[0]!.pos == null) stops[0]!.pos = 0
  if (stops[stops.length - 1]!.pos == null) stops[stops.length - 1]!.pos = 1
  let prevSpecified = 0
  for (let i = 1; i < stops.length; i++) {
    if (stops[i]!.pos != null) {
      stops[i]!.pos = Math.max(stops[i]!.pos!, stops[prevSpecified]!.pos!)
      const gap = i - prevSpecified
      for (let j = prevSpecified + 1; j < i; j++) {
        stops[j]!.pos =
          stops[prevSpecified]!.pos! +
          ((stops[i]!.pos! - stops[prevSpecified]!.pos!) *
            (j - prevSpecified)) /
            gap
      }
      prevSpecified = i
    }
  }

  const points = stops as Array<{v: number; pos: number}>
  return (t) => {
    if (t <= points[0]!.pos) return points[0]!.v
    if (t >= points[points.length - 1]!.pos) return points[points.length - 1]!.v
    // Binary search for the segment:
    let lo = 0,
      hi = points.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (points[mid]!.pos <= t) lo = mid
      else hi = mid
    }
    const a = points[lo]!,
      b = points[hi]!
    if (b.pos === a.pos) return b.v
    return a.v + ((b.v - a.v) * (t - a.pos)) / (b.pos - a.pos)
  }
}

const steps =
  (count: number, position: string): EasingFn =>
  (t) => {
    if (t >= 1) return 1
    if (t <= 0) return 0
    const step = Math.floor(t * count)
    switch (position) {
      case 'start':
      case 'jump-start':
        return Math.min(1, (step + 1) / count)
      case 'jump-none':
        return Math.min(1, step / (count - 1))
      case 'jump-both':
        return (step + 1) / (count + 1)
      default: // end / jump-end
        return step / count
    }
  }

const KEYWORDS: Record<string, () => EasingFn> = {
  linear: () => linear,
  ease: () => cubicBezier(0.25, 0.1, 0.25, 1),
  'ease-in': () => cubicBezier(0.42, 0, 1, 1),
  'ease-out': () => cubicBezier(0, 0, 0.58, 1),
  'ease-in-out': () => cubicBezier(0.42, 0, 0.58, 1),
  'step-start': () => steps(1, 'start'),
  'step-end': () => steps(1, 'end'),
}

const cache = new Map<string, EasingFn>()
let warned = false

export const parseEasing = (easing?: string): EasingFn => {
  if (!easing) return linear
  const cached = cache.get(easing)
  if (cached) return cached

  let fn: EasingFn | null = null
  const trimmed = easing.trim()
  const keyword = KEYWORDS[trimmed]
  if (keyword) fn = keyword()
  else {
    const match = /^([a-z-]+)\((.*)\)$/i.exec(trimmed)
    if (match) {
      const [, name, body] = match
      if (name === 'linear') fn = parseLinearBody(body!)
      else if (name === 'cubic-bezier') {
        const args = body!.split(',').map((s) => parseFloat(s))
        if (args.length === 4 && args.every((n) => !isNaN(n)))
          fn = cubicBezier(args[0]!, args[1]!, args[2]!, args[3]!)
      } else if (name === 'steps') {
        const [countStr, pos] = body!.split(',').map((s) => s.trim())
        const count = parseInt(countStr!)
        if (count > 0) fn = steps(count, pos ?? 'end')
      }
    }
  }

  if (!fn) {
    if (!warned) {
      warned = true
      console.warn(
        `[number-flow] Unsupported easing "${easing}", falling back to linear.`,
      )
    }
    fn = linear
  }
  cache.set(easing, fn)
  return fn
}
