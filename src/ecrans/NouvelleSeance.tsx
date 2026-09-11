import { useLocation, useNavigate } from 'react-router'
import SessionForm from '../forms/SessionForm'
import type { SessionInput } from '../forms/sessionSchema'
import { DUREE_TOAST_MS, enregistrements } from './toast'

/**
 * Saisie d'une séance. Une fois écrite, on revient à l'Accueil : un toast
 * l'annonce et permet de l'annuler (règle 7). Après une annulation, la saisie
 * revient ici par l'état de navigation : on corrige, on ne retape pas.
 */
export default function NouvelleSeance() {
  const navigate = useNavigate()
  const brouillon = useLocation().state?.brouillon as SessionInput | undefined

  return (
    <SessionForm
      initial={brouillon}
      onSaved={(id, input) => {
        enregistrements.add({ id, input }, { timeout: DUREE_TOAST_MS })
        navigate('/')
      }}
    />
  )
}
