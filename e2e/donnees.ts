import type { ZoneConfig } from '../src/db/schema.ts'
import { jeuDeTest, seance } from '../src/dev/jeu.ts'

/**
 * Les jeux de données du banc. Le jeu « plein » est celui de l'app dev
 * (`src/dev/jeu.ts`) : le banc vérifie ce que le PO charge sur le téléphone.
 */

const JOUR = 86_400_000

export const uneSeance = [seance(1, 1)]

export const plein = jeuDeTest()

export const zoneDefinie: ZoneConfig[] = [
  { id: 'zone-1', validFrom: new Date(Date.now() - 90 * JOUR).toISOString(), z2MinBpm: 120, z2MaxBpm: 135 },
]
