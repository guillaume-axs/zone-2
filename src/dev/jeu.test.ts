import { describe, expect, it } from 'vitest'
import { efficiency } from '../metrics/efficiency'
import { dansFenetre, efficienceMoyenne, fenetrePrecedente, tendance } from '../metrics/bilan'
import { jeuDeTest } from './jeu'

describe('jeu de test', () => {
  const jeu = jeuDeTest()
  const now = new Date()

  it('progresse : les 4 dernières semaines battent les 4 précédentes de plus de 1 %', () => {
    const t = tendance(
      efficienceMoyenne(dansFenetre(jeu, '4s', now)),
      efficienceMoyenne(fenetrePrecedente(jeu, '4s', now)),
    )
    expect(t?.sens).toBe('hausse')
    expect(t!.variation).toBeGreaterThan(0.01)
  })

  it('reste dans des plages plausibles de zone 2', () => {
    for (const s of jeu) {
      expect(s.avgPowerW).toBeGreaterThanOrEqual(125)
      expect(s.avgPowerW).toBeLessThanOrEqual(155)
      expect(s.avgHrBpm).toBeGreaterThanOrEqual(125)
      expect(s.avgHrBpm).toBeLessThanOrEqual(140)
      expect([45, 60, 75, 90]).toContain(s.durationS / 60)
    }
  })

  it('est le même à chaque appel', () => {
    const autre = jeuDeTest()
    const sansDates = (j: typeof jeu) => j.map(({ id, durationS, avgPowerW, avgHrBpm, context }) =>
      ({ id, durationS, avgPowerW, avgHrBpm, context }))
    expect(sansDates(autre)).toEqual(sansDates(jeu))
  })

  it('creuse l’efficience des séances chaleur et fatigue', () => {
    const moyenne = efficienceMoyenne(jeu)!
    const marquees = jeu.filter((s) => s.context?.length)
    expect(marquees.map((s) => s.context![0]).sort()).toEqual(['chaleur', 'chaleur', 'fatigue'])
    for (const s of marquees) expect(efficiency(s)!).toBeLessThan(moyenne)
  })
})
