import { Capacitor, registerPlugin } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Link } from 'react-aria-components'
import { useCapteur } from '../capteur/useCapteur'
import { db } from '../db/db'
import { importerSeances, lireFichier, nomDuFichier, toutesLesSeances, versFichier } from '../db/sauvegarde'
import { bornesEnVigueur } from '../db/zones'
import GroupeDev from '../dev/GroupeDev'
import Marque from './Marque'
import { afficher } from './toast'
import './Reglages.css'

/**
 * Onglet Réglages — sujet 14.
 *
 * Une liste de lignes : intitulé à gauche, **valeur actuelle à droite**. On lit
 * son réglage sans entrer dedans, comme le fait Strava.
 *
 * La marque à droite de chaque ligne dit ce qu'elle promet : chevron, un écran
 * s'ouvre ; un mot ou une icône en braise, l'appui fait l'action.
 *
 * Les rôles typographiques du sujet 7 : l'intitulé en mono clair, la valeur en
 * Grotesk, l'action en braise. Une ligne inactive garde sa forme et passe en
 * gris pâle, icône comprise.
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
            <span className="label reglages__intitule">Zone 2</span>
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

      <span className="label reglages__groupe">Mes données</span>
      <ul className="hist">
        <li>
          <LigneExport />
        </li>
        <li>
          <Button className="hist__item reglages__ligne" onPress={importer}>
            <div>
              <div className="label reglages__intitule">Importer une sauvegarde</div>
              <div className="reglages__etat">Récupère les séances d’un export</div>
            </div>
            <svg className="reglages__icone" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 12.5V3M6 7l4-4 4 4M3.5 13.5v3h13v-3" />
            </svg>
          </Button>
        </li>
      </ul>

      {import.meta.env.VITE_DEV && <GroupeDev />}

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
        <div className="label reglages__intitule">Capteur cardio</div>
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

/** Le greffon natif `SauvegardePlugin.kt` : les fenêtres « Enregistrer sous » et « Ouvrir » du système. */
interface SauvegardePlugin {
  exporter(o: { nom: string; contenu: string }): Promise<{ fait: boolean }>
  importer(): Promise<{ fait: boolean; contenu?: string }>
}

const Sauvegarde = registerPlugin<SauvegardePlugin>('Sauvegarde')

/*
 * Dans le navigateur (`npm run dev`), le greffon n'existe pas : les lignes
 * restent visibles et l'appui ne fait rien. On n'exporte pas depuis le poste.
 */
const natif = Capacitor.isPluginAvailable('Sauvegarde')

const seances = (n: number) => (n === 1 ? '1 séance' : `${n} séances`)

function annoncer(texte: string) {
  afficher({ genre: 'reglage', texte })
}

/**
 * Le compteur ne montre que les séances visibles ; le fichier, lui, emporte
 * aussi les supprimées (sujet 15). À zéro séance, la ligne garde sa forme et
 * son icône, en gris pâle (sujet 7).
 */
function LigneExport() {
  const n = useLiveQuery(() => db.sessions.filter((s) => !s.deletedAt).count())

  async function exporter() {
    if (!natif || !n) return
    try {
      const { fait } = await Sauvegarde.exporter({
        nom: nomDuFichier(),
        contenu: versFichier(await toutesLesSeances()),
      })
      if (fait) annoncer(`${seances(n)} ${n === 1 ? 'exportée' : 'exportées'}`)
    } catch {
      annoncer('Export impossible')
    }
  }

  return (
    <Button className="hist__item reglages__ligne" isDisabled={n === 0} onPress={exporter}>
      <div>
        <div className="label reglages__intitule">Exporter mes séances</div>
        <div className="reglages__etat">{n === undefined ? '\u00a0' : n ? seances(n) : 'Aucune séance'}</div>
      </div>
      <svg className="reglages__icone" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 3v9.5M6 8.5l4 4 4-4M3.5 13.5v3h13v-3" />
      </svg>
    </Button>
  )
}

/** Fusion par identifiant : rien n'est jamais remplacé, tout ou rien est écrit. */
async function importer() {
  if (!natif) return
  try {
    const { fait, contenu } = await Sauvegarde.importer()
    if (!fait) return
    const sessions = contenu === undefined ? null : lireFichier(contenu)
    if (!sessions?.length) return annoncer('Ce fichier ne contient aucune séance')
    const n = await importerSeances(sessions)
    annoncer(n ? `${seances(n)} ${n === 1 ? 'importée' : 'importées'}` : 'Aucune nouvelle séance')
  } catch {
    annoncer('Import impossible')
  }
}
