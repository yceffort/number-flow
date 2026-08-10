import {styles as ssrStyles, renderFallbackStyles} from './ssr'
import runtimeStyles from './styles'

export const buildStyles = (elementSuffix?: string) =>
  [ssrStyles, renderFallbackStyles(elementSuffix), runtimeStyles] as const
