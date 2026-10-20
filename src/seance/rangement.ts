import { db } from '../db/db'
import { afficher } from '../ecrans/toast'
import type { Session } from '../db/schema'
import { lireJournal, type Lu } from './journal'
import { natif, Seance } from './greffon'

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

/** Un seul passage par lancement, même sous `StrictMode`. */
let fait = false

/**
 * Au lancement, range les séances que le service a laissées derrière lui (app
 * tuée en pleine séance) : lecture du journal, rangement, puis effacement du
 * fichier — jamais avant que la base l'ait. Un journal illisible reste sur le
 * téléphone ; un journal vide n'a rien à garder. Une exception du greffon ou de
 * la base n'efface rien et ne dit rien : le lancement suivant réessaie.
 */
export async function rangerAuLancement(): Promise<void> {
  if (fait || !natif) return
  fait = true
  try {
    const { id } = await Seance.seanceActive()
    if (id) return
    const { journaux } = await Seance.journaux()
    let illisibles = 0
    let retrouvee: Session | undefined
    for (const { id: fichier, contenu } of journaux) {
      const lu = contenu === '' ? undefined : lireJournal(contenu)
      if (contenu !== '' && !lu) {
        illisibles++
        continue
      }
      if (lu && (await ranger(lu)) === 'range') retrouvee = lu.session
      await Seance.effacer({ id: fichier })
    }
    if (illisibles > 0) afficher({ genre: 'reglage', texte: "Une séance n'a pas pu être rangée" })
    else if (retrouvee)
      afficher({ genre: 'reglage', texte: `Séance de ${Math.round(retrouvee.durationS / 60)} min retrouvée` })
  } catch {
    // Rien n'est effacé et l'utilisateur n'y peut rien : le lancement suivant réessaie.
  }
}
