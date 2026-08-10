# @yceffort/number-flow-react

[@number-flow/react](https://github.com/barvian/number-flow)(MIT, © Maxwell Barvian)의 드롭인 호환 포크입니다. 하이브리드(WAAPI/rAF) 엔진으로 **Chrome 66+ / iOS 13+ 수준의 구형 브라우저에서도 동일한 애니메이션이 동작**합니다.

```bash
npm install @yceffort/number-flow-react
```

```tsx
import NumberFlow from '@yceffort/number-flow-react'
;<NumberFlow value={value} suffix="원" />
```

기존 프로젝트는 코드 수정 없이 alias로 교체할 수 있습니다:

```jsonc
"dependencies": {
  "@number-flow/react": "npm:@yceffort/number-flow-react@^0.1.0"
}
```

자세한 내용은 [저장소 README](https://github.com/yceffort/number-flow)를 참고하세요.

## 라이선스

[MIT](https://github.com/yceffort/number-flow/blob/main/LICENSE.md). 원본 [@number-flow/react](https://github.com/barvian/number-flow) © [Maxwell Barvian](https://barvian.me).
