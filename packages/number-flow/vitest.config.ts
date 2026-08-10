import {defineConfig} from 'vitest/config'

export default defineConfig({
  // Vitest transforms through the SSR pipeline, so without this esm-env
  // resolves its `development` condition and BROWSER is false — which turns
  // ServerSafeHTMLElement into a stub class and makes the custom element
  // untestable. `resolve.conditions` alone does not cover it.
  ssr: {resolve: {conditions: ['browser']}},
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
})
