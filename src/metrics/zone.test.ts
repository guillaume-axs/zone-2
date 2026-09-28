import { describe, expect, it } from 'vitest'
import { AGE_MAX, AGE_MIN, bornesZone2 } from './zone'

describe('bornesZone2', () => {
  // La valeur de référence du sujet 14 : c'est elle qui fixe l'arrondi.
  it('donne 115 – 133 bpm à 44 ans', () => {
    expect(bornesZone2(44)).toEqual({ minBpm: 115, maxBpm: 133 })
  })

  it('applique Tanaka puis 65 et 75 %', () => {
    // 208 − 0,7 × 40 = 180 ; 65 % = 117 ; 75 % = 135.
    expect(bornesZone2(40)).toEqual({ minBpm: 117, maxBpm: 135 })
  })

  it('accepte les deux extrémités de la plage plausible', () => {
    expect(bornesZone2(AGE_MIN)).toEqual({ minBpm: 128, maxBpm: 148 })
    expect(bornesZone2(AGE_MAX)).toEqual({ minBpm: 90, maxBpm: 104 })
  })

  it('renvoie des bornes qui décroissent avec l’âge', () => {
    const jeune = bornesZone2(25)!
    const vieux = bornesZone2(65)!
    expect(jeune.minBpm).toBeGreaterThan(vieux.minBpm)
    expect(jeune.maxBpm).toBeGreaterThan(vieux.maxBpm)
  })

  it('garde toujours la borne basse sous la borne haute', () => {
    for (let age = AGE_MIN; age <= AGE_MAX; age++) {
      const bornes = bornesZone2(age)!
      expect(bornes.minBpm).toBeLessThan(bornes.maxBpm)
    }
  })

  // Le cas qui justifie la garde : sans elle, l'écran affiche une seconde les
  // bornes d'un enfant de 4 ans avant de sauter à celles de 42 ans.
  it('vaut null sous le plancher de plausibilité', () => {
    expect(bornesZone2(4)).toBeNull()
    expect(bornesZone2(AGE_MIN - 1)).toBeNull()
  })

  it('vaut null au-dessus du plafond', () => {
    expect(bornesZone2(AGE_MAX + 1)).toBeNull()
    expect(bornesZone2(120)).toBeNull()
  })

  it('vaut null pour un âge nul ou négatif', () => {
    expect(bornesZone2(0)).toBeNull()
    expect(bornesZone2(-40)).toBeNull()
  })

  // `parseInt('4a')` vaut 4, mais `Number('')` vaut 0 et `Number('4.5')` 4,5 :
  // la fonction ne fait pas confiance à ce que le champ lui passe.
  it('vaut null pour un âge non entier', () => {
    expect(bornesZone2(40.5)).toBeNull()
    expect(bornesZone2(Number.NaN)).toBeNull()
  })
})
