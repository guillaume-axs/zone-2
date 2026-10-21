import { describe, expect, it } from 'vitest'
import { lireFichier, nomDuFichier, nouvelles, tramesAAjouter, versFichier } from './sauvegarde'
import type { Session, TramesSeance } from './schema'

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

const trames = (id: string): TramesSeance => ({
  id,
  trames: [
    { t_ms: 0, bpm: 120, rr: [500, 510] },
    { t_ms: 1000, bpm: 0, rr: [] },
  ],
})

describe('lireFichier', () => {
  it('relit ce que versFichier écrit, séances supprimées comprises', () => {
    const sessions = [seance('a'), seance('b', { deletedAt: '2026-10-02T08:00:00.000Z' })]
    expect(lireFichier(versFichier(sessions, []))).toEqual({ sessions, trames: [] })
  })

  it('relit un fichier v2, trames comprises', () => {
    const sessions = [seance('a', { source: 'live' })]
    const t = [trames('a')]
    expect(lireFichier(versFichier(sessions, t))).toEqual({ sessions, trames: t })
  })

  it('lit encore un fichier v1 : trames vides', () => {
    const sessions = [seance('a')]
    const v1 = JSON.stringify({
      app: 'zone2',
      version: 1,
      exportedAt: '2026-10-02T08:00:00.000Z',
      sessions,
    })
    expect(lireFichier(v1)).toEqual({ sessions, trames: [] })
  })

  it('refuse une trame mal formée', () => {
    const mauvaise: TramesSeance = { id: 'a', trames: [{ t_ms: 0, bpm: -1, rr: [] }] }
    expect(lireFichier(versFichier([seance('a')], [mauvaise]))).toBeNull()
  })

  it('accepte un fichier sans séance', () => {
    expect(lireFichier(versFichier([], []))).toEqual({ sessions: [], trames: [] })
  })

  it('refuse ce qui n’est pas du JSON', () => {
    expect(lireFichier('pas du json')).toBeNull()
  })

  it('refuse un JSON qui n’est pas une sauvegarde Zone 2', () => {
    expect(lireFichier(JSON.stringify({ sessions: [] }))).toBeNull()
  })

  it('refuse le fichier entier si une seule séance est mal formée', () => {
    const texte = versFichier([seance('a'), seance('b', { durationS: -1 })], [])
    expect(lireFichier(texte)).toBeNull()
  })

  it('écarte les champs inconnus', () => {
    const texte = versFichier([{ ...seance('a'), intrus: 1 } as Session], [])
    expect(lireFichier(texte)).toEqual({ sessions: [seance('a')], trames: [] })
  })
})

describe('nouvelles', () => {
  it('garde les séances absentes, ignore celles déjà là', () => {
    const r = nouvelles([seance('a'), seance('b')], new Set(['a']))
    expect(r.map((s) => s.id)).toEqual(['b'])
  })
})

describe('tramesAAjouter', () => {
  it('garde la première trame d’un identifiant répété', () => {
    const a = trames('a')
    const doublon = { ...trames('a'), trames: [] }
    expect(tramesAAjouter([a, doublon], new Set(['a']), new Set())).toEqual([a])
  })

  it('écarte les trames sans séance connue et celles déjà rangées', () => {
    const r = tramesAAjouter([trames('a'), trames('b'), trames('x')], new Set(['a', 'b']), new Set(['b']))
    expect(r.map((t) => t.id)).toEqual(['a'])
  })
})

describe('nomDuFichier', () => {
  it('porte la date du jour', () => {
    expect(nomDuFichier(new Date(2026, 9, 3))).toBe('zone2-2026-10-03.json')
  })
})
