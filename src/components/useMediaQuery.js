import { useCallback, useSyncExternalStore } from 'react'

/**
 * Media query reativa (resize, rotação) — alterna entre os layouts mobile e
 * desktop sem duplicar estado de tela.
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** Breakpoint do layout desktop — manter em sincronia com --breakpoint-desk. */
export const DESK_QUERY = '(min-width: 900px)'
