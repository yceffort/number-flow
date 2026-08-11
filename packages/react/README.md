# @yceffort/number-flow-react

A drop-in compatible fork of [@number-flow/react](https://github.com/barvian/number-flow) (MIT, © Maxwell Barvian). Its hybrid (WAAPI/rAF) engine keeps **the same animations working down to Chrome 66 / iOS ~13**.

```bash
npm install @yceffort/number-flow-react
```

```tsx
import NumberFlow from '@yceffort/number-flow-react'
;<NumberFlow value={value} suffix="%" />
```

Existing projects can switch without any code changes via an alias:

```jsonc
"dependencies": {
  "@number-flow/react": "npm:@yceffort/number-flow-react@^0.1.0"
}
```

**Live demo**: https://yceffort.github.io/number-flow/

See the [repository README](https://github.com/yceffort/number-flow) for details.

## License

[MIT](https://github.com/yceffort/number-flow/blob/main/LICENSE.md). Original [@number-flow/react](https://github.com/barvian/number-flow) © [Maxwell Barvian](https://barvian.me).
