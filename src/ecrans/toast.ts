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
/** La sortie du toast en cours : tout changement de la file l'attend. */
let sortie = Promise.resolve()

export const annonces = new ToastQueue<Annonce>({
  maxVisibleToasts: 1,
  // Avant tout changement, le toast affiché sort, puis seulement React le
  // retire : React Aria l'ôterait d'un coup. L'entrée est une animation CSS du
  // toast lui-même (Onglets.css). Pas de transition de vue : pendant qu'elle
  // photographie l'écran, un appui va à la page entière et se perd.
  wrapUpdate(fn) {
    const affiche = document.querySelector<HTMLElement>('.toast:not([data-sortie])')
    if (affiche) {
      affiche.dataset.sortie = ''
      // Mouvement réduit : aucune animation, le retrait suit aussitôt.
      sortie = Promise.all(affiche.getAnimations().map((a) => a.finished)).then(
        () => {},
        () => {},
      )
    }
    // Un changement qui arrive pendant une sortie l'attend aussi.
    void sortie.then(fn)
  },
})
export const DUREE_TOAST_MS = 8000

/**
 * Affiche un toast à la place de celui qui est à l'écran, comme le snackbar
 * Material : l'ancien sort, le nouveau entre. Sans fermeture, React Aria
 * garderait l'ancien en file, et il reviendrait une fois le nouveau fermé.
 */
export function afficher(annonce: Annonce) {
  for (const { key } of annonces.visibleToasts) annonces.close(key)
  annonces.add(annonce, { timeout: DUREE_TOAST_MS })
}
