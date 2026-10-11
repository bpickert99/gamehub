// Files in public/ keep their names between deploys, and browsers cache them, so each build stamps
// its asset links with a fresh version to make every deploy fetch the new files.
declare const __BUILD_ID__: string

export function assetUrl(path: string): string {
  return `${path}?v=${__BUILD_ID__}`
}
