import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-aria-components'
import { db } from '../db/db'
import type { Session } from '../db/schema'
import { dansFenetre, efficienceMoyenne, fenetrePrecedente, tendance } from '../metrics/bilan'
import { efficiency } from '../metrics/efficiency'
import { Aide, SelecteurFenetre, Valeur } from './Bilan'
import { FENETRES, useFenetre } from './fenetre'
import { duree, fr } from './format'
import './Efficience.css'

const MOIS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']
const date = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()} ${MOIS[d.getMonth()]}`
}

type Point = { session: Session; ef: number }

/** Détail de l'efficience (écran 04) : la courbe séance par séance et les dernières séances. */
export default function Efficience() {
  const sessions = useLiveQuery(() => db.sessions.filter((s) => !s.deletedAt).toArray())
  const [fenetre, setFenetre] = useFenetre()

  if (sessions === undefined) return null

  const now = new Date()
  const actuelles = dansFenetre(sessions, fenetre, now)
  const ef = efficienceMoyenne(actuelles)
  const points = actuelles.flatMap((session) => {
    const ef = efficiency(session)
    return ef === null ? [] : [{ session, ef }]
  })

  return (
    <div className="detail">
      <div className="back">
        <Link href={`/?f=${fenetre}`} className="back__arrow" aria-label="Retour à l’accueil">
          {/* Tracé plutôt que le caractère « ← » : le glyphe n'était pas centré
              sur le label, ses métriques dépendant de la police. */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M16 10H4M9 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <span className="back__title">Efficience</span>
        <Aide>
          Puissance moyenne divisée par fréquence cardiaque moyenne : les watts produits par
          battement de cœur. Progresser, c’est produire plus à fréquence égale.
        </Aide>
      </div>
      <SelecteurFenetre fenetre={fenetre} onChange={setFenetre} />
      <Valeur
        texte={ef === null ? '—' : fr(ef, 2)}
        tendance={tendance(ef, efficienceMoyenne(fenetrePrecedente(sessions, fenetre, now)))}
        depuis={FENETRES.find((f) => f.id === fenetre)!.depuis}
      />
      {points.length === 0 ? (
        <p className="detail__vide">Aucune séance avec fréquence cardiaque sur cette période.</p>
      ) : (
        <>
          <Courbe key={fenetre} points={points} />
          <div className="listhead">Dernières séances</div>
          <div className="recent">
            {points.slice(-5).reverse().map(({ session: s, ef }) => (
              <div key={s.id} className="row">
                <span className="date">{date(s.startedAt)}</span>
                <span className="meta">
                  {duree(s.durationS)} · {s.avgPowerW} W · {s.avgHrBpm} bpm
                </span>
                <span className="num">{fr(ef, 2)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* Géométrie de la maquette : 316 × 170, tracé entre x 40–306 et y 10–140. */
const X0 = 40
const X1 = 306
const Y0 = 10
const Y1 = 140

/**
 * La courbe, un point par séance. Le dernier point est sélectionné à
 * l'ouverture ; un tap n'importe où sur la courbe prend le point le plus
 * proche en abscisse — pas de cible fine à viser sur un vélo.
 */
function Courbe({ points }: { points: Point[] }) {
  const [choisi, setChoisi] = useState(points.length - 1)

  const valeurs = points.map((p) => p.ef)
  let bas = Math.floor(Math.min(...valeurs) * 10) / 10
  const haut = Math.ceil(Math.max(...valeurs) * 10) / 10
  if (bas === haut) bas -= 0.1
  const x = (i: number) => (points.length === 1 ? X1 : X0 + (i * (X1 - X0)) / (points.length - 1))
  const y = (v: number) => Y1 - ((v - bas) * (Y1 - Y0)) / (haut - bas)

  const choisir = (e: React.PointerEvent<SVGSVGElement>) => {
    const boite = e.currentTarget.getBoundingClientRect()
    const cx = ((e.clientX - boite.left) * 316) / boite.width
    let plusProche = 0
    points.forEach((_, i) => {
      if (Math.abs(x(i) - cx) < Math.abs(x(plusProche) - cx)) plusProche = i
    })
    setChoisi(plusProche)
  }

  const p = points[choisi]
  const sx = x(choisi)
  const dernier = points.length - 1
  const milieu = Math.floor(dernier / 2)

  return (
    <svg className="chart" viewBox="0 0 316 170" fill="none" onPointerDown={choisir} aria-hidden="true">
      <g stroke="var(--rule-2)" strokeWidth="1">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${X0 - 6} ${Y0 + (i * (Y1 - Y0)) / 4}h${X1 - X0 + 6 + 10}`} />
        ))}
      </g>
      <g className="chart__axe" textAnchor="end">
        <text x="26" y={Y0 + 3.5}>{fr(haut, 2)}</text>
        <text x="26" y={(Y0 + Y1) / 2 + 3.5}>{fr((haut + bas) / 2, 2)}</text>
        <text x="26" y={Y1 + 3.5}>{fr(bas, 2)}</text>
      </g>

      <path d={`M${sx} ${Y0}v${Y1 - Y0}`} stroke="var(--fg-4)" strokeWidth="1" strokeDasharray="2 3" />
      <text
        className="chart__choisi"
        x={sx > 200 ? sx - 7 : sx + 7}
        y={Y0 + 11}
        textAnchor={sx > 200 ? 'end' : 'start'}
      >
        {fr(p.ef, 2)} · {date(p.session.startedAt)}
      </text>

      <polyline
        points={points.map((p, i) => `${x(i).toFixed(1)},${y(p.ef).toFixed(1)}`).join(' ')}
        stroke="var(--accent)"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.4">
        {points.map((p, i) => i !== choisi && <circle key={p.session.id} cx={x(i)} cy={y(p.ef)} r="2.6" />)}
      </g>
      <circle cx={sx} cy={y(p.ef)} r="4" fill="var(--accent)" />

      <g className="chart__axe">
        <text x={X0} y="163">{date(points[0].session.startedAt)}</text>
        {dernier >= 2 && (
          <text x={x(milieu)} y="163" textAnchor="middle">{date(points[milieu].session.startedAt)}</text>
        )}
        {dernier >= 1 && (
          <text x={X1 + 4} y="163" textAnchor="end">{date(points[dernier].session.startedAt)}</text>
        )}
      </g>
    </svg>
  )
}
