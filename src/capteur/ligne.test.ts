import { describe, expect, it } from 'vitest'
import { DEPART, type Ligne, type Signal, signalEtat, signalFc, suivant } from './ligne'

const etat = (e: string, nom?: string | null): Signal => ({
  type: 'etat',
  signal: signalEtat.parse({ etat: e, nom }),
})

const deroule = (...signaux: Signal[]): Ligne => signaux.reduce(suivant, DEPART)

describe('suivant', () => {
  it('cherche puis montre la FC une fois le premier battement arrivé', () => {
    const avant = deroule(etat('RECHERCHE'), etat('TROUVEE', 'Polar H10'), etat('CONNECTEE', 'Polar H10'))
    expect(avant).toEqual({ etat: 'recherche', nom: 'Polar H10' })
    expect(suivant(avant, { type: 'fc', bpm: 72 })).toEqual({ etat: 'connecte', nom: 'Polar H10', bpm: 72 })
  })

  it('suit la FC en direct', () => {
    const l = deroule(etat('CONNECTEE', 'Verity Sense'), { type: 'fc', bpm: 72 }, { type: 'fc', bpm: 75 })
    expect(l).toEqual({ etat: 'connecte', nom: 'Verity Sense', bpm: 75 })
  })

  it("dit « aucun capteur » quand l'écoute n'entend rien ou que le Bluetooth échoue", () => {
    expect(deroule(etat('RECHERCHE'), etat('INTROUVABLE'))).toEqual({ etat: 'aucun' })
    expect(deroule(etat('RECHERCHE'), etat('ECHEC'))).toEqual({ etat: 'aucun' })
  })

  it('revient à « Connecter » sur un décrochage', () => {
    expect(deroule(etat('CONNECTEE', 'Polar H10'), { type: 'fc', bpm: 72 }, etat('DECROCHEE'))).toEqual(DEPART)
  })

  it('revient à « Connecter » sur une coupure, et un battement en retard ne rallume rien', () => {
    const l = deroule(etat('CONNECTEE', 'Polar H10'), { type: 'fc', bpm: 72 }, { type: 'coupe' }, { type: 'fc', bpm: 73 })
    expect(l).toEqual(DEPART)
  })

  it('ignore un battement quand rien ne cherche', () => {
    expect(deroule(etat('INTROUVABLE'), { type: 'fc', bpm: 72 })).toEqual({ etat: 'aucun' })
  })
})

describe('signaux du natif', () => {
  it('refuse un état inconnu', () => {
    expect(signalEtat.safeParse({ etat: 'PERDUE' }).success).toBe(false)
  })

  it('accepte un nom absent', () => {
    expect(signalEtat.safeParse({ etat: 'RECHERCHE' }).success).toBe(true)
  })

  it('refuse une FC qui ne peut pas venir du capteur', () => {
    expect(signalFc.safeParse({ bpm: -1 }).success).toBe(false)
    expect(signalFc.safeParse({ bpm: 72.5 }).success).toBe(false)
    expect(signalFc.safeParse({ bpm: '72' }).success).toBe(false)
  })
})
