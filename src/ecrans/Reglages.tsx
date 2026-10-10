import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Link } from 'react-aria-components'
import { useCapteur } from '../capteur/useCapteur'
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
 * s'ouvre ; un mot en braise, l'appui fait ce que dit le mot.
 *
 * Toutes les lignes ont la hauteur de la ligne du capteur connecté : la liste
 * ne bouge pas quand le nom de l'appareil apparaît (sujet 16).
 */
export default function Reglages() {
  // `?? null` distingue « pas encore lu » (undefined) de « jamais réglé » (null) :
  // sans lui, la ligne afficherait « Non définie » le temps d'une image.
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
                <span className="hist__value reglages__vide">Non définie</span>
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
        <li>
          <LigneCapteur />
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

/**
 * La ligne « Capteur cardio » — sujet 16. Elle ne se lit pas, elle se pilote :
 * le constat en gris sous l'intitulé, l'action en braise à droite, et l'appui
 * fait l'action. Pas de chevron, aucun écran ne s'ouvre. La ligne change de
 * mots, jamais de forme : deux étages dans tous les états, et les quatre
 * actions empilées dans une même case, dont seule celle de l'état se voit.
 */
function LigneCapteur() {
  const { ligne, connecter, annuler, deconnecter } = useCapteur()
  const action = { rien: connecter, aucun: connecter, recherche: annuler, connecte: deconnecter }[ligne.etat]

  return (
    <Button className="hist__item reglages__ligne" onPress={action}>
      <div>
        <div className="label">Capteur cardio</div>
        <div className="reglages__etat">
          {ligne.etat === 'rien' && 'Non connecté'}
          {ligne.etat === 'recherche' && (
            <>
              Recherche
              <span className="reglages__points" aria-hidden="true">
                <i>.</i>
                <i>.</i>
                <i>.</i>
              </span>
            </>
          )}
          {ligne.etat === 'connecte' && (
            <>
              {ligne.nom && (
                <>
                  <span className="reglages__appareil">{ligne.nom}</span>
                  {'\u00a0·\u00a0'}
                </>
              )}
              <span className="reglages__fc">{ligne.bpm} bpm</span>
            </>
          )}
          {ligne.etat === 'aucun' && 'Aucun capteur trouvé'}
        </div>
      </div>
      <span className="hist__value reglages__vide reglages__action">
        {ACTIONS.map(([etat, mot]) => (
          <span key={etat} data-actif={etat === ligne.etat || undefined}>
            {mot}
          </span>
        ))}
      </span>
    </Button>
  )
}

/** Le mot orange de chaque état, dans l'ordre où la ligne les traverse. */
const ACTIONS = [
  ['rien', 'Connecter'],
  ['recherche', 'Annuler'],
  ['connecte', 'Déconnecter'],
  ['aucun', 'Réessayer'],
] as const
