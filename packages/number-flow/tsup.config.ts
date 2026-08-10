import {defineConfig} from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    lite: 'src/lite.ts',
    csp: 'src/csp.ts',
    group: 'src/group.ts',
    'plugins/index': 'src/plugins/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2019',
  clean: true,
  external: ['esm-env'],
})
