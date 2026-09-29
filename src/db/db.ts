import Dexie, { type EntityTable } from 'dexie'
import type { Session, ZoneConfig } from './schema'

/**
 * Base locale. C'est la source de vérité : l'application fonctionne intégralement
 * hors ligne, la synchronisation distante n'est qu'une sauvegarde.
 *
 * Seuls les champs listés ici sont indexés — les autres restent lisibles,
 * simplement pas interrogeables directement.
 */
const db = new Dexie('zone2') as Dexie & {
  sessions: EntityTable<Session, 'id'>
  zoneConfigs: EntityTable<ZoneConfig, 'id'>
}

db.version(1).stores({
  sessions: 'id, startedAt, deletedAt',
})

// Les bornes de zone 2 (sujet 13). Ajouter une table ne demande aucune
// migration : Dexie la crée vide et ne touche pas aux séances déjà là.
// La version 1 reste déclarée — c'est ce qui permet à une base installée de
// passer à la 2 au lieu d'être rejetée.
db.version(2).stores({
  zoneConfigs: 'id, validFrom',
})

export { db }
