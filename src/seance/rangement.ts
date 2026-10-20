import { db } from '../db/db'
import type { Lu } from './journal'

/**
 * Range une séance live lue du journal : la séance et ses trames, en une
 * transaction. Un identifiant déjà en base (séance supprimée comprise) n'est
 * jamais réécrit — rien n'est écrit, la réponse est `'deja'`.
 */
export function ranger(lu: Lu): Promise<'range' | 'deja'> {
  return db.transaction('rw', db.sessions, db.trames, async () => {
    if (await db.sessions.get(lu.session.id)) return 'deja'
    await db.sessions.add(lu.session)
    await db.trames.add({ id: lu.session.id, trames: lu.trames })
    return 'range'
  })
}
