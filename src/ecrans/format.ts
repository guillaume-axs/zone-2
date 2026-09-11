/** Mise en forme des nombres à l'écran, en français. */

export const fr = (n: number, decimales: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

/** « 4h05 », ou « 35 min » sous l'heure. */
export function duree(secondes: number) {
  const minutes = Math.round(secondes / 60)
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h}h${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`
}
