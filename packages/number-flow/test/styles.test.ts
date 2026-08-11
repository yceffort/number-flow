import {afterEach, describe, expect, it, vi} from 'vitest'

type Definition = {
  name: string
  syntax: string
  inherits: boolean
  initialValue: string
}

// styles.ts registers its custom properties as a module-level side effect, so
// each case needs a fresh module graph with CSS stubbed beforehand:
const loadWith = async (registerProperty: (definition: unknown) => void) => {
  vi.resetModules()
  vi.stubGlobal('CSS', {supports: () => true, registerProperty})
  return await import('../src/styles')
}

const registered = new Map<string, Definition>()
const realRegisterProperty = (definition: any) => {
  if (registered.has(definition.name))
    throw new DOMException(
      `The name ${definition.name} has already been registered.`,
      'InvalidModificationError',
    )
  registered.set(definition.name, definition)
}

// jsdom computes no custom-property cascade, so emulate how a real browser
// resolves a REGISTERED property: an element's own inline value wins; a child
// sees the parent's value only if the registration inherits, and the
// registration's initial value otherwise:
const emulateRegisteredComputedStyle = () => {
  vi.stubGlobal('getComputedStyle', (el: HTMLElement) => ({
    getPropertyValue(name: string) {
      const def = registered.get(name)
      const own = el.style.getPropertyValue(name)
      if (own) return own
      const inherited = el.parentElement?.style.getPropertyValue(name) ?? ''
      if (!def) return inherited
      return def.inherits && inherited ? inherited : def.initialValue
    },
  }))
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
  it('stays true when the names are already registered compatibly', async () => {
    await loadWith(realRegisterProperty) // first copy wins the race
    emulateRegisteredComputedStyle()
    const {supportsAtProperty} = await loadWith(realRegisterProperty)
    expect(supportsAtProperty).toBe(true)
  })

  // The error only proves the NAME is taken. If a page registered it with
  // different descriptors (say, an author copying the @property blocks into
  // a theme with inherits: false), the native path would silently break —
  // the digit math needs the values to reach the .digit__num children:
  it('is false when a name was registered incompatibly', async () => {
    await loadWith(realRegisterProperty)
    // Flip every registration's inheritance behind our back:
    for (const def of registered.values()) def.inherits = !def.inherits
    emulateRegisteredComputedStyle()
    const {supportsAtProperty} = await loadWith(realRegisterProperty)
    expect(supportsAtProperty).toBe(false)
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
