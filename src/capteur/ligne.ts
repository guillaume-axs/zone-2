import { z } from 'zod'

/**
 * La ligne « Capteur cardio » (sujet 16) : ce qu'elle affiche, déduit des
 * signaux du greffon natif. Pur et sans Capacitor, pour être testé.
 *
 * Quatre états affichés. Le décrochage n'en est pas un : il ramène à `rien`.
 * La connexion se montre par la FC, pas par l'annonce du natif — tant
 * qu'aucun battement n'est arrivé, la ligne dit encore « Recherche ».
 */
export type Ligne =
  | { etat: 'rien' }
  | { etat: 'recherche'; nom: string | null }
  | { etat: 'connecte'; nom: string | null; bpm: number }
  | { etat: 'aucun' }

/**
 * Ce qui arrive du natif est revérifié ici : le pont ne type rien. Les
 * noms d'état sont ceux de `Ceinture.Etat`.
 */
export const signalEtat = z.object({
  etat: z.enum(['RECHERCHE', 'TROUVEE', 'CONNECTEE', 'DECROCHEE', 'INTROUVABLE', 'ECHEC']),
  nom: z.string().nullish(),
})

export const signalFc = z.object({ bpm: z.number().int().min(0).max(255) })

export type Signal =
  | { type: 'etat'; signal: z.infer<typeof signalEtat> }
  | { type: 'fc'; bpm: number }
  /** Annuler ou Déconnecter : le natif a tout coupé, sans rien annoncer. */
  | { type: 'coupe' }

export const DEPART: Ligne = { etat: 'rien' }

export function suivant(ligne: Ligne, s: Signal): Ligne {
  switch (s.type) {
    case 'coupe':
      return DEPART
    case 'fc':
      // Un battement qui arrive après la coupure ne rallume rien.
      if (ligne.etat === 'rien' || ligne.etat === 'aucun') return ligne
      return { etat: 'connecte', nom: ligne.nom, bpm: s.bpm }
    case 'etat':
      switch (s.signal.etat) {
        case 'RECHERCHE':
        case 'TROUVEE':
        case 'CONNECTEE':
          return { etat: 'recherche', nom: s.signal.nom ?? null }
        case 'DECROCHEE':
          return DEPART
        case 'INTROUVABLE':
        case 'ECHEC':
          return { etat: 'aucun' }
      }
  }
}
