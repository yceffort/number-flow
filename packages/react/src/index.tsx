import {buildStyles} from '@yceffort/number-flow/csp'
import {
  prefersReducedMotion as _prefersReducedMotion,
  canAnimate as _canAnimate,
} from '@yceffort/number-flow/lite'
import * as React from 'react'
export const styles = buildStyles('-yceffort-react')
export * from '@yceffort/number-flow/plugins'
export {
  setEngineMode,
  supportsNativeAnimations,
} from '@yceffort/number-flow/lite'
export {default} from './NumberFlow'
export * from './NumberFlow'
export type {
  Value,
  Format,
  Trend,
  NumberPartType,
} from '@yceffort/number-flow/lite'

export const useIsSupported = () =>
  React.useSyncExternalStore(
    () => () => {}, // this value doesn't change, but it's useful to specify a different SSR value:
    () => _canAnimate,
    () => false,
  )
export const usePrefersReducedMotion = () =>
  React.useSyncExternalStore(
    (cb) => {
      _prefersReducedMotion?.addEventListener('change', cb)
      return () => _prefersReducedMotion?.removeEventListener('change', cb)
    },
    () => _prefersReducedMotion?.matches ?? false,
    () => false,
  )

export function useCanAnimate({respectMotionPreference = true} = {}) {
  const isSupported = useIsSupported()
  const reducedMotion = usePrefersReducedMotion()

  return isSupported && (!respectMotionPreference || !reducedMotion)
}
