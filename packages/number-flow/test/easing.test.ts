import {describe, expect, it} from 'vitest'

import {cubicBezier, parseEasing} from '../src/engine/easing'

// The default spring easing from lite.ts:
const SPRING = `linear(0,.005,.019,.039,.066,.096,.129,.165,.202,.24,.278,.316,.354,.39,.426,.461,.494,.526,.557,.586,.614,.64,.665,.689,.711,.731,.751,.769,.786,.802,.817,.831,.844,.856,.867,.877,.887,.896,.904,.912,.919,.925,.931,.937,.942,.947,.951,.955,.959,.962,.965,.968,.971,.973,.976,.978,.98,.981,.983,.984,.986,.987,.988,.989,.99,.991,.992,.992,.993,.994,.994,.995,.995,.996,.996,.9963,.9967,.9969,.9972,.9975,.9977,.9979,.9981,.9982,.9984,.9985,.9987,.9988,.9989,1)`

describe('parseEasing', () => {
  it('parses the default spring linear() easing', () => {
    const fn = parseEasing(SPRING)
    expect(fn(0)).toBe(0)
    expect(fn(1)).toBe(1)
    // 90 points evenly spaced; point i sits at i/89:
    expect(fn(1 / 89)).toBeCloseTo(0.005, 5)
    expect(fn(45 / 89)).toBeCloseTo(0.947, 5)
    // Interpolates between points:
    expect(fn(1.5 / 89)).toBeCloseTo((0.005 + 0.019) / 2, 5)
    // Monotonic:
    let prev = -1
    for (let t = 0; t <= 1; t += 0.01) {
      const v = fn(t)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('parses linear() with explicit percentages', () => {
    const fn = parseEasing('linear(0, 0.5 25%, 1)')
    expect(fn(0.25)).toBeCloseTo(0.5, 5)
    expect(fn(0.125)).toBeCloseTo(0.25, 5)
    expect(fn(0.625)).toBeCloseTo(0.75, 5)
  })

  it('parses cubic-bezier() and keywords', () => {
    const easeOut = parseEasing('ease-out')
    expect(easeOut(0)).toBe(0)
    expect(easeOut(1)).toBe(1)
    // ease-out rises faster than linear early on:
    expect(easeOut(0.25)).toBeGreaterThan(0.25)

    const custom = parseEasing('cubic-bezier(0.33, 1, 0.68, 1)')
    expect(custom(0.5)).toBeGreaterThan(0.5)
  })

  it('cubic-bezier matches known reference values', () => {
    // linear via bezier:
    const linear = cubicBezier(0.25, 0.25, 0.75, 0.75)
    expect(linear(0.3)).toBeCloseTo(0.3, 4)
    // symmetric ease-in-out at midpoint:
    const inOut = cubicBezier(0.42, 0, 0.58, 1)
    expect(inOut(0.5)).toBeCloseTo(0.5, 4)
  })

  it('falls back to linear for unknown easings', () => {
    const fn = parseEasing('bounce(3)')
    expect(fn(0.42)).toBe(0.42)
  })
})
