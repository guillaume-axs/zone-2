import { useState } from 'react'
import { softDeleteSession } from '../db/sessions'
import SessionForm from '../forms/SessionForm'
import type { SessionInput } from '../forms/sessionSchema'
import { ListeSeances } from './Historique'
import './NouvelleSeance.css'

/**
 * Saisie d'une séance, puis relecture de ce qu'on vient d'écrire.
 *
 * L'écran d'après-enregistrement est **volontairement rudimentaire**. Il remplit
 * son rôle (rendre visible et annulable ce qu'on vient d'écrire, règle 7) mais
 * n'est pas l'écran d'accueil : celui-ci aura sa propre étude UX.
 */
export default function NouvelleSeance() {
  const [saved, setSaved] = useState<{ id: string; input: SessionInput } | null>(
    null,
  )
  /** Saisie rendue à l'utilisateur après une annulation : il corrige, il ne retape pas. */
  const [brouillon, setBrouillon] = useState<SessionInput | undefined>()

  if (!saved) {
    return (
      <SessionForm
        initial={brouillon}
        onSaved={(id, input) => setSaved({ id, input })}
      />
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

      <ListeSeances fraiche={saved.id} />

      <button type="button" className="after__back" onClick={() => {
          setBrouillon(undefined)
          setSaved(null)
        }}
      >
        Nouvelle séance
      </button>
    </main>
  )
}
