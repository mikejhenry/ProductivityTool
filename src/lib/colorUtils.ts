/**
 * Converts a 6-digit hex colour string (with or without `#`) to an rgba() CSS value.
 * Returns the original string unchanged if the input is not a valid 6-digit hex.
 * Note: 3-digit hex shorthand is not supported — the app's colour picker always
 * produces 6-digit hex so this is intentional.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return hex
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r},${g},${b},${alpha})`
}
