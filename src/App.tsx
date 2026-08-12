import { Button } from 'react-aria-components'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import './App.css'

/**
 * Écran de preuve de vie — itération 1.
 *
 * Il ne sert qu'à valider trois choses sur l'appareil réel :
 *  - la charte graphique (polices embarquées, palette) ;
 *  - la persistance IndexedDB à travers une fermeture complète de l'application ;
 *  - le comportement tactile de React Aria (aucun état visuel qui reste collé).
 *
 * Il sera remplacé par l'écran d'accueil à l'itération 2.
 */
export default function App() {
  // `undefined` tant que la requête n'a pas répondu — évite d'afficher 0 par erreur.
  const count = useLiveQuery(() =>
    db.sessions.filter((s) => !s.deletedAt).count(),
  )

  async function addFakeSession() {
    const now = new Date().toISOString()
    await db.sessions.add({
      id: crypto.randomUUID(),
      startedAt: now,
      durationS: 3600,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    })
  }

  return (
    <main className="screen">
      <header className="screen__head">
        <p className="label">Zone 2 — itération 1</p>
      </header>

      <section className="stat">
        <p className="label">Séances enregistrées</p>
        <p className="stat__value">
          {count ?? '—'}
          <span className="stat__unit">
            {count === 1 ? 'séance' : 'séances'}
          </span>
        </p>
      </section>

      <Button className="btn" onPress={addFakeSession}>
        Ajouter une séance factice
      </Button>

      <footer className="screen__foot">
        <p className="label">
          Ferme complètement l'application, rouvre-la : le nombre doit être
          identique
        </p>
      </footer>
    </main>
  )
}
