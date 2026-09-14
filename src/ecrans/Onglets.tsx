import { useLiveQuery } from 'dexie-react-hooks'
import {
  Button,
  Link,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { db } from '../db/db'
import { softDeleteSession } from '../db/sessions'
import { DUREE_TOAST_MS, type Enregistrement, enregistrements } from './toast'
import './Onglets.css'

const ONGLETS = [
  {
    href: '/',
    nom: 'Accueil',
    icone: <path d="M3 9.6 11 3.4l8 6.2V19H3z" strokeLinejoin="round" />,
  },
  {
    href: '/historique',
    nom: 'Historique',
    icone: <path d="M4 6h14M4 11h14M4 16h9" strokeLinecap="round" />,
  },
  {
    href: '/reglages',
    nom: 'Réglages',
    icone: (
      <>
        <path d="M3 7.5h16M3 14.5h16" strokeLinecap="round" />
        <circle cx="8" cy="7.5" r="2.3" />
        <circle cx="14.5" cy="14.5" r="2.3" />
      </>
    ),
  },
]

/**
 * Gabarit des destinations de premier niveau (sujet 3) : la page, la barre
 * d'onglets, le bouton flottant vers la saisie et le toast qui annonce une
 * séance enregistrée. Le formulaire, lui, occupe tout l'écran et ne passe pas
 * par ici.
 */
export default function Onglets() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Le détail de l'efficience est une page de l'Accueil : même onglet actif, pas de bouton flottant.
  const detail = pathname === '/efficience'
  // Tant qu'aucune séance n'existe, le bouton pulse pour appeler la première saisie.
  const vide = useLiveQuery(() => db.sessions.filter((s) => !s.deletedAt).count()) === 0

  /** Suppression logique, puis retour au formulaire pré-rempli : on corrige, on ne retape pas. */
  async function annuler(cle: string, { id, input }: Enregistrement) {
    await softDeleteSession(id)
    enregistrements.close(cle)
    navigate('/seance/nouvelle', { state: { brouillon: input } })
  }

  return (
    <div className="onglets">
      <main className={detail ? 'onglets__page onglets__page--sans-fab' : 'onglets__page'}>
        <Outlet />
      </main>

      {!detail && (
      <Link href="/seance/nouvelle" className={vide ? 'fab fab--pulse' : 'fab'} aria-label="Nouvelle séance">
        <svg width="21" height="21" viewBox="0 0 21 21" fill="none" aria-hidden="true">
          <path d="M10.5 3.6v13.8M3.6 10.5h13.8" stroke="var(--bg)" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </Link>
      )}

      <ToastRegion queue={enregistrements} className="toasts">
        {({ toast }) => (
          <Toast toast={toast} className="toast" style={{ viewTransitionName: toast.key }}>
            <ToastContent>
              <Text slot="title">Séance enregistrée</Text>
            </ToastContent>
            <Button className="toast__annuler" onPress={() => annuler(toast.key, toast.content)}>
              Annuler
            </Button>
            <Button slot="close" className="toast__fermer" aria-label="Fermer">
              {/* L'anneau se vide sur la durée du toast : on voit venir sa disparition. */}
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <circle
                  className="toast__anneau"
                  cx="18"
                  cy="18"
                  r="16"
                  pathLength="100"
                  transform="rotate(-90 18 18)"
                  style={{ animationDuration: `${DUREE_TOAST_MS}ms` }}
                />
                <path d="M13 13l10 10M23 13L13 23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Button>
          </Toast>
        )}
      </ToastRegion>

      <nav className="nav">
        {ONGLETS.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="nav__item"
            aria-current={pathname === o.href || (detail && o.href === '/') ? 'page' : undefined}
          >
            <svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              {o.icone}
            </svg>
            <span>{o.nom}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
