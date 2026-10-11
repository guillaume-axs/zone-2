import type { Session, SessionContext } from '../db/schema.ts'

/**
 * Le jeu de test — de l'app dev (sujet 9) et du banc d'essai. Aucune séance
 * n'est tirée de séances réelles : le dépôt est public (sujet 8). Les dates
 * partent d'aujourd'hui, sinon le jeu sortirait des fenêtres de l'Accueil
 * avec le temps.
 *
 * Des fonctions, pas des constantes : un calcul au chargement du module
 * resterait dans le paquet de prod même inutilisé, la minification ne sachant
 * pas qu'il est sans effet.
 */

const JOUR = 86_400_000

/**
 * Un bloc de zone 2 de douze semaines : la fréquence cardiaque reste autour de
 * 130 bpm pendant que la puissance monte d'environ 135 à 147 W, soit à peu près
 * +8 % d'efficience — un ordre de grandeur plausible, pas une mesure publiée.
 * Le bruit est fixe, pour que le jeu soit le même à chaque chargement. Trois
 * séances portent un contexte : fréquence plus haute, puissance plus basse,
 * l'efficience y fait un creux.
 */
export function seance(ilYaJours: number, n: number): Session {
  const debut = new Date(Date.now() - ilYaJours * JOUR).toISOString()
  const bruitW = [0, 2, -3, 1, -1, 3, -2][n % 7]
  const bruitFc = [0, 1, -2, 2, -1][n % 5]
  const contextes: Record<number, SessionContext> = { 4: 'chaleur', 17: 'fatigue', 27: 'chaleur' }
  const contexte = contextes[n] as SessionContext | undefined
  const ecartW = contexte ? -5 : 0
  const ecartFc = contexte ? 8 : 0
  return {
    id: `jeu-de-test-${n}`,
    startedAt: debut,
    durationS: [60, 45, 75, 90][n % 4] * 60,
    avgPowerW: Math.round(147 - (ilYaJours * 12) / 84) + bruitW + ecartW,
    avgHrBpm: 130 + bruitFc + ecartFc,
    ...(contexte && { context: [contexte] }),
    source: 'manual',
    createdAt: debut,
    updatedAt: debut,
  }
}

/** Trois séances par semaine sur douze semaines, la plus récente hier. */
export function jeuDeTest(): Session[] {
  return Array.from({ length: 36 }, (_, n) => seance(1 + Math.floor(n * 2.3), n))
}
