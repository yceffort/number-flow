# @yceffort/number-flow

> **Fork notice**: 이 프로젝트는 [barvian/number-flow](https://github.com/barvian/number-flow) (MIT, © Maxwell Barvian)의 포크입니다. 포맷팅·DOM 구조·스타일은 원본을 유지하고, 애니메이션 구동부를 하이브리드(WAAPI/rAF) 엔진으로 교체해 **구형 브라우저에서도 동일한 애니메이션이 동작**하도록 확장했습니다.

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
  "@number-flow/react": "npm:@yceffort/number-flow-react@^0.1.0"
}
```

```tsx
import NumberFlow from '@yceffort/number-flow-react'

;<NumberFlow value={value} suffix="원" />
```

## 동작 방식

- **모던 브라우저**: 원본과 완전히 동일한 네이티브 경로(WAAPI + `composite: 'accumulate'` + CSS `mod()` 수식). 컴포지터 스레드에서 실행되므로 성능 손실이 없습니다.
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

그 미만 브라우저에서는 원본과 동일하게 "애니메이션 없이 값 즉시 교체"로 우아하게 폴백합니다. 하한을 결정하는 API는 `Intl.NumberFormat.formatToParts`(Chrome 64/Safari 13)와 `AbortController`(Chrome 66/Safari 12.1)입니다.

### 검증된 매트릭스 (전부 실바이너리/실엔진)

- **Chromium 66 / 71 / 75 / 80 / 87 / 92 / 100 / 114**: 자동 감지로 rAF 폴백 선택, 시나리오 31건 PASS
- **WebKit 16.4** (iOS/macOS Safari 16.4 상당): rAF 폴백 자동 선택, PASS — 원본이 애니메이션을 끄는 버전에서 동작
- **WebKit 17.4 / 18.2**: 네이티브 경로 PASS (폭 스케일 1건은 **원본도 동일하게 실패**하는 당시 WebKit 엔진 특성 — WebKit 26에서 해소, rAF 강제 시 통과)
- **최신 Chromium / Firefox / WebKit 26.x**: 네이티브·rAF 강제 모두 PASS
- **Next.js 16 (React 19) SSR**: 서버 마크업 + 히드레이션 스모크 PASS

## 추가 API (원본 대비)

- `setEngineMode('auto' | 'native' | 'raf')` — 엔진 강제 선택. 애니메이션 시작 전에 호출해야 합니다.
- `supportsNativeAnimations` — 이 브라우저가 네이티브 경로를 쓰는지 여부.
- `canAnimate` — rAF만 있으면 `true` (원본은 세 가지 CSS 기능을 모두 요구).

## 원본과의 차이 (정직한 한계)

- 폴백 경로는 **메인 스레드**에서 돌므로, 메인 스레드가 심하게 바쁘면 프레임이 떨어질 수 있습니다. 모던 브라우저는 네이티브 경로라 영향이 없습니다.
- 폴백에서 `EffectTiming`은 `duration`/`delay`/`easing`만 지원합니다 (`iterations` 등은 무시).
- `mix-blend-mode: plus-lighter` 미지원 브라우저에서는 ± 기호 크로스페이드가 일반 페이드로 소폭 열화됩니다.
- Vue/Svelte 래퍼는 아직 포팅하지 않았습니다 (코어는 동일하므로 필요 시 원본 래퍼를 참고해 추가 가능).

## 개발

```bash
pnpm install
pnpm build        # packages/* 빌드
pnpm test         # 엔진 유닛 테스트 (easing 파서, mod 수식, 가산 합성)
pnpm lint         # oxlint --type-aware
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

MIT. 원본 number-flow © Maxwell Barvian.
