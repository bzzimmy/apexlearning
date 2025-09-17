export type Theme = 'light' | 'dark'

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (!root) return
  if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
}

