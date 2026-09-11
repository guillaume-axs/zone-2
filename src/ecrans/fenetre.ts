import { useSearchParams } from 'react-router'
import type { Fenetre } from '../metrics/bilan'

export const FENETRES: { id: Fenetre; libelle: string; depuis: string }[] = [
  { id: '4s', libelle: '4 semaines', depuis: 'depuis 4 semaines' },
  { id: '3m', libelle: '3 mois', depuis: 'depuis 3 mois' },
  { id: 'tout', libelle: 'Tout', depuis: '' },
]

/** La période vit dans l'URL (`?f=3m`) : le détail s'ouvre sur celle de l'Accueil et le retour la garde. */
export function useFenetre(): [Fenetre, (f: Fenetre) => void] {
  const [params, setParams] = useSearchParams()
  const f = params.get('f')
  const fenetre = FENETRES.some((x) => x.id === f) ? (f as Fenetre) : '4s'
  return [fenetre, (f) => setParams({ f }, { replace: true })]
}
