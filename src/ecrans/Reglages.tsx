import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-aria-components'
import { bornesEnVigueur } from '../db/zones'
import Marque from './Marque'
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
 *
 * La ligne Ceinture n'est pas encore ici : elle pilote la liaison à la main —
 * chercher, connecter, montrer la FC en direct, déconnecter — et ça demande son
 * étude et sa maquette (sujet 16). Une ligne qui dirait « appairée » hors
 * connexion affirmerait ce qu'elle ne sait pas.
 */
export default function Reglages() {
  // `?? null` distingue « pas encore lu » (undefined) de « jamais réglé » (null) :
  // sans lui, la ligne afficherait « à régler » le temps d'une image.
  const bornes = useLiveQuery(async () => (await bornesEnVigueur()) ?? null)

  return (
    <div className="reglages">
      <div className="tete">
        <Marque />
        <span className="label">Réglages</span>
      </div>
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
      </ul>

      {/* Le commit qui a produit l'APK, pas un numéro de version : `versionName`
          n'a jamais bougé, et un numéro qui ne bouge pas ne distingue pas deux
          builds installés à une semaine d'écart (sujet 14). */}
      {import.meta.env.VITE_COMMIT && (
        <footer className="reglages__pied">{import.meta.env.VITE_COMMIT}</footer>
      )}
    </div>
  )
}
