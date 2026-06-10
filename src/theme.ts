export type Theme = 'day' | 'night'

const STORAGE_KEY = 'psg-theme'

export const readTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'night' || stored === 'day') return stored
  } catch {
    // ignore storage errors
  }

  return 'day'
}

export const applyTheme = (theme: Theme) => {
  if (theme === 'night') {
    document.documentElement.dataset.theme = 'night'
  } else {
    delete document.documentElement.dataset.theme
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore storage errors
  }
}

export const readThemeColor = (variable: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback

  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || fallback
}

export const getThemeColors = (_theme: Theme) => ({
  ink: readThemeColor('--color-ink', '#101010'),
  muted: readThemeColor('--color-muted', '#8f9bb3'),
  chartMuted: readThemeColor('--color-chart-muted', '#a3aed0'),
  card: readThemeColor('--color-card', '#ffffff'),
  border: readThemeColor('--color-border', '#101010'),
  soft: readThemeColor('--color-accent-soft', '#f3f3f3'),
})
