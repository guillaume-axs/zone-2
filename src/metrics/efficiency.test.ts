import { describe, expect, it } from 'vitest'
import { efficiency } from './efficiency'

describe('efficiency', () => {
  it('divise la puissance par la fréquence cardiaque', () => {
    expect(efficiency({ avgPowerW: 150, avgHrBpm: 130 })).toBeCloseTo(1.1538, 4)
  })

  it('vaut null sans puissance', () => {
    expect(efficiency({ avgHrBpm: 130 })).toBeNull()
  })

  it('vaut null sans fréquence cardiaque', () => {
    expect(efficiency({ avgPowerW: 150 })).toBeNull()
  })

  it('vaut null quand les deux manquent', () => {
    expect(efficiency({})).toBeNull()
  })

  // Le cas qui justifie la garde : sans elle, la division renvoie `Infinity`,
  // une valeur qui traverse tout le code sans jamais déclencher d'erreur et
  // qui fait exploser l'échelle du graphique.
  it('vaut null pour une fréquence cardiaque nulle', () => {
    expect(efficiency({ avgPowerW: 150, avgHrBpm: 0 })).toBeNull()
  })

  it('vaut null pour une fréquence cardiaque négative', () => {
    expect(efficiency({ avgPowerW: 150, avgHrBpm: -5 })).toBeNull()
  })

  // Une puissance à zéro est une mesure valide, pas une absence de mesure.
  it('vaut 0 pour une puissance nulle', () => {
    expect(efficiency({ avgPowerW: 0, avgHrBpm: 130 })).toBe(0)
  })
})
