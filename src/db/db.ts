import Dexie, { type EntityTable } from 'dexie'
import type { Session } from './schema'

/**
 * Base locale. C'est la source de vérité : l'application fonctionne intégralement
 * hors ligne, la synchronisation distante n'est qu'une sauvegarde.
 *
 * Seuls les champs listés ici sont indexés — les autres restent lisibles,
 * simplement pas interrogeables directement.
 */
const db = new Dexie('zone2') as Dexie & {
  sessions: EntityTable<Session, 'id'>
}

db.version(1).stores({
  sessions: 'id, startedAt, deletedAt',
})

export { db }
