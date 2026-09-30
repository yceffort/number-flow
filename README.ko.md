# @yceffort/number-flow

[![CI](https://github.com/yceffort/number-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/yceffort/number-flow/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@yceffort/number-flow)](https://www.npmjs.com/package/@yceffort/number-flow)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE.md)
[![Storybook](https://img.shields.io/badge/Storybook-live-ff4785?logo=storybook&logoColor=white)](https://yceffort.github.io/number-flow/)

[English](./README.md) | [한국어](./README.ko.md)

**라이브 데모**: [Storybook](https://yceffort.github.io/number-flow/) — 기본/통화/백분율/실시간 티커/인터럽트/rAF 폴백 강제/그룹/Continuous 플러그인 스토리를 직접 조작해볼 수 있습니다.

> **Fork notice**: 이 프로젝트는 [barvian/number-flow](https://github.com/barvian/number-flow) (MIT, © Maxwell Barvian)의 포크입니다. 포맷팅, DOM 구조, 스타일은 원본을 유지하고, 애니메이션 구동부를 하이브리드(WAAPI/rAF) 엔진으로 교체했습니다. 그래서 **구형 브라우저에서도 동일한 애니메이션이 동작**하고, 모던 브라우저에서는 매 프레임 메인 스레드에서 모든 자릿수의 스타일을 다시 계산하는 대신 **컴포지터에서 실행**됩니다.

원본은 `linear()` easing(Safari 17.2+/Chrome 113+), CSS `mod()`/`round()`(Safari 15.4+/Chrome 125+), `@property`가 모두 지원될 때만 애니메이션을 켜고, 하나라도 없으면 숫자가 즉시 교체됩니다. 이 포크는 그 세 가지가 없어도 rAF 기반 폴백 엔진으로 동일한 스프링 애니메이션을 재현합니다.

## 설치

```bash
npm install @yceffort/number-flow-react   # React
npm install @yceffort/number-flow         # 바닐라 (웹 컴포넌트)
```

API는 원본과 동일합니다. 기존 프로젝트라면 alias로 코드 수정 없이 교체할 수 있습니다:

```jsonc
// package.json — 코드 무수정 드롭인 교체
"dependencies": {
  "@number-flow/react": "npm:@yceffort/number-flow-react@^0.2.0"
}
```

```tsx
import NumberFlow from '@yceffort/number-flow-react'

;<NumberFlow value={value} suffix="원" />
```

## 동작 방식

- **모던 브라우저**: 원본 네이티브 경로와 같은 움직임을 컴포지터가 돌릴 수 있는 형태로 만듭니다. 원본은 등록된 커스텀 프로퍼티를 `composite: 'accumulate'`로 애니메이션하고 CSS `mod()` 수식으로 transform을 계산하는데, 이 방식은 어느 브라우저도 메인 스레드 밖에서 돌리지 못해 매 프레임 모든 자릿수의 스타일을 다시 계산합니다([#10](https://github.com/yceffort/number-flow/issues/10)). 이 포크는 요소마다 `composite: 'replace'`인 `transform` 또는 `opacity` 애니메이션 하나를 두고, 그 keyframe에 수식이 냈을 값을 넣습니다. 진행 중인 애니메이션을 업데이트가 끊으면 남아 있는 애니메이션들을 새 애니메이션에 다시 구워 넣기 때문에, 위치와 속도가 accumulate와 같게 유지됩니다(parity 테스트 기준 0.03px 이내).
  - 마스크는 컴포지터에서 애니메이션할 수 없어서, 숫자 폭이 바뀌는 동안에는 마스크 페이드만 메인 스레드에서 애니메이션합니다. 이 애니메이션은 마스크를 정지 상태로 둬도 차이가 8비트 알파 한 단계보다 작아지는 시점에 끝납니다. `font-variant-numeric: tabular-nums`를 쓰면 폭은 글자 수가 바뀔 때만 변합니다.
  - `::part()`에 `transform`이나 `opacity`를 지정한 작성자 스타일, 그리고 컴포지터 경로가 정확히 재현할 수 없는 타이밍(`steps()`, `iterations`, `direction`, `fill`)은 해당 요소를 원본과 같은 accumulate 애니메이션으로 둡니다.
- **구형 브라우저**: rAF 트윈 엔진이 WAAPI의 `composite: 'accumulate'` 시맨틱(활성 트윈들의 델타 합산)을 재현합니다.
  - 스프링 `linear()` easing은 90개 샘플 포인트를 보간해 **곡선까지 동일**하게 재생합니다. `cubic-bezier()`/키워드/`steps()`/사용자 지정 `linear()`도 파싱합니다.
  - `--_number-flow-dx`, `--scale-x` 등을 매 프레임 인라인 스타일로 기록해 원본 스타일시트가 그대로 소비합니다.
  - 자릿수 스핀은 CSS `mod()`/`round()` 수식을 JS로 포팅해 각 `.digit__num`의 `--y`를 직접 계산합니다.
  - rAF가 스로틀되는 환경(백그라운드 WebView 등)을 위한 setTimeout 백스톱 티커가 있어, 퇴장 문자 정리가 끊기지 않습니다(원본의 [값 겹침 이슈 #148](https://github.com/barvian/number-flow/issues/148) 발생 경로 차단).

## 브라우저 지원

|                                | 원본  | 이 포크                         |
| ------------------------------ | ----- | ------------------------------- |
| iOS Safari (모든 iOS 브라우저) | 17.2+ | **약 13+** (WebKit 16.4 실검증) |
| Android Chrome / WebView       | 125+  | **66+** (실바이너리 검증)       |
| 데스크톱 Chrome                | 125+  | **66+** (실바이너리 검증)       |

하한을 결정하는 API는 `Intl.NumberFormat.formatToParts`(Chrome 64/Safari 13)와 `AbortController`(Chrome 66/Safari 12.1)입니다.

이 하한은 세 가지 방식으로 강제됩니다: `.browserslistrc` 선언, CI의 `eslint-plugin-compat` 정적 검사, 그리고 실제 Chromium 66/80/114 바이너리로 selftest를 돌리는 CI 잡.

### 검증된 매트릭스 (전부 실바이너리/실엔진)

- **Chromium 66 / 71 / 75 / 80 / 87 / 92 / 100 / 114**: 자동 감지로 rAF 폴백 선택, 시나리오 44건 PASS
- **WebKit 16.4** (iOS/macOS Safari 16.4 상당): rAF 폴백 자동 선택, PASS — 원본이 애니메이션을 끄는 버전에서 동작
- **WebKit 17.4 / 18.2**: 네이티브 경로에서 macOS 빌드 44건 전부 PASS. 원본은 이 버전에서 폭 스케일(및 macOS에서는 등장 페이드인) 검증이 실패합니다. [알려진 이슈](#알려진-이슈) 참고
- **최신 Chromium / Firefox / WebKit 26.x**: 네이티브·rAF 강제 모두 PASS
- **Next.js 16 (React 19) SSR**: 서버 마크업 + 히드레이션 스모크 PASS

### 그래도 뭔가 깨진다면

지원 범위 안에서는 애니메이션 API가 오동작해도 "숫자가 안 보이는" 방향이 아니라 "정적이지만 정확한 렌더링"으로 열화됩니다. 값은 항상 실제 DOM 텍스트이고(각 자릿수가 0–9 numeral을 모두 갖고 현재 값만 표시), transform 계산이 실패하면 `none`(제자리)으로, 등장 페이드가 실패하면 opacity 초깃값 `1`(즉시 표시)로 계산됩니다. 아래 Safari 17.4~18.x `var()` 버그가 실제 사례로, 원본은 거기서 시각 효과 두 개를 잃지만 값, 레이아웃, 접근성은 정상입니다. SSR을 쓰면 서버가 그린 폴백 `<span>`이 클라이언트 실패와 무관하게 남습니다.

하한 미만에서는 우아한 강등이 없습니다 — 업데이트가 예외를 던집니다. Chrome 64~65는 `AbortController`가 없어 애니메이션 업데이트가 새 값이 DOM에 반영된 직후 throw하고(React라면 에러 바운더리가 트리를 내릴 수 있음), Chrome 64/Safari 13 미만은 `formatToParts`가 없어 클라이언트에서는 아무것도 렌더되지 않습니다. 하한보다 아래를 지원해야 한다면 사용처에서 직접 가드하세요.

## 추가 API (원본 대비)

- `setEngineMode('auto' | 'native' | 'raf')` — 엔진 강제 선택. 애니메이션 시작 전에 호출해야 합니다.
- `supportsNativeAnimations` — 이 브라우저가 네이티브 경로를 _탈 수 있는지_ 여부. 정적 기능 감지값이라 `setEngineMode('raf')`를 호출해도 바뀌지 않습니다.
- `canAnimate` — rAF만 있으면 `true` (원본은 세 가지 CSS 기능을 모두 요구).

## 원본과의 차이 (정직한 한계)

- 폴백 경로는 **메인 스레드**에서 돌므로, 메인 스레드가 심하게 바쁘면 프레임이 떨어질 수 있습니다. 네이티브 경로는 컴포지터에서 돌지만, 아래 두 경우와 [동작 방식](#동작-방식)에 적은 `::part()`, 타이밍 예외에서는 메인 스레드를 씁니다.
- 네이티브 경로에서 진행 중인 애니메이션을 끊는 업데이트는 남은 애니메이션을 다시 구워 넣기 때문에, 그 순간의 메인 스레드 비용이 늘어납니다(300ms 간격 인터럽트 벤치, 1x, Apple M5 기준 업데이트 1회 약 5ms에서 약 15ms).
- 비례폭 숫자에서는 대부분의 업데이트가 숫자 폭을 바꾸고, 그때 애니메이션의 일부 구간 동안 마스크 페이드가 메인 스레드에서 돕니다. `font-variant-numeric: tabular-nums`를 쓰면 이 비용이 없어집니다(이슈 벤치 1x 기준 메인 스레드 시간 59 대 14 ms/s).
- 폴백에서 `EffectTiming`은 `duration`/`delay`/`easing`만 지원합니다 (`iterations` 등은 무시).
- `mix-blend-mode: plus-lighter` 미지원 브라우저에서는 ± 기호 크로스페이드가 일반 페이드로 소폭 열화됩니다.
- Vue/Svelte 래퍼는 아직 포팅하지 않았습니다 (코어는 동일하므로 필요 시 원본 래퍼를 참고해 추가 가능).

## 알려진 이슈

현재 열린 이슈는 없습니다.

Safari 17.4 ~ 18.x에서는 원본의 폭 스케일 트윈과 등장 페이드인이 빠집니다. WebKit 26에서 고쳐진 WebKit 버그입니다. 같은 shadow root 안에서 애니메이션이 3개 이상 돌면, 등록된 커스텀 프로퍼티의 애니메이션 값이 같은 요소의 다른 속성 `var()` 치환에 반영되지 않는데, 원본은 두 효과를 모두 이 방식으로 계산합니다(`--_number-flow-d-width`에서 `--scale-x`, `--_number-flow-d-opacity`에서 페이드). 이 포크의 네이티브 경로는 `transform`과 `opacity`를 직접 애니메이션하므로 이 버전에서도 두 효과가 모두 동작합니다.

`pnpm test:webkit`은 WebKit 16.4, 17.4, 18.2 빌드에서 selftest를 돌립니다. 러너는 엔진 버그로 실패하는 검증 항목을 알려진 실패 목록(현재 비어 있음)으로 관리할 수 있어서, 그 항목들만 실패하는 동안에는 `old-webkit` CI 잡이 통과하고 그 외의 실패는 회귀로 잡힙니다. 목록의 항목이 통과하기 시작하면 러너가 알려줍니다. 러너에서 해당 WebKit 빌드를 띄울 수 없는 버전은 실패가 아니라 `SKIP`으로 보고합니다.

## 개발

```bash
pnpm install
pnpm build        # packages/* 빌드
pnpm test         # 엔진 유닛 테스트 (easing 파서, mod 수식, 가산 합성, 컴포지터 재베이킹)
pnpm lint         # oxlint --type-aware
pnpm lint:compat  # browserslist 하한 기준 브라우저 API 검사
pnpm format       # oxfmt
pnpm dev          # 비교 데모: 네이티브 vs rAF 폴백 vs 원본 3분할
```

## 브라우저 테스트

`demo/selftest.html`은 브라우저 안에서 스스로 5개 시나리오(스핀+폭 변화, 인터럽트 연타, 부호 크로스페이드, 실시간 티커, 정리 상태)를 검증하고 결과를 보고하는 페이지입니다.

```bash
pnpm e2e              # Playwright: selftest 6조합 + Next.js SSR 히드레이션 스모크
pnpm test:old-chrome  # 실제 구형 Chromium 스냅샷: 기본 M80/M87/M100/M114 (임의 마일스톤 지정 가능)
pnpm test:webkit      # 구버전 WebKit: Safari 16.4/17.4/18.2 상당
```

### 사람이 보면서 테스트 (창 모드)

```bash
pnpm open:old-chrome 87        # 구형 Chromium 창 + 비교 데모 (87 이상 아무 마일스톤)
pnpm open:webkit 17            # 구버전 WebKit 창 (Safari 버전으로 지정)
pnpm open:webkit --list        # 가능한 버전 목록
npx playwright test --headed   # 최신 3엔진 e2e를 창 띄워 실행
```

WebKit ↔ Safari 매칭 (Playwright가 릴리스별로 고정한 빌드 사용):

| 지정값        | WebKit      | Playwright  | 비고                                                   |
| ------------- | ----------- | ----------- | ------------------------------------------------------ |
| `16` / `16.4` | 16.4        | 1.33        | Safari 16.4 상당. `linear()` 없음 → rAF 폴백 자동 선택 |
| `17.0`        | 17.0        | 1.36        |                                                        |
| `17` / `17.4` | 17.4        | 1.40        | 네이티브 경로                                          |
| `18.0` / `18` | 18.0 / 18.2 | 1.48 / 1.49 | 네이티브 경로                                          |
| 최신 (26.x)   | 26.x        | 현재        | `pnpm e2e`가 커버                                      |

Safari 16.0~16.3(playwright ≤1.31) 빌드는 현재 macOS에서 실행이 멈춰 로컬 테스트 불가. Chromium은 headless 검증 M66부터, 창 모드는 M87부터입니다(그 이전 GUI는 Rosetta GPU 크래시). 구형 Chrome 러너는 CDP 클라이언트 호환 문제를 피하기 위해 `--headless --dump-dom`으로 selftest를 직접 실행하며, 페이지가 load 이벤트를 지연시켰다가 검증 완료 시 풀어 덤프를 트리거합니다. Apple Silicon에서 M91 이전은 x64 스냅샷을 Rosetta로 실행합니다(`softwareupdate --install-rosetta`).

## 라이선스

[MIT](./LICENSE.md). 원본 [number-flow](https://github.com/barvian/number-flow) © [Maxwell Barvian](https://barvian.me) — [원본 라이선스](https://github.com/barvian/number-flow/blob/main/LICENSE.md).
