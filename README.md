# @yceffort/number-flow

[![CI](https://github.com/yceffort/number-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/yceffort/number-flow/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@yceffort/number-flow)](https://www.npmjs.com/package/@yceffort/number-flow)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.md)
[![Storybook](https://img.shields.io/badge/Storybook-live-ff4785?logo=storybook&logoColor=white)](https://yceffort.github.io/number-flow/)

[English](./README.md) | [한국어](./README.ko.md)

> **Fork notice**: This is a fork of
> [barvian/number-flow](https://github.com/barvian/number-flow) (MIT, ©
> Maxwell Barvian). The formatting, DOM structure, and styles are kept from
> upstream; the animation driver is replaced with a hybrid (WAAPI/rAF)
> engine so that **the same animations work on much older browsers**.

**Live demo**: [Storybook](https://yceffort.github.io/number-flow/) — play
with the basic/currency/live-ticker/interrupt/forced-rAF/group/continuous
stories.

Upstream only animates when `linear()` easing (Safari 17.2+/Chrome 113+),
CSS `mod()`/`round()` (Safari 15.4+/Chrome 125+), and `@property` are all
supported — otherwise numbers swap instantly. This fork reproduces the same
spring animation with an rAF-based fallback engine when any of them are
missing.

## Installation

```bash
npm install @yceffort/number-flow-react   # React
npm install @yceffort/number-flow         # vanilla (web component)
```

The API is identical to upstream. Existing projects can switch without any
code changes via an alias:

```jsonc
// package.json — drop-in replacement, zero code changes
"dependencies": {
  "@number-flow/react": "npm:@yceffort/number-flow-react@^0.1.0"
}
```

```tsx
import NumberFlow from '@yceffort/number-flow-react'

;<NumberFlow value={value} suffix="원" />
```

## How it works

- **Modern browsers**: the exact same native path as upstream (WAAPI +
  `composite: 'accumulate'` + CSS `mod()` math). Runs on the compositor
  thread with zero performance cost.
- **Older browsers**: an rAF tween engine replicates WAAPI's
  `composite: 'accumulate'` semantics (summing the deltas of all active
  tweens).
  - The spring `linear()` easing is interpolated from its 90 sample points,
    so **even the curve is identical**. `cubic-bezier()`, keywords,
    `steps()`, and custom `linear()` strings are parsed too.
  - `--_number-flow-dx`, `--scale-x`, etc. are written as inline styles
    every frame, so the upstream stylesheet consumes them unchanged.
  - The digit spin ports the CSS `mod()`/`round()` math to JS and computes
    each `.digit__num`'s `--y` directly.
  - A setTimeout backstop ticker keeps animations finishing when rAF is
    throttled (backgrounded WebViews, etc.), which closes the known paths to
    upstream's [overlapping-values issue
    #148](https://github.com/barvian/number-flow/issues/148).

## Browser support

|                                | Upstream | This fork                             |
| ------------------------------ | -------- | ------------------------------------- |
| iOS Safari (every iOS browser) | 17.2+    | **~13+** (WebKit 16.4 verified)       |
| Android Chrome / WebView       | 125+     | **66+** (verified with real binaries) |
| Desktop Chrome                 | 125+     | **66+** (verified with real binaries) |

Below that, it gracefully falls back to the same behavior as upstream:
values swap instantly without animation. The floor is set by
`Intl.NumberFormat.formatToParts` (Chrome 64/Safari 13) and
`AbortController` (Chrome 66/Safari 12.1).

The floor is enforced three ways: a `.browserslistrc` declaration, an
`eslint-plugin-compat` check in CI, and a CI job that runs the selftest on
real Chromium 66/80/114 binaries.

### Verified matrix (all real binaries/engines)

- **Chromium 66 / 71 / 75 / 80 / 87 / 92 / 100 / 114**: auto-detects the
  rAF fallback, 44 assertions PASS
- **WebKit 16.4** (≈ iOS/macOS Safari 16.4): auto-detects the rAF fallback,
  PASS — animates where upstream turns animations off
- **WebKit 17.4 / 18.2**: native path — 42 of 44 on macOS builds, 43 of 44
  on the Linux builds CI runs. The width-scale (and, on macOS, enter-fade)
  assertions fail **identically on upstream**. See
  [Known issues](#known-issues); fixed in WebKit 26, and passes with rAF
  forced
- **Latest Chromium / Firefox / WebKit 26.x**: PASS on both native and
  forced-rAF paths
- **Next.js 16 (React 19) SSR**: server markup + hydration smoke PASS

## Additional APIs (on top of upstream)

- `setEngineMode('auto' | 'native' | 'raf')` — force an engine. Must be
  called before any animations start.
- `supportsNativeAnimations` — whether this browser takes the native path.
- `canAnimate` — now `true` whenever rAF exists (upstream requires all
  three CSS features).

## Differences from upstream (honest limitations)

- The fallback path runs on the **main thread**, so frames can drop when
  the main thread is very busy. Modern browsers use the native path and are
  unaffected.
- In the fallback, `EffectTiming` supports only
  `duration`/`delay`/`easing` (`iterations` etc. are ignored).
- On browsers without `mix-blend-mode: plus-lighter`, the ± sign crossfade
  degrades slightly to a plain fade.
- Vue/Svelte wrappers are not ported yet (the core is identical, so they
  can be added following the upstream wrappers).

## Known issues

**Safari 17.4+ drops the width-scale tween and the enter fade** (upstream
`number-flow` is affected the same way; this is a WebKit bug, not something
this fork introduced).

Once **three or more animations run concurrently inside the same shadow
root**, WebKit stops feeding the animated value of a registered custom
property into `var()` substitution for other properties on the _same_
element. `getComputedStyle` still reports the animated value, but style
resolution uses the static declaration, so:

- `.number`'s `--scale-x: calc(1 + var(--_number-flow-d-width) / var(--width))`
  resolves as if the delta were `0` → the number never scales while its
  width changes.
- `.animate-presence`'s `opacity: calc(1 + var(--_number-flow-d-opacity))`
  does the same → newly added characters appear without fading in. This one
  is build-dependent: it reproduces on the macOS WebKit builds (what
  iOS/macOS Safari users actually run) but not on the Linux builds CI uses.

Digit spinning is unaffected: `--_number-flow-d` is registered with
`inherits: true` and is consumed by a _child_ (`.digit__num`), which
sidesteps the bug. Final values, layout, text and accessibility are all
correct — only these two mid-flight visual effects are missing.

Three animations is a threshold any real update crosses, so on affected
versions this is effectively always on. Safari 16.4 and older auto-select
the rAF fallback and are unaffected, and **WebKit 26 fixes it** — so this
only bites Safari 17.4 through 18.x.

It cannot be feature-detected synchronously, which is why there is no
automatic downgrade: setting `Animation.currentTime` by hand resolves
styles correctly, so a probe never reproduces the bug.

If the missing effects matter more to you than staying on the native path,
opt into the fallback engine explicitly — it renders both correctly on
every WebKit version:

```js
import {setEngineMode} from '@yceffort/number-flow'

setEngineMode('raf') // before any animation starts
```

`pnpm test:webkit` covers this; CI runs it as a non-blocking `old-webkit`
job so the failures stay visible without breaking the pipeline. Versions
whose WebKit build can't launch on the runner are reported as `SKIP` rather
than counted as failures.

## Development

```bash
pnpm install
pnpm build        # build packages/*
pnpm test         # engine unit tests (easing parser, mod math, additive compositing)
pnpm lint         # oxlint --type-aware
pnpm lint:compat  # browser API check against the browserslist floor
pnpm format       # oxfmt
pnpm dev          # comparison demo: native vs rAF fallback vs upstream
```

## Browser testing

`demo/selftest.html` is a self-verifying page that runs five scenarios in
the browser (spin + width change, interrupt bursts, sign crossfade, live
ticker, cleanup state) and reports the results.

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

WebKit ↔ Safari mapping (using the build pinned by each Playwright
release):

| Input         | WebKit      | Playwright  | Notes                                                    |
| ------------- | ----------- | ----------- | -------------------------------------------------------- |
| `16` / `16.4` | 16.4        | 1.33        | ≈ Safari 16.4. No `linear()` → auto-selects rAF fallback |
| `17.0`        | 17.0        | 1.36        |                                                          |
| `17` / `17.4` | 17.4        | 1.40        | native path                                              |
| `18.0` / `18` | 18.0 / 18.2 | 1.48 / 1.49 | native path                                              |
| latest (26.x) | 26.x        | current     | covered by `pnpm e2e`                                    |

WebKit builds for Safari 16.0–16.3 (playwright ≤1.31) hang on current
macOS and can't be tested locally. Chromium is verifiable headless from
M66 and headed from M87 (earlier GUIs crash under Rosetta). The old-Chrome
runner avoids CDP client compatibility issues by running the selftest via
`--headless --dump-dom`; the page delays the load event until verification
completes to trigger the dump. On Apple Silicon, pre-M91 builds run as x64
snapshots under Rosetta (`softwareupdate --install-rosetta`).

## License

[MIT](./LICENSE.md). Original
[number-flow](https://github.com/barvian/number-flow) ©
[Maxwell Barvian](https://barvian.me) —
[upstream license](https://github.com/barvian/number-flow/blob/main/LICENSE.md).
