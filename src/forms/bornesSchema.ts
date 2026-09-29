import { z } from 'zod'

/**
 * Bornes de saisie de la zone 2 — deux champs (DECISIONS.md, sujet 13).
 *
 * Les bornes en bpm sont celles de la fréquence cardiaque moyenne d'une séance,
 * avec les mêmes mots : c'est le même geste, sur la même grandeur.
 *
 * L'âge n'est pas ici. Il ne sort jamais de l'écran : il sert à remplir les deux
 * champs et disparaît (sujets 8 et 13).
 */

function borneBpm(manquant: string) {
  return z
    .number({ error: manquant })
    .int('Nombre entier de battements')
    .min(30, 'FC trop basse')
    .max(230, 'FC trop haute')
}

export const bornesSchema = z
  .object({
    z2MinBpm: borneBpm('Début requis'),
    z2MaxBpm: borneBpm('Fin requise'),
  })
  // Une zone large de 0 bpm n'est pas une zone : l'égalité est refusée comme
  // l'inversion. Le message se pose sur la fin, qui est la valeur qu'on corrige,
  // et il porte le chiffre réellement saisi : « Doit dépasser 118 » ne demande
  // rien à déduire, « Doit dépasser le début » oblige à relire l'autre champ.
  .superRefine((b, ctx) => {
    if (b.z2MaxBpm > b.z2MinBpm) return
    ctx.addIssue({
      code: 'custom',
      message: `Doit dépasser ${b.z2MinBpm}`,
      path: ['z2MaxBpm'],
    })
  })

export type BornesInput = z.infer<typeof bornesSchema>
