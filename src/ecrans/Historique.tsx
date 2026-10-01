import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Session } from '../db/schema'
import Marque from './Marque'
import './Historique.css'

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const MOIS = [
  'janv.', 'févr.', 'mars', 'avril', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

function jour(iso: string) {
  const d = new Date(iso)
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
}

/** « 45 min · 145 W · 131 bpm » — les champs absents disparaissent, sans tiret ni vide. */
function resume(s: Session) {
  return [
    `${Math.round(s.durationS / 60)} min`,
    s.avgPowerW != null ? `${s.avgPowerW} W` : null,
    s.avgHrBpm != null ? `${s.avgHrBpm} bpm` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Liste des séances, de la plus récente à la plus ancienne. */
function ListeSeances() {
  const sessions = useLiveQuery(
    () =>
      db.sessions
        .orderBy('startedAt')
        .reverse()
        .filter((s) => !s.deletedAt)
        .toArray(),
    [],
  )

  // Même invitation que l'Accueil vide, au même endroit : une liste vide
  // dit ce qui la remplit, et l'action est le bouton « + » qu'elle désigne.
  if (sessions?.length === 0) {
    return (
      <div className="point">
        <span>↓</span>
        <span>Enregistre ta première séance</span>
      </div>
    )
  }

  return (
    <ul className="hist">
      {sessions?.map((s) => (
        <li key={s.id} className="hist__item">
          <span className="label">{jour(s.startedAt)}</span>
          <span className="hist__value">{resume(s)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Onglet Historique. Provisoire : la liste brute, en attendant son étude UX. */
export default function Historique() {
  return (
    <>
      <div className="tete">
        <Marque />
        <span className="label">Historique</span>
      </div>
      <ListeSeances />
    </>
  )
}
