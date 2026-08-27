import { useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import './Survie.css'

/**
 * PoC — le service natif survit-il quatre heures en arrière-plan, écran verrouillé ?
 *
 * Rien ici n'appartient à l'application : cet écran est un instrument de mesure,
 * il disparaîtra avec le PoC. Le seul travail réel est fait par `SurvieService`,
 * qui bat toutes les secondes et écrit chaque battement sur disque. Ce que le
 * JavaScript affiche n'est qu'un dépouillement — il ne compte rien lui-même, et
 * surtout il ne tourne pas pendant le test : la WebView est gelée par Android
 * cinq minutes après le verrouillage, et c'est précisément ce dont on se moque.
 */
type Etat = {
  actif: boolean
  debut: number
  fin: number
  dureeMs: number
  ticks: number
  /** Une seconde par tick : ce qu'on aurait dû recevoir sur la durée écoulée. */
  attendus: number
  /** Plus grand silence entre deux battements, en millisecondes. */
  trouMax: number
  /** Nombre de silences au-delà de 5 s — le critère d'acceptation. */
  trous: number
  /** Relances du service par Android : un kill masqué par `START_STICKY`. */
  redemarrages: number
  arretPropre: boolean
  batterieDebut: number
  batterie: number
  exempteBatterie: boolean
}

const Survie = registerPlugin<{
  demarrer(): Promise<void>
  arreter(): Promise<void>
  exemptionBatterie(): Promise<void>
  etat(): Promise<Etat>
}>('Survie')

function duree(ms: number) {
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

export default function EcranSurvie({ onClose }: { onClose: () => void }) {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function relire() {
    try {
      setEtat(await Survie.etat())
      setErreur(null)
    } catch (e) {
      setErreur(String(e))
    }
  }

  useEffect(() => {
    relire()
    // Deux secondes : le journal ne bouge que d'une ligne par seconde, et cet
    // écran n'est regardé qu'au début et à la fin du test.
    const id = window.setInterval(relire, 2000)
    return () => window.clearInterval(id)
  }, [])

  const perdus = etat ? Math.max(0, etat.attendus - etat.ticks) : 0
  // Le verdict n'a de sens qu'après un test réellement mené : avant, il dirait
  // « réussi » sur un journal vide.
  const juge = etat != null && etat.dureeMs > 60_000
  const reussi = juge && etat.trous === 0 && etat.redemarrages === 0

  return (
    <main className="poc">
      <header className="poc__head">
        <span className="label">PoC — survie en arrière-plan</span>
        <button type="button" className="poc__close" onClick={onClose}>
          Fermer
        </button>
      </header>

      {erreur && <p className="poc__err">{erreur}</p>}

      {etat && (
        <>
          <p className={`poc__verdict${juge ? (reussi ? ' poc__verdict--ok' : ' poc__verdict--ko') : ''}`}>
            {etat.actif
              ? 'Test en cours'
              : !juge
                ? 'Aucun test mené'
                : reussi
                  ? 'Aucune interruption'
                  : 'Interrompu'}
          </p>

          <dl className="poc__grid">
            <Ligne k="Durée" v={duree(etat.dureeMs)} />
            <Ligne k="Battements reçus" v={`${etat.ticks} / ${etat.attendus}`} />
            <Ligne k="Battements perdus" v={String(perdus)} fort={perdus > 0} />
            <Ligne k="Plus long silence" v={`${(etat.trouMax / 1000).toFixed(1)} s`} fort={etat.trouMax > 5000} />
            <Ligne k="Silences > 5 s" v={String(etat.trous)} fort={etat.trous > 0} />
            <Ligne k="Relances Android" v={String(etat.redemarrages)} fort={etat.redemarrages > 0} />
            <Ligne
              k="Batterie"
              v={etat.batterieDebut < 0 ? `${etat.batterie} %` : `${etat.batterieDebut} % → ${etat.batterie} %`}
            />
            <Ligne
              k="Exemptée d'optimisation"
              v={etat.exempteBatterie ? 'oui' : 'non'}
              fort={!etat.exempteBatterie}
            />
          </dl>

          <div className="poc__actions">
            {etat.actif ? (
              <button type="button" className="poc__btn" onClick={() => Survie.arreter().then(relire)}>
                Arrêter le test
              </button>
            ) : (
              <button type="button" className="poc__btn poc__btn--go" onClick={() => Survie.demarrer().then(relire)}>
                Démarrer le test
              </button>
            )}
            {!etat.exempteBatterie && (
              <button type="button" className="poc__btn" onClick={() => Survie.exemptionBatterie()}>
                Exempter d'optimisation batterie
              </button>
            )}
          </div>

          <p className="poc__aide">
            Démarrer, puis verrouiller le téléphone et vivre normalement pendant
            quatre heures. Un nouveau démarrage efface le journal précédent.
          </p>
        </>
      )}
    </main>
  )
}

function Ligne({ k, v, fort }: { k: string; v: string; fort?: boolean }) {
  return (
    <>
      <dt className="label">{k}</dt>
      <dd className={fort ? 'poc__v poc__v--fort' : 'poc__v'}>{v}</dd>
    </>
  )
}
