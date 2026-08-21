import { describe, expect, it } from 'vitest'
import { sessionSchema } from './sessionSchema'

describe('sessionSchema', () => {
  it('accepte une séance complète', () => {
    const r = sessionSchema.safeParse({
      durationMin: 45,
      avgPowerW: 150,
      avgHrBpm: 130,
      context: ['chaleur', 'fatigue'],
    })
    expect(r.success).toBe(true)
  })

  // La durée est le seul champ obligatoire : une séance sans watts ni FC
  // compte quand même dans le volume (DECISIONS.md, sujet 1).
  it('accepte une séance réduite à sa durée', () => {
    expect(sessionSchema.safeParse({ durationMin: 45 }).success).toBe(true)
  })

  it('refuse une séance sans durée', () => {
    const r = sessionSchema.safeParse({ avgHrBpm: 130 })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('Durée requise')
  })

  it('refuse une durée nulle ou négative', () => {
    expect(sessionSchema.safeParse({ durationMin: 0 }).success).toBe(false)
    expect(sessionSchema.safeParse({ durationMin: -10 }).success).toBe(false)
  })

  it('refuse une durée au-delà de dix heures', () => {
    expect(sessionSchema.safeParse({ durationMin: 601 }).success).toBe(false)
  })

  // La borne basse existe pour la faute de frappe, pas pour juger : une FC
  // à 0 traverserait tout le code sans erreur et casserait l'efficience.
  it('refuse une FC hors des bornes physiologiques', () => {
    expect(sessionSchema.safeParse({ durationMin: 45, avgHrBpm: 0 }).success).toBe(false)
    expect(sessionSchema.safeParse({ durationMin: 45, avgHrBpm: 250 }).success).toBe(false)
  })

  it('accepte une puissance nulle, qui est une mesure valide', () => {
    expect(sessionSchema.safeParse({ durationMin: 45, avgPowerW: 0 }).success).toBe(true)
  })

  // La borne haute tient en trois chiffres : c'est ce qui autorise la bascule
  // automatique vers le champ suivant à la troisième frappe. Aucune moyenne
  // humaine sur une séance n'approche 999 W — le record du monde sur une heure
  // est autour de 440 W.
  it('plafonne la puissance à trois chiffres', () => {
    expect(sessionSchema.safeParse({ durationMin: 45, avgPowerW: 999 }).success).toBe(true)
    expect(sessionSchema.safeParse({ durationMin: 45, avgPowerW: 1000 }).success).toBe(false)
  })

  it('refuse un tag de contexte inconnu', () => {
    const r = sessionSchema.safeParse({ durationMin: 45, context: ['pluie'] })
    expect(r.success).toBe(false)
  })

  it('refuse une durée non entière', () => {
    expect(sessionSchema.safeParse({ durationMin: 45.5 }).success).toBe(false)
  })
})
