import {defineConfig} from 'vitest/config'

// Vitest transforms through the SSR pipeline, so without this esm-env
// resolves its `development` condition and BROWSER is false — which turns
// ServerSafeHTMLElement into a stub class and makes the custom element
// untestable. `resolve.conditions` alone does not cover it.
export default defineConfig({
  ssr: {resolve: {conditions: ['browser']}},
  test: {
    projects: [
      {
        ssr: {resolve: {conditions: ['browser']}},
        test: {
          name: 'browser',
          environment: 'jsdom',
          include: ['test/**/*.test.ts'],
          exclude: ['test/ssr.test.ts'],
        },
      },
      {
        resolve: {
          alias: {
            'esm-env': new URL(
              './test/helpers/esm-env-server.ts',
              import.meta.url,
            ).pathname,
          },
        },
        test: {
          name: 'ssr',
          environment: 'node',
          include: ['test/ssr.test.ts'],
        },
      },
    ],
  },
})
