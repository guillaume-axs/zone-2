import { useEffect, useState } from 'react'
import { registerPlugin } from '@capacitor/core'
import './Survie.css'

/**
 * PoC — la liaison avec la ceinture tient-elle quatre heures, écran verrouillé ?
 *
 * L'étage 1 a répondu à une autre question : le *processus* survit-il ? Verdict
 * du 2026-08-28, mesuré avec un faux cœur : zéro relance sur 9 h 30. Un service
 * bien vivant peut pourtant perdre son Bluetooth sans que rien ne le signale, et
 * c'est ce que cet étage-ci mesure, avec un vrai capteur en face.
 *
 * Rien ici n'appartient à l'application : cet écran est un instrument de mesure,
 * il disparaîtra avec le PoC. Le seul travail réel est fait par `SurvieService`,
 * qui reçoit les battements et les écrit sur disque. Ce que le JavaScript affiche
 * n'est qu'un dépouillement — il ne compte rien lui-même, et surtout il ne tourne
 * pas pendant le test : la WebView est gelée par Android cinq minutes après le
 * verrouillage, et c'est précisément ce dont on se moque.
 */
type Etat = {
  actif: boolean
  /** État de la liaison en direct : sert à diagnostiquer un test qui ne démarre pas. */
  etatLiaison: string
  bpm: number
  debut: number
  fin: number
  dureeMs: number
  battements: number
  /** Battements reçus avec « pas de contact peau » : électrode sèche, pas panne de liaison. */
  sansContact: number
  /** Trames portant plusieurs intervalles : la ceinture avait mis des battements en file. */
  tramesGroupees: number
  /** Temps cumulé sans aucun battement reçu, en millisecondes. */
  sansBattementMs: number
  /** Part de ce temps passée à chercher puis joindre la ceinture, au démarrage. */
  delaiConnexionMs: number
  /** Part de ce temps où la liaison était tombée, et où on le savait. */
  deconnecteMs: number
  /** Part de ce temps où la liaison se croyait vivante — la panne silencieuse. */
  silencieuxMs: number
  /** Plus grand silence entre deux battements, en millisecondes. */
  trouMax: number
  decrochages: number
  retours: number
  /** Décrochages dont on n'est jamais revenu. C'est le critère bloquant. */
  definitifs: number
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

/** Sous la minute, la seconde compte : c'est l'échelle des trous qu'on mesure. */
function dureeCourte(ms: number) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

const LIAISON: Record<string, string> = {
  RECHERCHE: 'recherche…',
  TROUVEE: 'trouvée',
  CONNECTEE: 'connectée',
  DECROCHEE: 'décrochée',
  ECHEC: 'Bluetooth indisponible',
}

export default function EcranSurvie() {
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

  // Le verdict n'a de sens qu'après un test réellement mené : avant, il dirait
  // « réussi » sur un journal vide.
  const juge = etat != null && etat.dureeMs > 60_000
  const couverture = etat && etat.dureeMs > 0 ? (1 - etat.sansBattementMs / etat.dureeMs) * 100 : 0
  // Bloquant : un décrochage définitif, ou un service tué. La couverture, elle,
  // n'interdit pas d'avancer — elle signale qu'il reste quelque chose à
  // comprendre. En août, avec un faux cœur, on était à 99,5 %.
  const perdu = juge && (etat.definitifs > 0 || etat.redemarrages > 0)
  const douteux = juge && !perdu && couverture < 99

  return (
    <div className="poc">
      <span className="label">PoC — liaison ceinture en arrière-plan</span>

      {erreur && <p className="poc__err">{erreur}</p>}

      {etat && (
        <>
          <p
            className={
              'poc__verdict' +
              (perdu ? ' poc__verdict--ko' : douteux ? ' poc__verdict--tiede' : juge ? ' poc__verdict--ok' : '')
            }
          >
            {etat.actif
              ? `Test en cours · ${LIAISON[etat.etatLiaison] ?? 'démarrage'}`
              : !juge
                ? 'Aucun test mené'
                : perdu
                  ? 'Liaison perdue'
                  : douteux
                    ? 'Tenue, mais à comprendre'
                    : 'Liaison tenue'}
          </p>

          <dl className="poc__grid">
            <Ligne k="Durée" v={duree(etat.dureeMs)} />
            <Ligne k="Couverture" v={`${couverture.toFixed(1)} %`} fort={couverture < 99} />
            <Ligne k="Battements reçus" v={String(etat.battements)} />
            {etat.actif && etat.bpm > 0 && <Ligne k="Fréquence" v={`${etat.bpm} bpm`} />}

            <Ligne k="Temps sans battement" v={dureeCourte(etat.sansBattementMs)} fort={etat.sansBattementMs > 0} />
            <Ligne k="— dont connexion initiale" v={dureeCourte(etat.delaiConnexionMs)} />
            <Ligne k="— dont déconnecté" v={dureeCourte(etat.deconnecteMs)} />
            <Ligne k="— dont silencieux" v={dureeCourte(etat.silencieuxMs)} fort={etat.silencieuxMs > 0} />
            <Ligne k="Plus long trou" v={`${(etat.trouMax / 1000).toFixed(1)} s`} fort={etat.trouMax > 5000} />

            <Ligne k="Décrochages" v={`${etat.decrochages} · ${etat.retours} retours`} fort={etat.decrochages > 0} />
            <Ligne k="Définitifs" v={String(etat.definitifs)} fort={etat.definitifs > 0} />
            <Ligne k="Relances Android" v={String(etat.redemarrages)} fort={etat.redemarrages > 0} />

            <Ligne k="Battements sans contact peau" v={String(etat.sansContact)} fort={etat.sansContact > 0} />
            <Ligne k="Trames groupées" v={String(etat.tramesGroupees)} />
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
            Humidifier les électrodes, mettre la ceinture, démarrer, puis verrouiller
            le téléphone et vivre normalement pendant quatre heures. Un nouveau
            démarrage efface le journal précédent.
          </p>
        </>
      )}
    </div>
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
