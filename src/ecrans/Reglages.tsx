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
 * le constat en gris, l'action en braise, et l'appui fait l'action. Pas de
 * chevron, aucun écran ne s'ouvre. Connectée, la FC en direct est la preuve
 * que c'est le bon capteur : un nom, il faudrait le croire.
 */
function LigneCapteur() {
  const { ligne, connecter, annuler, deconnecter } = useCapteur()
  const action = { rien: connecter, aucun: connecter, recherche: annuler, connecte: deconnecter }[ligne.etat]

  return (
    <Button className="hist__item reglages__ligne" onPress={action}>
      {ligne.etat === 'connecte' && ligne.nom ? (
        <div>
          <div className="label">Capteur cardio</div>
          <div className="reglages__appareil">{ligne.nom}</div>
        </div>
      ) : (
        <span className="label">Capteur cardio</span>
      )}
      <span className="reglages__droite">
        {ligne.etat === 'rien' && <span className="hist__value reglages__vide">Connecter</span>}
        {ligne.etat === 'recherche' && (
          <>
            <span className="hist__value">
              Recherche
              <span className="reglages__points" aria-hidden="true">
                <i>.</i>
                <i>.</i>
                <i>.</i>
              </span>
            </span>
            <span className="hist__value reglages__vide">Annuler</span>
          </>
        )}
        {ligne.etat === 'connecte' && (
          <>
            <span className="hist__value reglages__fc">{ligne.bpm} bpm</span>
            <span className="hist__value reglages__vide">Déconnecter</span>
          </>
        )}
        {ligne.etat === 'aucun' && (
          <>
            <span className="hist__value">Aucun capteur</span>
            <span className="hist__value reglages__vide">Réessayer</span>
          </>
        )}
      </span>
    </Button>
  )
}
