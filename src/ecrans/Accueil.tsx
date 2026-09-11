import { useLiveQuery } from 'dexie-react-hooks'
import { type ReactNode, useState } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  OverlayArrow,
  Popover,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components'
import { db } from '../db/db'
import type { Session } from '../db/schema'
import {
  type Fenetre,
  type Tendance,
  dansFenetre,
  efficienceMoyenne,
  efficiences,
  fenetrePrecedente,
  puissanceMoyenne,
  tendance,
  volumeParSemaine,
  volumeS,
} from '../metrics/bilan'
import './Accueil.css'

const FENETRES: { id: Fenetre; libelle: string; depuis: string }[] = [
  { id: '4s', libelle: '4 semaines', depuis: 'depuis 4 semaines' },
  { id: '3m', libelle: '3 mois', depuis: 'depuis 3 mois' },
  { id: 'tout', libelle: 'Tout', depuis: '' },
]

const fr = (n: number, decimales: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

/** « 4h05 », ou « 35 min » sous l'heure. */
function duree(secondes: number) {
  const minutes = Math.round(secondes / 60)
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h}h${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`
}

export default function Accueil() {
  const sessions = useLiveQuery(() => db.sessions.filter((s) => !s.deletedAt).toArray())
  const [fenetre, setFenetre] = useState<Fenetre>('4s')

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
        <AvecEfficience
          ef={ef}
          serie={efficiences(actuelles)}
          actuelles={actuelles}
          tendance={tendance(ef, efficienceMoyenne(fenetrePrecedente(sessions, fenetre, now)))}
          depuis={FENETRES.find((f) => f.id === fenetre)!.depuis}
        />
      )}
    </div>
  )
}

function SelecteurFenetre({
  fenetre,
  onChange,
  isDisabled,
}: {
  fenetre?: Fenetre
  onChange?: (f: Fenetre) => void
  isDisabled?: boolean
}) {
  return (
    <ToggleButtonGroup
      className="window"
      aria-label="Période"
      selectionMode="single"
      disallowEmptySelection
      isDisabled={isDisabled}
      selectedKeys={fenetre ? [fenetre] : []}
      onSelectionChange={(keys) => onChange?.([...keys][0] as Fenetre)}
    >
      {FENETRES.map((f) => (
        <ToggleButton key={f.id} id={f.id} className="seg">
          {f.libelle}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

/* ---------- 01 : l'efficience en héros ---------- */

function AvecEfficience({
  ef,
  serie,
  actuelles,
  tendance,
  depuis,
}: {
  ef: number
  serie: number[]
  actuelles: Session[]
  tendance: Tendance | null
  depuis: string
}) {
  const puissance = puissanceMoyenne(actuelles)
  return (
    <>
      <div className="eyebrow">Efficience</div>
      <div className="gloss">watts produits par battement de cœur</div>
      <div className="value">{fr(ef, 2)}</div>
      {tendance && (
        <div className={`trend${tendance.sens === 'hausse' ? ' better' : ''}`}>
          {tendance.sens === 'stable'
            ? `stable ${depuis}`
            : `${tendance.sens === 'hausse' ? '↑' : '↓'} ${fr(Math.abs(tendance.variation) * 100, 1)} % ${depuis}`}
        </div>
      )}
      <Sparkline serie={serie} />
      <div className="rows">
        <div className="row">
          <span className="lab">Volume</span>
          <span className="fill" />
          <span className="val">{duree(volumeS(actuelles))}</span>
        </div>
        <div className="row">
          <span className="lab">Puissance moyenne</span>
          <span className="fill" />
          <span className="val">
            {puissance === null ? '—' : <>{Math.round(puissance)}<em>W</em></>}
          </span>
        </div>
        <Decouplage />
      </div>
    </>
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
  const puissance = puissanceMoyenne(actuelles)
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
        <div className="row">
          <span className="lab">Puissance moyenne</span>
          <span className="fill" />
          <span className="val">
            {puissance === null ? '—' : <>{Math.round(puissance)}<em>W</em></>}
          </span>
        </div>
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

/** Le « ? » : cible de 40 px, glyphe de 16 px, explication repliée dans une bulle. */
function Aide({ children }: { children: ReactNode }) {
  return (
    <DialogTrigger>
      <Button className="help" aria-label="Pourquoi ?">
        <i>?</i>
      </Button>
      <Popover className="pop" placement="top" offset={10} containerPadding={22}>
        <OverlayArrow className="pop__arrow">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M0 0 L6 6 L12 0" /></svg>
        </OverlayArrow>
        <Dialog>{children}</Dialog>
      </Popover>
    </DialogTrigger>
  )
}

/* ---------- 03 : premier lancement ---------- */

function PremierLancement() {
  return (
    <div className="accueil accueil--vide">
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
      <span className="fill" />
      <div className="point">
        <span>↓</span>
        <span>Enregistre ta première séance</span>
      </div>
    </div>
  )
}
