import { z } from 'zod'

/**
 * Bornes de saisie d'une séance — quatre champs (DECISIONS.md, sujets 1 et 9).
 *
 * Pas de champ de date : la séance est horodatée à l'enregistrement.
 *
 * Les bornes ne jugent pas la performance, elles écartent la faute de frappe :
 * une fréquence cardiaque à 0, une durée de quarante heures.
 *
 * Les unités sont celles du formulaire (minutes), pas celles du modèle
 * (secondes) — la conversion se fait au moment de l'enregistrement.
 */
export const sessionSchema = z.object({
  durationMin: z
    .number({ error: 'Durée requise' })
    .int('Nombre entier de minutes')
    .min(1, 'Au moins 1 minute')
    .max(600, 'Au plus 10 heures'),

  avgPowerW: z
    .number()
    .int('Nombre entier de watts')
    .min(0, 'Puissance négative impossible')
    .max(1000, 'Puissance invraisemblable')
    .optional(),

  avgHrBpm: z
    .number()
    .int('Nombre entier de battements')
    .min(30, 'FC trop basse')
    .max(230, 'FC trop haute')
    .optional(),

  context: z
    .array(z.enum(['chaleur', 'fatigue', 'a-jeun', 'maladie']))
    .optional(),
})

export type SessionInput = z.infer<typeof sessionSchema>
