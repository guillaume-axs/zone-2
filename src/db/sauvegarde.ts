import { z } from 'zod'
import { db } from './db'
import { trameSchema } from '../seance/journal'
import type { Session, TramesSeance } from './schema'

/**
 * Le fichier d'export — sujet 15.
 *
 * Il porte les séances et, depuis la version 2, les trames des séances live. Pas les bornes de zone permettraient de déduire
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

const tramesSchema = z.object({
  id: z.string().min(1),
  trames: z.array(trameSchema),
}) satisfies z.ZodType<TramesSeance>

const entete = { app: z.literal('zone2'), exportedAt: iso, sessions: z.array(sessionSchema) }

const fichierSchema = z.union([
  z.object({ ...entete, version: z.literal(1) }),
  z.object({ ...entete, version: z.literal(2), trames: z.array(tramesSchema) }),
])

/** Le contenu du fichier, prêt à écrire. */
export function versFichier(
  sessions: Session[],
  trames: TramesSeance[],
  maintenant = new Date(),
): string {
  return JSON.stringify(
    { app: 'zone2', version: 2, exportedAt: maintenant.toISOString(), sessions, trames },
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
 * Le contenu du fichier (v1 : sans trames, v2), ou `null` s'il n'est pas une sauvegarde Zone 2.
 * Tout ou rien : une seule séance mal formée fait refuser le fichier entier,
 * plutôt que d'en importer une partie sans le dire.
 */
export function lireFichier(
  texte: string,
): { sessions: Session[]; trames: TramesSeance[] } | null {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return null
  }
  const r = fichierSchema.safeParse(brut)
  if (!r.success) return null
  return { sessions: r.data.sessions, trames: 'trames' in r.data ? r.data.trames : [] }
}

/** Les séances absentes de la base. Un identifiant déjà là n'est jamais remplacé. */
export function nouvelles(sessions: Session[], presents: Set<string>): Session[] {
  return sessions.filter((s) => !presents.has(s.id))
}

/** Toutes les séances, supprimées comprises. */
export function toutesLesSeances(): Promise<Session[]> {
  return db.sessions.toArray()
}

/** Toutes les trames rangées. */
export function toutesLesTrames(): Promise<TramesSeance[]> {
  return db.trames.toArray()
}

/**
 * Ajoute les séances nouvelles et les trames qui manquent, en une transaction :
 * tout est écrit, ou rien. Les trames d'une séance déjà présente sont ajoutées
 * si la base n'en a pas encore — une séance importée d'un fichier v1 les attend.
 * Rend le nombre de séances visibles ajoutées — celles que l'utilisateur
 * retrouvera dans son historique.
 */
export function importerSeances(sessions: Session[], trames: TramesSeance[] = []): Promise<number> {
  return db.transaction('rw', db.sessions, db.trames, async () => {
    const presents = new Set((await db.sessions.toCollection().primaryKeys()) as string[])
    const ajout = nouvelles(sessions, presents)
    await db.sessions.bulkAdd(ajout)
    const dejaTrames = new Set((await db.trames.toCollection().primaryKeys()) as string[])
    await db.trames.bulkAdd(trames.filter((t) => !dejaTrames.has(t.id)))
    return ajout.filter((s) => !s.deletedAt).length
  })
}
