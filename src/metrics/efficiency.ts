import type { Session } from '../db/schema'

/**
 * Efficience — puissance moyenne ÷ fréquence cardiaque moyenne (sujet 4).
 *
 * Progresser, c'est produire plus de watts à fréquence cardiaque égale.
 *
 * Renvoie `null` dès que la valeur n'a pas de sens : une des deux mesures
 * manque, ou la fréquence cardiaque est nulle ou négative. La fonction ne
 * fait pas confiance à son appelant — la validation de saisie écarte déjà
 * ces cas, mais une donnée peut aussi venir d'un enregistrement ancien.
 *
 * Aucune valeur n'est stockée : le calcul se refait à chaque lecture.
 */
export function efficiency(
  session: Pick<Session, 'avgPowerW' | 'avgHrBpm'>,
): number | null {
  const { avgPowerW, avgHrBpm } = session
  if (avgPowerW === undefined || avgHrBpm === undefined) return null
  if (avgHrBpm <= 0) return null
  return avgPowerW / avgHrBpm
}
