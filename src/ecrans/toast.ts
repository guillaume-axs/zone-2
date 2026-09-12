import { flushSync } from 'react-dom'
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components'
import type { SessionInput } from '../forms/sessionSchema'

/** La séance qu'on vient d'écrire, telle qu'elle a été saisie — pour l'annuler et la corriger. */
export interface Enregistrement {
  id: string
  input: SessionInput
}

/**
 * File du toast « Séance enregistrée · Annuler » (règle 7 : visible et
 * annulable). Une seule à la fois, comme le veut Material ; 8 s, haut de la
 * fourchette recommandée quand le toast porte une action, et le toucher
 * suspend le minuteur.
 */
export const enregistrements = new ToastQueue<Enregistrement>({
  maxVisibleToasts: 1,
  // Entrée et sortie animées par l'API View Transitions (mécanisme prévu par
  // React Aria) ; les glissements sont dans Onglets.css.
  wrapUpdate(fn) {
    if ('startViewTransition' in document) {
      document.startViewTransition(() => flushSync(fn))
    } else {
      fn()
    }
  },
})
export const DUREE_TOAST_MS = 8000
