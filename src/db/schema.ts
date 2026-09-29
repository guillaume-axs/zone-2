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

/**
 * Bornes de zone 2 en vigueur — `zone_config` du sujet 4, historisé en SCD type 2.
 *
 * Changer ses bornes ne réinterprète **jamais** l'historique : une modification
 * ajoute une ligne, elle n'en corrige aucune. Chaque séance se lit à travers les
 * bornes en vigueur le jour où elle a eu lieu, et la lecture courante prend
 * simplement la ligne la plus récente.
 *
 * L'âge qui a servi au calcul n'est pas ici : c'est une donnée identifiante et
 * le dépôt est public (sujets 8 et 13). Ces deux bornes en permettent la
 * déduction, ce qui est aussi la raison pour laquelle elles ne partent pas dans
 * le fichier d'export (sujet 15).
 */
export interface ZoneConfig {
  /** UUID généré côté client, comme pour les séances. */
  id: string
  /**
   * Date de prise d'effet, en ISO 8601 avec fuseau. Le sujet 4 note ce champ en
   * type `date` côté Postgres ; il porte ici l'heure aussi, sans quoi deux
   * corrections le même jour seraient impossibles à ordonner.
   */
  validFrom: string
  z2MinBpm: number
  z2MaxBpm: number
}
