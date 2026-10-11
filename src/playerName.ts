const KEY = 'gamehub.playerName'
export const MAX_NAME_LENGTH = 20

export function loadName(): string {
  return localStorage.getItem(KEY) ?? ''
}

export function saveName(name: string): void {
  localStorage.setItem(KEY, name)
}
