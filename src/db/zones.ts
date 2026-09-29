import { db } from './db'
import type { ZoneConfig } from './schema'

/**
 * Lecture et écriture des bornes de zone 2.
 *
 * L'historisation SCD type 2 tient en deux lignes de code : enregistrer
 * **ajoute** une ligne, lire prend la **plus récente**. Rien n'est jamais
 * modifié ni effacé, conformément au sujet 4.
 */

/** Les bornes en vigueur, ou `undefined` si elles n'ont jamais été réglées. */
export async function bornesEnVigueur(): Promise<ZoneConfig | undefined> {
  return db.zoneConfigs.orderBy('validFrom').last()
}

/**
 * Enregistre de nouvelles bornes. Les précédentes restent en base : les séances
 * déjà faites doivent continuer à se lire à travers celles de leur époque.
 */
export async function enregistrerBornes(z2MinBpm: number, z2MaxBpm: number): Promise<void> {
  await db.zoneConfigs.add({
    id: crypto.randomUUID(),
    validFrom: new Date().toISOString(),
    z2MinBpm,
    z2MaxBpm,
  })
}
