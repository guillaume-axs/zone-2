import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { softDeleteSession } from './db/sessions'
import type { Session } from './db/schema'
import SessionForm from './forms/SessionForm'
import type { SessionInput } from './forms/sessionSchema'
import EcranSurvie from './poc/Survie'
import './App.css'

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
 * Itération 2 — saisie d'une séance.
 *
 * Deux vues, donc un état plutôt qu'un routeur : la navigation est trop simple
 * pour justifier une dépendance.
 *
 * L'écran d'après-enregistrement est **volontairement rudimentaire**. Il remplit
 * son rôle (rendre visible et annulable ce qu'on vient d'écrire, règle 7) mais
 * n'est pas l'écran d'accueil : celui-ci aura sa propre étude UX.
 */
export default function App() {
  const [saved, setSaved] = useState<{ id: string; input: SessionInput } | null>(
    null,
  )
  /** Saisie rendue à l'utilisateur après une annulation : il corrige, il ne retape pas. */
  const [brouillon, setBrouillon] = useState<SessionInput | undefined>()
  /** Écran de mesure du PoC de survie. Temporaire — il partira avec le PoC. */
  const [poc, setPoc] = useState(false)

  const sessions = useLiveQuery(
    () =>
      db.sessions
        .orderBy('startedAt')
        .reverse()
        .filter((s) => !s.deletedAt)
        .toArray(),
    [],
  )

  if (poc) return <EcranSurvie onClose={() => setPoc(false)} />

  if (!saved) {
    return (
      <>
        <SessionForm
          initial={brouillon}
          onSaved={(id, input) => setSaved({ id, input })}
        />
        <AccesPoc onOpen={() => setPoc(true)} />
      </>
    )
  }

  async function annuler() {
    if (!saved) return
    await softDeleteSession(saved.id)
    setBrouillon(saved.input)
    setSaved(null)
  }

  return (
    <main className="after">
      <div className="after__undo">
        <span className="label">Séance enregistrée</span>
        <button type="button" className="after__undo-btn" onClick={annuler}>
          Annuler
        </button>
      </div>

      <ul className="hist">
        {sessions?.map((s) => (
          <li key={s.id} className={s.id === saved.id ? 'hist__item hist__item--fresh' : 'hist__item'}>
            <span className="label">
              {s.id === saved.id ? "À l'instant" : jour(s.startedAt)}
            </span>
            <span className="hist__value">{resume(s)}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="after__back" onClick={() => {
          setBrouillon(undefined)
          setSaved(null)
        }}
      >
        Nouvelle séance
      </button>

      <AccesPoc onOpen={() => setPoc(true)} />
    </main>
  )
}

/**
 * Accès au PoC. Assez visible pour être trouvé sans mode d'emploi, assez
 * discret pour ne pas peser sur l'écran ; il disparaîtra avec le PoC.
 */
function AccesPoc({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="poc-acces" onClick={onOpen} aria-label="Diagnostic de survie">
      poc
    </button>
  )
}
