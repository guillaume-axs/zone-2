import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-aria-components'
import { bornesEnVigueur } from '../db/zones'
import { type CeintureConnue, ceintureConnue } from '../natif/ceinture'
import './Reglages.css'

/**
 * Onglet Réglages — sujet 14.
 *
 * Une liste de lignes : intitulé à gauche, **valeur actuelle à droite**. On lit
 * son réglage sans entrer dedans, comme le fait Strava. Pas d'icônes — la charte
 * du sujet 7 ne laisse rien décorer.
 *
 * La marque à droite de chaque ligne dit ce qu'elle promet : chevron, un écran
 * s'ouvre ; rien du tout, la ligne se lit et ne se touche pas. L'absence de
 * marque en est une.
 */
export default function Reglages() {
  // `?? null` distingue « pas encore lu » (undefined) de « jamais réglé » (null) :
  // sans lui, la ligne afficherait « à régler » le temps d'une image.
  const bornes = useLiveQuery(async () => (await bornesEnVigueur()) ?? null)

  // Le souvenir de la ceinture ne bouge pas tant qu'aucune séance ne tourne :
  // une lecture au montage suffit, il n'y a rien à observer.
  const [ceinture, setCeinture] = useState<CeintureConnue | null>()
  useEffect(() => {
    ceintureConnue().then(setCeinture)
  }, [])

  return (
    <>
      <span className="label">Réglages</span>
      <ul className="hist">
        <li>
          <Link href="/reglages/zone-2" className="hist__item reglages__ligne">
            <span className="label">Zone 2</span>
            <span className="reglages__droite">
              {bornes === undefined ? null : bornes === null ? (
                <span className="hist__value reglages__vide">à régler</span>
              ) : (
                <span className="hist__value">
                  {bornes.z2MinBpm} – {bornes.z2MaxBpm} bpm
                </span>
              )}
              <svg className="chevron" viewBox="0 0 8 14" aria-hidden="true">
                <path d="M1 1l6 6-6 6" />
              </svg>
            </span>
          </Link>
        </li>

        {/* Aucune marque à droite : la ligne se lit, elle ne se touche pas. Il n'y
            a pas d'écran d'appairage à cette étape — la ceinture qui répond la
            première gagne, et le risque est assumé (sujet 14). */}
        <li className="hist__item">
          <span className="label">Ceinture</span>
          <span className="hist__value">{nomCeinture(ceinture)}</span>
        </li>
      </ul>
    </>
  )
}

/**
 * Quatre états, trois réponses. `undefined` est la lecture en cours et `null` le
 * greffon injoignable — dans les deux cas on ne sait pas, et on ne dit rien
 * plutôt que d'affirmer une absence.
 */
function nomCeinture(ceinture: CeintureConnue | null | undefined) {
  if (!ceinture) return null
  if (!ceinture.connue) return 'aucune'
  return ceinture.nom ?? 'appairée'
}
