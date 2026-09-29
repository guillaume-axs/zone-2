/**
 * Bornes de zone 2 estimées depuis l'âge — sujet 4, « Bornes de zone 2 ».
 *
 * Fréquence cardiaque maximale par Tanaka (208 − 0,7 × âge), puis 65 à 75 %
 * de cette valeur. Tanaka plutôt que 220 − âge, qui est plus biaisée ;
 * 65–75 % plutôt que 60–70 %, fourchette citée pour des personnes entraînées.
 *
 * Ce n'est qu'un point de départ : aucune formule ne donne la zone 2 d'une
 * personne à mieux que ±10 à 20 bpm, et les deux bornes restent éditables à
 * la main. L'arrondi au plus proche, à 1 bpm près, est donc du bruit devant
 * l'incertitude de la méthode — c'est aussi celui de l'exemple du sujet 14
 * (44 ans → 115 – 133 bpm, alors qu'un arrondi vers le bas donnerait 132).
 *
 * Rien n'est stocké ici : l'âge n'entre jamais en base (sujet 13), seules les
 * deux bornes y vivent.
 */

/** Plancher de plausibilité de l'âge saisi (sujet 13). */
export const AGE_MIN = 15
/** Plafond de plausibilité de l'âge saisi (sujet 13). */
export const AGE_MAX = 99

export interface BornesZone2 {
  minBpm: number
  maxBpm: number
}

/**
 * Renvoie `null` pour tout âge qui n'est pas un entier plausible : le champ
 * déclenche le calcul dès deux chiffres tapés, il reçoit donc des valeurs en
 * cours de frappe qu'il ne faut surtout pas afficher.
 */
export function bornesZone2(age: number): BornesZone2 | null {
  if (!Number.isInteger(age)) return null
  if (age < AGE_MIN || age > AGE_MAX) return null
  const fcMax = 208 - 0.7 * age
  return {
    minBpm: Math.round(fcMax * 0.65),
    maxBpm: Math.round(fcMax * 0.75),
  }
}
