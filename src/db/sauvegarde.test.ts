import { describe, expect, it } from 'vitest'
import { lireFichier, nomDuFichier, nouvelles, versFichier } from './sauvegarde'
import type { Session } from './schema'

const seance = (id: string, extra: Partial<Session> = {}): Session => ({
  id,
  startedAt: '2026-10-01T07:00:00.000Z',
  durationS: 2700,
  avgPowerW: 140,
  avgHrBpm: 128,
  source: 'manual',
  createdAt: '2026-10-01T07:45:00.000Z',
  updatedAt: '2026-10-01T07:45:00.000Z',
  ...extra,
})

describe('lireFichier', () => {
  it('relit ce que versFichier écrit, séances supprimées comprises', () => {
    const sessions = [seance('a'), seance('b', { deletedAt: '2026-10-02T08:00:00.000Z' })]
    expect(lireFichier(versFichier(sessions))).toEqual(sessions)
  })

  it('accepte un fichier sans séance', () => {
    expect(lireFichier(versFichier([]))).toEqual([])
  })

  it('refuse ce qui n’est pas du JSON', () => {
    expect(lireFichier('pas du json')).toBeNull()
  })

  it('refuse un JSON qui n’est pas une sauvegarde Zone 2', () => {
    expect(lireFichier(JSON.stringify({ sessions: [] }))).toBeNull()
  })

  it('refuse le fichier entier si une seule séance est mal formée', () => {
    const texte = versFichier([seance('a'), seance('b', { durationS: -1 })])
    expect(lireFichier(texte)).toBeNull()
  })

  it('écarte les champs inconnus', () => {
    const texte = versFichier([{ ...seance('a'), intrus: 1 } as Session])
    expect(lireFichier(texte)).toEqual([seance('a')])
  })
})

describe('nouvelles', () => {
  it('garde les séances absentes, ignore celles déjà là', () => {
    const r = nouvelles([seance('a'), seance('b')], new Set(['a']))
    expect(r.map((s) => s.id)).toEqual(['b'])
  })
})

describe('nomDuFichier', () => {
  it('porte la date du jour', () => {
    expect(nomDuFichier(new Date(2026, 9, 3))).toBe('zone2-2026-10-03.json')
  })
})
