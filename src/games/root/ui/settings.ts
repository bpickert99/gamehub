// Per-browser display preferences for the Root table.
export type Settings = { textSize: number; shadows: boolean }

export const TEXT_SIZES = [
  { label: 'Normal', value: 1 },
  { label: 'Large', value: 1.2 },
  { label: 'Larger', value: 1.4 },
  { label: 'Largest', value: 1.65 },
]

const KEY = 'gamehub.root.settings'
const DEFAULTS: Settings = { textSize: 1.2, shadows: true }

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}
