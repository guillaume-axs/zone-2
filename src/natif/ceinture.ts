import { registerPlugin } from '@capacitor/core'

/** Ce que le téléphone garde de la ceinture entre deux séances. */
export interface CeintureConnue {
  connue: boolean
  /** Absent d'une ceinture rencontrée avant que le nom ne soit mémorisé. */
  nom?: string
}

const Survie = registerPlugin<{ ceinture(): Promise<CeintureConnue> }>('Survie')

/**
 * Renvoie `null` quand la question ne peut pas être posée — sur le web, où le
 * greffon natif n'existe pas.
 *
 * C'est un troisième état, distinct de « aucune ceinture » : une ligne qui
 * affirmerait l'absence alors qu'elle n'a pas pu demander mentirait la moitié du
 * temps. Ne rien dire est la seule réponse honnête.
 */
export async function ceintureConnue(): Promise<CeintureConnue | null> {
  try {
    return await Survie.ceinture()
  } catch {
    return null
  }
}
