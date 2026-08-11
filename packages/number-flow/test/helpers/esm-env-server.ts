// The ssr test project resolves `esm-env` here: vitest applies the root
// `ssr.resolve.conditions: ['browser']` (needed by the element tests) to
// every project, so without this alias BROWSER would be true even in the
// server project:
export const BROWSER = false
export const DEV = true
export const NODE = true
