import {afterEach, describe, expect, it, vi} from 'vitest'

// styles.ts registers its custom properties as a module-level side effect, so
// each case needs a fresh module graph with CSS stubbed beforehand:
const loadWith = async (registerProperty: (definition: unknown) => void) => {
  vi.resetModules()
  vi.stubGlobal('CSS', {supports: () => true, registerProperty})
  return await import('../src/styles')
}

const registered = new Set<string>()
const realRegisterProperty = (definition: any) => {
  if (registered.has(definition.name))
    throw new DOMException(
      `The name ${definition.name} has already been registered.`,
      'InvalidModificationError',
    )
  registered.add(definition.name)
}

afterEach(() => {
  registered.clear()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('supportsAtProperty', () => {
  it('is true when every property registers', async () => {
    const {supportsAtProperty} = await loadWith(realRegisterProperty)
    expect(supportsAtProperty).toBe(true)
    expect(registered.size).toBe(4)
  })

  // Regression: another copy of the library on the page (e.g. upstream
  // @number-flow/react during a migration) registers the same names first.
  // Treating that as "unsupported" silently downgraded us to the rAF engine.
  it('stays true when the names are already registered', async () => {
    await loadWith(realRegisterProperty) // first copy wins the race
    const {supportsAtProperty} = await loadWith(realRegisterProperty)
    expect(supportsAtProperty).toBe(true)
  })

  it('is false when the browser does not support @property at all', async () => {
    const {supportsAtProperty} = await loadWith(() => {
      throw new TypeError('CSS.registerProperty is not a function')
    })
    expect(supportsAtProperty).toBe(false)
  })

  it('is false with no CSS object at all (SSR)', async () => {
    vi.resetModules()
    vi.stubGlobal('CSS', undefined)
    const {supportsAtProperty} = await import('../src/styles')
    expect(supportsAtProperty).toBe(false)
  })
})
