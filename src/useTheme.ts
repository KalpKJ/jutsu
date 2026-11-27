import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'jutsu:theme'
const DARK = '(prefers-color-scheme: dark)'

function saved(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/** Follows the system until the player chooses, then remembers the choice. */
export function useTheme(): [Theme, () => void] {
  const [choice, setChoice] = useState<Theme | null>(saved)
  const [system, setSystem] = useState<Theme>(() => (matchMedia(DARK).matches ? 'dark' : 'light'))
  const theme = choice ?? system

  useEffect(() => {
    const query = matchMedia(DARK)
    const update = () => setSystem(query.matches ? 'dark' : 'light')
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // The choice still holds for this visit.
    }
  }, [theme])

  return [theme, toggle]
}
