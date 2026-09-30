// browserslist 하한 기준으로 미지원 브라우저 API 사용을 잡는 전용 설정.
// (일반 lint는 oxlint가 담당 — 여기는 compat 플러그인만 돌린다)
import compat from 'eslint-plugin-compat'
import tseslint from 'typescript-eslint'

export default [
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {compat},
    rules: {
      'compat/compat': 'error',
    },
    settings: {
      // 런타임 기능 감지로 가드하고 있는 API들 (엔진이 폴백을 제공):
      polyfills: [
        'CSS.registerProperty',
        'CSS.supports',
        'ElementInternals',
        // 네이티브 경로 전용이고, 없으면 옵셔널 체이닝으로 명시적 시작 시각을 생략한다:
        'document.timeline',
      ],
    },
  },
]
