import { flushSync } from 'react-dom'
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components'
import type { SessionInput } from '../forms/sessionSchema'

/** La séance qu'on vient d'écrire, telle qu'elle a été saisie — pour l'annuler et la corriger. */
export interface Enregistrement {
  genre: 'seance'
  id: string
  input: SessionInput
}

/** Un réglage qu'on vient d'écrire. Il n'y a rien à annuler : on rouvre l'écran. */
export interface Reglage {
  genre: 'reglage'
  texte: string
}

/**
 * Ce qu'un toast peut annoncer. Une seule file pour les deux natures, et non une
 * par nature : `maxVisibleToasts: 1` ne vaut que dans une file, deux files
 * pourraient donc empiler deux toasts — ce que Material refuse.
 */
export type Annonce = Enregistrement | Reglage

/**
 * File du toast (règle 7 : la donnée écrite est visible, et annulable quand
 * l'annulation a un sens). Une seule à la fois, comme le veut Material ; 8 s,
 * haut de la fourchette recommandée quand le toast porte une action, et le
 * toucher suspend le minuteur.
 */
export const annonces = new ToastQueue<Annonce>({
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
