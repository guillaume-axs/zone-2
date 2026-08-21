import { db } from './db'
import type { Session } from './schema'
import type { SessionInput } from '../forms/sessionSchema'

/**
 * Écritures sur les séances.
 *
 * Ce fichier existe pour une raison précise : c'est **l'unique frontière**
 * entre les unités du formulaire (minutes, parce qu'on ne tape pas « 2700 »
 * dans un champ durée) et celles du modèle (secondes, parce que la ceinture
 * cardio produira des durées réelles à l'étape 2 et qu'un arrondi à la minute
 * perdrait de la donnée). La conversion n'existe qu'ici — ailleurs dans
 * l'application, une durée est toujours en secondes.
 */

/** Crée une séance manuelle. La séance est horodatée maintenant : pas de champ de date (sujet 9). */
export async function createSession(input: SessionInput): Promise<string> {
  const now = new Date().toISOString()
  const session: Session = {
    id: crypto.randomUUID(),
    startedAt: now,
    durationS: input.durationMin * 60,
    avgPowerW: input.avgPowerW,
    avgHrBpm: input.avgHrBpm,
    // Un tableau vide n'est pas une information : on ne stocke rien.
    context: input.context?.length ? input.context : undefined,
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }
  await db.sessions.add(session)
  return session.id
}

/**
 * Annule une séance. Suppression *logique* : la ligne reste en base (sujet 4),
 * seules les lectures l'écartent. Rien n'est jamais effacé.
 */
export async function softDeleteSession(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.sessions.update(id, { deletedAt: now, updatedAt: now })
}
