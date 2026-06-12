import { useCallback, useEffect, useState } from 'react'

export const PALETTES = [
  { id: 'indigo-cyan', name: '靛藍 × 青', colors: ['#4f46e5', '#0891b2'] },
  { id: 'violet-rose', name: '紫羅蘭 × 玫瑰', colors: ['#7c3aed', '#e11d48'] },
  { id: 'emerald-amber', name: '翡翠 × 琥珀', colors: ['#059669', '#d97706'] },
  { id: 'blue-orange', name: '藍 × 橘', colors: ['#2563eb', '#ea580c'] }
] as const

export type PaletteId = (typeof PALETTES)[number]['id']
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeSettings {
  mode: ThemeMode
  palette: PaletteId
}

const STORAGE_KEY = 'my-wiki-theme'
const DEFAULT_SETTINGS: ThemeSettings = { mode: 'system', palette: 'indigo-cyan' }

export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>
    return {
      mode: ['light', 'dark', 'system'].includes(parsed.mode as string)
        ? (parsed.mode as ThemeMode)
        : DEFAULT_SETTINGS.mode,
      palette: PALETTES.some((p) => p.id === parsed.palette)
        ? (parsed.palette as PaletteId)
        : DEFAULT_SETTINGS.palette
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function applyTheme(settings: ThemeSettings): void {
  const root = document.documentElement
  root.dataset.theme = settings.palette
  const dark =
    settings.mode === 'dark' ||
    (settings.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
}

export function useTheme(): {
  settings: ThemeSettings
  update: (patch: Partial<ThemeSettings>) => void
} {
  const [settings, setSettings] = useState<ThemeSettings>(loadThemeSettings)

  useEffect(() => {
    applyTheme(settings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  // 跟隨系統時，監聽系統亮暗切換
  useEffect(() => {
    if (settings.mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => applyTheme(settings)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings])

  const update = useCallback((patch: Partial<ThemeSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return { settings, update }
}
