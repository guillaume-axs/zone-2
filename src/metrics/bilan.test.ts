import { describe, expect, it } from 'vitest'
import type { Session } from '../db/schema'
import {
  dansFenetre,
  efficienceMoyenne,
  fenetrePrecedente,
  puissanceMoyenne,
  tendance,
  volumeParSemaine,
  volumeS,
} from './bilan'

// Un jeudi, en milieu d'après-midi : la semaine en cours va du lundi 7 au dimanche 13.
const NOW = new Date(2026, 8, 10, 15, 0)

function seance(joursAvant: number, champs: Partial<Session> = {}): Session {
  const debut = new Date(NOW.getTime() - joursAvant * 86_400_000)
  return {
    id: String(joursAvant),
    startedAt: debut.toISOString(),
    durationS: 3600,
    source: 'manual',
    createdAt: debut.toISOString(),
    updatedAt: debut.toISOString(),
    ...champs,
  }
}

describe('dansFenetre', () => {
  const sessions = [seance(40), seance(0), seance(27), seance(29), seance(100)]

  it('garde 28 jours pour « 4s », du plus ancien au plus récent', () => {
    expect(dansFenetre(sessions, '4s', NOW).map((s) => s.id)).toEqual(['27', '0'])
  })

  it('garde 90 jours pour « 3m »', () => {
    expect(dansFenetre(sessions, '3m', NOW).map((s) => s.id)).toEqual(['40', '29', '27', '0'])
  })

  it('garde tout pour « tout »', () => {
    expect(dansFenetre(sessions, 'tout', NOW)).toHaveLength(5)
  })

  it('la fenêtre précédente est la tranche juste avant, vide pour « tout »', () => {
    expect(fenetrePrecedente(sessions, '4s', NOW).map((s) => s.id)).toEqual(['40', '29'])
    expect(fenetrePrecedente(sessions, 'tout', NOW)).toEqual([])
  })
})

describe('agrégats', () => {
  it('moyenne l’efficience des seules séances qui en ont une', () => {
    const sessions = [
      seance(1, { avgPowerW: 130, avgHrBpm: 130 }),
      seance(2, { avgPowerW: 150 }),
      seance(3, { avgPowerW: 150, avgHrBpm: 100 }),
    ]
    expect(efficienceMoyenne(sessions)).toBeCloseTo(1.25)
  })

  it('vaut null sans aucune efficience', () => {
    expect(efficienceMoyenne([seance(1, { avgPowerW: 150 })])).toBeNull()
    expect(puissanceMoyenne([seance(1)])).toBeNull()
  })

  it('additionne les durées', () => {
    expect(volumeS([seance(1), seance(2, { durationS: 1800 })])).toBe(5400)
  })
})

describe('tendance', () => {
  it('signale une hausse au-delà du seuil', () => {
    expect(tendance(1.12, 1.06)).toEqual({ sens: 'hausse', variation: expect.closeTo(0.0566, 3) })
  })

  it('signale une baisse', () => {
    expect(tendance(1.0, 1.05)?.sens).toBe('baisse')
  })

  it('est stable sous 1 % dans les deux sens', () => {
    expect(tendance(1.005, 1.0)?.sens).toBe('stable')
    expect(tendance(0.995, 1.0)?.sens).toBe('stable')
  })

  it('vaut null sans référence', () => {
    expect(tendance(1.1, null)).toBeNull()
    expect(tendance(null, 1.1)).toBeNull()
    expect(tendance(1.1, 0)).toBeNull()
  })
})

describe('volumeParSemaine', () => {
  it('découpe en semaines du lundi au dimanche, la courante en dernier', () => {
    const sessions = [
      seance(0), // jeudi de la semaine en cours
      seance(3, { durationS: 600 }), // lundi 7, même semaine
      seance(4, { durationS: 900 }), // dimanche 6, semaine précédente
      seance(20, { durationS: 100 }), // trois semaines plus tôt
      seance(30), // hors des quatre semaines
    ]
    expect(volumeParSemaine(sessions, NOW, 4)).toEqual([100, 0, 900, 4200])
  })
})
