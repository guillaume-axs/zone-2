import { z } from 'zod'
import { db } from './db'
import type { Session } from './schema'

/**
 * Le fichier d'export — sujet 15.
 *
 * Il ne porte que les séances : les bornes de zone permettraient de déduire
 * l'âge. Les séances supprimées partent aussi, avec leur `deletedAt` : une
 * sauvegarde qui les écarterait perdrait de la donnée.
 */

const iso = z.iso.datetime({ offset: true })

const sessionSchema = z.object({
  id: z.string().min(1),
  startedAt: iso,
  durationS: z.number().int().positive(),
  avgPowerW: z.number().nonnegative().optional(),
  avgHrBpm: z.number().positive().optional(),
  distanceM: z.number().nonnegative().optional(),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
  source: z.enum(['manual', 'live']),
  context: z.array(z.enum(['chaleur', 'fatigue', 'a-jeun', 'maladie'])).optional(),
  createdAt: iso,
  updatedAt: iso,
  deletedAt: iso.optional(),
}) satisfies z.ZodType<Session>

const fichierSchema = z.object({
  app: z.literal('zone2'),
  version: z.literal(1),
  exportedAt: iso,
  sessions: z.array(sessionSchema),
})

/** Le contenu du fichier, prêt à écrire. */
export function versFichier(sessions: Session[], maintenant = new Date()): string {
  return JSON.stringify(
    { app: 'zone2', version: 1, exportedAt: maintenant.toISOString(), sessions },
    null,
    2,
  )
}

/** `zone2-AAAA-MM-JJ.json`, à la date du téléphone. */
export function nomDuFichier(maintenant = new Date()): string {
  const j = (n: number) => String(n).padStart(2, '0')
  return `zone2-${maintenant.getFullYear()}-${j(maintenant.getMonth() + 1)}-${j(maintenant.getDate())}.json`
}

/**
 * Les séances du fichier, ou `null` s'il n'est pas une sauvegarde Zone 2.
 * Tout ou rien : une seule séance mal formée fait refuser le fichier entier,
 * plutôt que d'en importer une partie sans le dire.
 */
export function lireFichier(texte: string): Session[] | null {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return null
  }
  const r = fichierSchema.safeParse(brut)
  return r.success ? r.data.sessions : null
}

/** Les séances absentes de la base. Un identifiant déjà là n'est jamais remplacé. */
export function nouvelles(sessions: Session[], presents: Set<string>): Session[] {
  return sessions.filter((s) => !presents.has(s.id))
}

/** Toutes les séances, supprimées comprises. */
export function toutesLesSeances(): Promise<Session[]> {
  return db.sessions.toArray()
}

/**
 * Ajoute les séances nouvelles, en une transaction : tout est écrit, ou rien.
 * Rend le nombre de séances visibles ajoutées — celles que l'utilisateur
 * retrouvera dans son historique.
 */
export function importerSeances(sessions: Session[]): Promise<number> {
  return db.transaction('rw', db.sessions, async () => {
    const presents = new Set((await db.sessions.toCollection().primaryKeys()) as string[])
    const ajout = nouvelles(sessions, presents)
    await db.sessions.bulkAdd(ajout)
    return ajout.filter((s) => !s.deletedAt).length
  })
}
