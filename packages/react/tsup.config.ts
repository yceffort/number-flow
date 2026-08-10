import {defineConfig} from 'tsup'

export default defineConfig({
  // NumberFlow needs to be a separate output file (see barvian/number-flow#95):
  entry: {
    index: 'src/index.tsx',
    NumberFlow: 'src/NumberFlow.tsx',
  },
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2019',
  clean: true,
  external: ['react', 'react-dom', 'esm-env', '@yceffort/number-flow'],
  banner: {js: "'use client';"},
})
