import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-aria-components'
import { db } from '../db/db'
import type { Session } from '../db/schema'
import {
  dansFenetre,
  efficienceMoyenne,
  efficiences,
  fenetrePrecedente,
  puissanceMoyenne,
  tendance,
  volumeParSemaine,
  volumeS,
} from '../metrics/bilan'
import { Aide, SelecteurFenetre, Valeur } from './Bilan'
import { FENETRES, useFenetre } from './fenetre'
import { duree, fr } from './format'
import './Accueil.css'

export default function Accueil() {
  const sessions = useLiveQuery(() => db.sessions.filter((s) => !s.deletedAt).toArray())
  const [fenetre, setFenetre] = useFenetre()

  if (sessions === undefined) return null
  if (sessions.length === 0) return <PremierLancement />

  const now = new Date()
  const actuelles = dansFenetre(sessions, fenetre, now)
  const ef = efficienceMoyenne(actuelles)

  return (
    <div className="accueil">
      <SelecteurFenetre fenetre={fenetre} onChange={setFenetre} />
      {ef === null ? (
        <SansFrequenceCardiaque sessions={sessions} actuelles={actuelles} now={now} />
      ) : (
        <>
          {/* Le héros entier ouvre le détail : un seul chiffre mis en avant, une seule porte. */}
          <Link href={`/efficience?f=${fenetre}`} className="hero">
            <div className="hero-titre">
              <span className="eyebrow">Efficience</span>
              <svg className="chevron" viewBox="0 0 8 14" aria-hidden="true">
                <path d="M1 1l6 6-6 6" />
              </svg>
            </div>
            <div className="gloss">watts produits par battement de cœur</div>
            <Valeur
              texte={fr(ef, 2)}
              tendance={tendance(ef, efficienceMoyenne(fenetrePrecedente(sessions, fenetre, now)))}
              depuis={FENETRES.find((f) => f.id === fenetre)!.depuis}
            />
            <Sparkline serie={efficiences(actuelles)} />
          </Link>
          <div className="rows">
            <div className="row">
              <span className="lab">Volume</span>
              <span className="fill" />
              <span className="val">{duree(volumeS(actuelles))}</span>
            </div>
            <Puissance sessions={actuelles} />
            <Decouplage />
          </div>
        </>
      )}
    </div>
  )
}

/** Une ligne par séance, la dernière marquée d'un point. */
function Sparkline({ serie }: { serie: number[] }) {
  const min = Math.min(...serie)
  const max = Math.max(...serie)
  const points = serie.map((v, i) => {
    const x = serie.length === 1 ? 308 : 4 + (i * 304) / (serie.length - 1)
    const y = max === min ? 48 : 84 - ((v - min) * 72) / (max - min)
    return [x, y] as const
  })
  const [dx, dy] = points[points.length - 1]
  return (
    <svg className="spark" viewBox="0 0 316 96" fill="none" aria-hidden="true">
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={dx} cy={dy} r="3.2" fill="var(--accent)" />
    </svg>
  )
}

/* ---------- 02 : sans fréquence cardiaque, le volume prend le héros ---------- */

function SansFrequenceCardiaque({
  sessions,
  actuelles,
  now,
}: {
  sessions: Session[]
  actuelles: Session[]
  now: Date
}) {
  const semaines = volumeParSemaine(sessions, now, 4)
  const courante = semaines[3]
  const ecartS = courante - semaines[2]
  const plafond = Math.max(...semaines, 1)
  return (
    <>
      <div className="eyebrow">Volume hebdomadaire</div>
      <div className="gloss">temps passé sur le vélo cette semaine</div>
      <div className="value">{duree(courante)}</div>
      <div className={`trend${ecartS > 0 ? ' better' : ''}`}>
        {Math.abs(ecartS) < 30
          ? 'stable depuis la semaine passée'
          : `${ecartS > 0 ? '↑' : '↓'} ${duree(Math.abs(ecartS))} depuis la semaine passée`}
      </div>
      <div className="bars" aria-hidden="true">
        {semaines.map((v, i) => (
          <div key={i} className={`bar${i === 3 ? ' now' : ''}`} style={{ height: `${(v / plafond) * 100}%` }} />
        ))}
      </div>
      <div className="barlabels" aria-hidden="true">
        <span>S-3</span><span>S-2</span><span>S-1</span><span>S</span>
      </div>
      <div className="rows">
        <Puissance sessions={actuelles} />
        <div className="row off">
          <span className="lab">Efficience</span>
          <Aide>
            Aucune séance de cette période ne porte de fréquence cardiaque. Renseigne-la à la
            saisie et l’efficience apparaîtra ici.
          </Aide>
          <span className="fill" />
          <span className="val">indisponible</span>
        </div>
        <Decouplage />
      </div>
    </>
  )
}

function Puissance({ sessions }: { sessions: Session[] }) {
  const puissance = puissanceMoyenne(sessions)
  return (
    <div className="row">
      <span className="lab">Puissance moyenne</span>
      <span className="fill" />
      <span className="val">
        {puissance === null ? '—' : <>{Math.round(puissance)}<em>W</em></>}
      </span>
    </div>
  )
}

function Decouplage() {
  return (
    <div className="row off">
      <span className="lab">Découplage cardiaque</span>
      <Aide>
        Le découplage compare l’efficience de la première et de la seconde moitié de séance.
        Il demande la fréquence cardiaque en continu — elle arrive avec la ceinture.
      </Aide>
      <span className="fill" />
      <span className="val">indisponible</span>
    </div>
  )
}

/* ---------- 03 : premier lancement ---------- */

function PremierLancement() {
  return (
    <div className="accueil">
      <SelecteurFenetre isDisabled />
      <div className="eyebrow">Efficience</div>
      <div className="gloss">watts produits par battement de cœur</div>
      <div className="value ghost"><i /></div>
      <svg className="spark" viewBox="0 0 316 96" fill="none" aria-hidden="true">
        <g className="draw">
          <path
            d="M4 70 C 60 78, 90 48, 140 52 S 220 30, 308 22"
            stroke="var(--fg-5)"
            strokeWidth="1.6"
            strokeDasharray="3 5"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div className="rows">
        {['Volume', 'Puissance moyenne', 'Découplage cardiaque'].map((lab) => (
          <div key={lab} className="row ghost">
            <span className="lab">{lab}</span>
            <span className="fill" />
            <span className="val">—</span>
          </div>
        ))}
      </div>
      {/* Hors du flux : ancré au bouton « + », qui est lui-même fixe. */}
      <div className="point">
        <span>↓</span>
        <span>Enregistre ta première séance</span>
      </div>
    </div>
  )
}
