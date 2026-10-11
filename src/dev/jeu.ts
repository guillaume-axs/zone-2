import type { Session } from '../db/schema.ts'

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

export function seance(ilYaJours: number, n: number): Session {
  const debut = new Date(Date.now() - ilYaJours * JOUR).toISOString()
  return {
    id: `jeu-de-test-${n}`,
    startedAt: debut,
    durationS: 3600,
    avgPowerW: 140 + (n % 7) * 3,
    avgHrBpm: 128 + (n % 5),
    source: 'manual',
    createdAt: debut,
    updatedAt: debut,
  }
}

/** Trois séances par semaine sur douze semaines. */
export function jeuDeTest(): Session[] {
  return Array.from({ length: 36 }, (_, n) => seance(1 + Math.floor(n * 2.3), n))
}
