/**
 * Modèle de données — source : DECISIONS.md, sujet 4.
 *
 * Deux règles structurantes :
 *  - aucune valeur dérivée n'est stockée (efficience, découplage, moyennes glissantes
 *    sont des fonctions pures calculées à la lecture) ;
 *  - `durationS` est le seul champ obligatoire, pour que la saisie reste sans friction.
 */

/** Provenance de la séance. `live` arrive à l'étape 2, avec la ceinture cardio. */
export type SessionSource = 'manual' | 'live'

/**
 * Contexte de la séance. Sert à interpréter l'efficience : une baisse due à la
 * chaleur ou à la fatigue n'est pas une perte de forme.
 */
export type SessionContext = 'chaleur' | 'fatigue' | 'a-jeun' | 'maladie'

export interface Session {
  /** UUID généré côté client — la synchronisation distante n'invente jamais d'identifiant. */
  id: string
  /** Début de la séance, en ISO 8601 avec fuseau. */
  startedAt: string
  /** Durée en secondes. Seul champ obligatoire. */
  durationS: number

  avgPowerW?: number
  avgHrBpm?: number
  distanceM?: number
  /** Effort perçu, échelle de Borg simplifiée de 1 à 10. */
  rpe?: number
  notes?: string

  source: SessionSource
  context?: SessionContext[]

  createdAt: string
  updatedAt: string
  /** Suppression logique : jamais d'effacement définitif, la donnée a trop de valeur. */
  deletedAt?: string
}
