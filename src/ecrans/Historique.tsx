import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Session } from '../db/schema'
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

/**
 * Liste des séances, de la plus récente à la plus ancienne. `fraiche` désigne
 * celle qu'on vient d'écrire : elle s'affiche plus claire, pour qu'on la relise
 * sans la chercher.
 */
export function ListeSeances({ fraiche }: { fraiche?: string }) {
  const sessions = useLiveQuery(
    () =>
      db.sessions
        .orderBy('startedAt')
        .reverse()
        .filter((s) => !s.deletedAt)
        .toArray(),
    [],
  )

  return (
    <ul className="hist">
      {sessions?.map((s) => (
        <li key={s.id} className={s.id === fraiche ? 'hist__item hist__item--fresh' : 'hist__item'}>
          <span className="label">{s.id === fraiche ? "À l'instant" : jour(s.startedAt)}</span>
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
      <span className="label">Historique</span>
      <ListeSeances />
    </>
  )
}
