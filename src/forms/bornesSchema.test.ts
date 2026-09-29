import { describe, expect, it } from 'vitest'
import { bornesSchema } from './bornesSchema'

/** Le message porté par le premier défaut trouvé, ou `null` si la saisie passe. */
function refus(z2MinBpm: unknown, z2MaxBpm: unknown): string | null {
  const r = bornesSchema.safeParse({ z2MinBpm, z2MaxBpm })
  return r.success ? null : r.error.issues[0].message
}

describe('bornesSchema', () => {
  it('accepte deux bornes plausibles', () => {
    expect(refus(115, 133)).toBeNull()
  })

  it('refuse une fin sous le début', () => {
    expect(refus(133, 115)).toBe('Doit dépasser 133')
  })

  // Une zone large de 0 bpm n'est pas une zone : sans ce cas, l'inversion seule
  // serait refusée et `130 – 130` passerait.
  it('refuse deux bornes égales', () => {
    expect(refus(130, 130)).toBe('Doit dépasser 130')
  })

  it('refuse une borne hors de la plage cardiaque', () => {
    expect(refus(10, 133)).toBe('FC trop basse')
    expect(refus(115, 300)).toBe('FC trop haute')
  })

  it('refuse une borne non entière', () => {
    expect(refus(115.5, 133)).toBe('Nombre entier de battements')
  })

  // Atteignable au `blur` : vider un champ déjà rempli puis en sortir.
  it('nomme le champ vide dans son message', () => {
    expect(refus(undefined, 133)).toBe('Début requis')
    expect(refus(115, undefined)).toBe('Fin requise')
  })
})
