# @yceffort/number-flow

[![CI](https://github.com/yceffort/number-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/yceffort/number-flow/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@yceffort/number-flow)](https://www.npmjs.com/package/@yceffort/number-flow)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.md)
[![Storybook](https://img.shields.io/badge/Storybook-live-ff4785?logo=storybook&logoColor=white)](https://yceffort.github.io/number-flow/)

[English](./README.md) | [한국어](./README.ko.md)

> **Fork notice**: This is a fork of [barvian/number-flow](https://github.com/barvian/number-flow) (MIT, © Maxwell Barvian). The formatting, DOM structure, and styles are kept from upstream; the animation driver is replaced with a hybrid (WAAPI/rAF) engine, so the same animations **work on much older browsers** and, on modern ones, **run on the compositor** instead of restyling every digit on the main thread each frame.

**Live demo**: [Storybook](https://yceffort.github.io/number-flow/) — eight stories covering basic / currency / percentage / live ticker / interrupt / forced rAF / group / the continuous plugin (the sidebar names are in Korean).

Upstream only animates when `linear()` easing (Safari 17.2+/Chrome 113+), CSS `mod()`/`round()` (Safari 15.4+/Chrome 125+), and `@property` are all supported — otherwise numbers swap instantly. This fork reproduces the same spring animation with an rAF-based fallback engine when any of them are missing.

## Installation

```bash
npm install @yceffort/number-flow-react   # React
npm install @yceffort/number-flow         # vanilla (web component)
```

The API is identical to upstream. Existing projects can switch without any code changes via an alias:

```jsonc
// package.json — drop-in replacement, zero code changes
"dependencies": {
  "@number-flow/react": "npm:@yceffort/number-flow-react@^0.2.0"
}
```

```tsx
import NumberFlow from '@yceffort/number-flow-react'

;<NumberFlow value={value} suffix="%" />
```

## How it works

- **Modern browsers**: the same motion as upstream's native path, produced so the compositor can run it. Upstream animates registered custom properties with `composite: 'accumulate'` and derives transforms from them with CSS `mod()` math. No browser can run that off the main thread, so every frame restyles every digit ([#10](https://github.com/yceffort/number-flow/issues/10)). Here each element gets one `composite: 'replace'` `transform` or `opacity` animation whose keyframes are the values that math would produce. When an update interrupts one in flight, what is left of the running animations is re-baked into the new one, so positions and velocities stay what accumulate produces (within 0.03px in the parity tests).
  - Masks can't animate on the compositor, so while the number's width changes, the mask's fade keeps animating on the main thread until leaving it at rest would be off by less than an 8-bit alpha step. With `font-variant-numeric: tabular-nums`, widths only change when the number of characters does.
  - Author styles that set `transform` or `opacity` on a `::part()`, and timings the compositor path can't reproduce exactly (`steps()`, `iterations`, `direction`, `fill`), keep those targets on upstream's accumulate animations.
- **Older browsers**: an rAF tween engine replicates WAAPI's `composite: 'accumulate'` semantics (summing the deltas of all active tweens).
  - The spring `linear()` easing is interpolated from its 90 sample points, so **even the curve is identical**. `cubic-bezier()`, keywords, `steps()`, and custom `linear()` strings are parsed too.
  - `--_number-flow-dx`, `--scale-x`, etc. are written as inline styles every frame, so the upstream stylesheet consumes them unchanged.
  - The digit spin ports the CSS `mod()`/`round()` math to JS and computes each `.digit__num`'s `--y` directly.
  - A setTimeout backstop ticker keeps animations finishing when rAF is throttled (backgrounded WebViews, etc.), which closes the known paths to upstream's [overlapping-values issue #148](https://github.com/barvian/number-flow/issues/148).

## Browser support

|                                | Upstream | This fork                             |
| ------------------------------ | -------- | ------------------------------------- |
| iOS Safari (every iOS browser) | 17.2+    | **~13+** (WebKit 16.4 verified)       |
| Android Chrome / WebView       | 125+     | **66+** (verified with real binaries) |
| Desktop Chrome                 | 125+     | **66+** (verified with real binaries) |

The floor is set by `Intl.NumberFormat.formatToParts` (Chrome 64/Safari 13) and `AbortController` (Chrome 66/Safari 12.1).

The floor is enforced three ways: a `.browserslistrc` declaration, an `eslint-plugin-compat` check in CI, and a CI job that runs the selftest on real Chromium 66/80/114 binaries.

### Verified matrix (all real binaries/engines)

- **Chromium 66 / 71 / 75 / 80 / 87 / 92 / 100 / 114**: auto-detects the rAF fallback, 44 assertions PASS
- **WebKit 16.4** (≈ iOS/macOS Safari 16.4): auto-detects the rAF fallback, PASS — animates where upstream turns animations off
- **WebKit 17.4 / 18.2**: native path, 44 of 44 on macOS builds. Upstream fails the width-scale (and, on macOS, enter-fade) assertions there; see [Known issues](#known-issues)
- **Latest Chromium / Firefox / WebKit 26.x**: PASS on both native and forced-rAF paths
- **Next.js 16 (React 19) SSR**: server markup + hydration smoke PASS

### If something breaks anyway

Within the supported range, a misbehaving animation API degrades to a static-but-correct render, not a missing number. The value is always real DOM text (every digit keeps its 0–9 numerals and only the current one is shown), a failed transform computes to `none` (in place), and a failed enter fade leaves opacity at its initial `1` (shown immediately). The Safari 17.4 through 18.x `var()` bug below is the real-world example: upstream loses two visual effects there while values, layout, and accessibility stay correct. With SSR, the server-rendered fallback `<span>` also survives any client-side failure.

Below the floor there is no graceful degradation — updates throw. Chrome 64–65 lack `AbortController`, so an animated update throws right after the new value lands in the DOM (in React, an error boundary may then unmount the tree), and below Chrome 64/Safari 13 `formatToParts` is missing, so nothing renders client-side at all. If you need to reach lower than the floor, gate usage yourself.

## Additional APIs (on top of upstream)

- `setEngineMode('auto' | 'native' | 'raf')` — force an engine. Must be called before any animations start.
- `supportsNativeAnimations` — whether this browser _can_ take the native path. Static feature detection; `setEngineMode('raf')` does not change it.
- `canAnimate` — now `true` whenever rAF exists (upstream requires all three CSS features).

## Differences from upstream (honest limitations)

- The fallback path runs on the **main thread**, so frames can drop when the main thread is very busy. The native path runs on the compositor, except in the next two cases and for the `::part()` and timing exceptions in [How it works](#how-it-works).
- On the native path, an update that interrupts running animations re-bakes what is left of them, so it costs more main-thread time up front (about 15ms per update instead of 5ms in the 300ms-interrupt benchmark, 1x, Apple M5).
- With proportional digits most updates change the number's width, and the mask's fade then animates on the main thread for part of each animation. `font-variant-numeric: tabular-nums` avoids that (59 vs 14 ms/s of main-thread time in the issue benchmark at 1x).
- In the fallback, `EffectTiming` supports only `duration`/`delay`/`easing` (`iterations` etc. are ignored).
- On browsers without `mix-blend-mode: plus-lighter`, the ± sign crossfade degrades slightly to a plain fade.
- Vue/Svelte wrappers are not ported yet (the core is identical, so they can be added following the upstream wrappers).

## Known issues

None open.

Safari 17.4 through 18.x drops upstream's width-scale tween and enter fade. It's a WebKit bug, fixed in WebKit 26: once three or more animations run in the same shadow root, the animated value of a registered custom property stops reaching `var()` substitution in other properties of the same element, and upstream derives both effects that way (`--scale-x` from `--_number-flow-d-width`, the fade from `--_number-flow-d-opacity`). This fork's native path animates `transform` and `opacity` directly, so both play there too.

`pnpm test:webkit` runs the selftest on WebKit 16.4, 17.4 and 18.2 builds. The runner can keep assertions that fail because of an engine bug in a known-failure list (now empty), so the `old-webkit` CI job stays green while only those fail and anything else counts as a regression. It says so when a listed assertion starts passing. Versions whose WebKit build can't launch on the runner report `SKIP` instead of counting as failures.

## Development

```bash
pnpm install
pnpm build        # build packages/*
pnpm test         # engine unit tests (easing parser, mod math, additive compositing, compositor re-baking)
pnpm lint         # oxlint --type-aware
pnpm lint:compat  # browser API check against the browserslist floor
pnpm format       # oxfmt
pnpm dev          # comparison demo: native vs rAF fallback vs upstream
```

## Browser testing

`demo/selftest.html` is a self-verifying page that runs five scenarios in the browser (spin + width change, interrupt bursts, sign crossfade, live ticker, cleanup state) and reports the results.

```bash
pnpm e2e              # Playwright: selftest matrix + Next.js SSR hydration smoke
pnpm test:old-chrome  # real old Chromium snapshots: default M80/M87/M100/M114 (any milestone works)
pnpm test:webkit      # old WebKit: ≈ Safari 16.4/17.4/18.2
```

### Watching with your own eyes (headed mode)

```bash
pnpm open:old-chrome 87        # old Chromium window + comparison demo (any milestone ≥ 87)
pnpm open:webkit 17            # old WebKit window (specify by Safari version)
pnpm open:webkit --list        # list available versions
npx playwright test --headed   # latest 3-engine e2e with visible windows
```

WebKit ↔ Safari mapping (using the build pinned by each Playwright release):

| Input         | WebKit      | Playwright  | Notes                                                    |
| ------------- | ----------- | ----------- | -------------------------------------------------------- |
| `16` / `16.4` | 16.4        | 1.33        | ≈ Safari 16.4. No `linear()` → auto-selects rAF fallback |
| `17.0`        | 17.0        | 1.36        |                                                          |
| `17` / `17.4` | 17.4        | 1.40        | native path                                              |
| `18.0` / `18` | 18.0 / 18.2 | 1.48 / 1.49 | native path                                              |
| latest (26.x) | 26.x        | current     | covered by `pnpm e2e`                                    |

WebKit builds for Safari 16.0–16.3 (playwright ≤1.31) hang on current macOS and can't be tested locally. Chromium is verifiable headless from M66 and headed from M87 (earlier GUIs crash under Rosetta). The old-Chrome runner avoids CDP client compatibility issues by running the selftest via `--headless --dump-dom`; the page delays the load event until verification completes to trigger the dump. On Apple Silicon, pre-M91 builds run as x64 snapshots under Rosetta (`softwareupdate --install-rosetta`).

## License

[MIT](./LICENSE.md). Original [number-flow](https://github.com/barvian/number-flow) © [Maxwell Barvian](https://barvian.me) — [upstream license](https://github.com/barvian/number-flow/blob/main/LICENSE.md).
