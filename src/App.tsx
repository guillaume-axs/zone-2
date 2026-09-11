import { useEffect } from 'react'
import { App as Android } from '@capacitor/app'
import { RouterProvider } from 'react-aria-components'
import { Route, Routes, useHref, useNavigate } from 'react-router'
import Accueil from './ecrans/Accueil'
import Efficience from './ecrans/Efficience'
import Historique from './ecrans/Historique'
import NouvelleSeance from './ecrans/NouvelleSeance'
import Onglets from './ecrans/Onglets'
import EcranSurvie from './poc/Survie'

export default function App() {
  const navigate = useNavigate()

  /**
   * Bouton retour Android. Les onglets sont des destinations de premier niveau
   * (Material) : retour ramène à l'Accueil, et depuis l'Accueil quitte
   * l'application — aucun historique à dérouler.
   */
  useEffect(() => {
    const ecouteur = Android.addListener('backButton', () => {
      if (window.location.pathname === '/') Android.exitApp()
      else navigate('/')
    })
    return () => {
      ecouteur.then((e) => e.remove())
    }
  }, [navigate])

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <Routes>
        <Route element={<Onglets />}>
          <Route index element={<Accueil />} />
          <Route path="efficience" element={<Efficience />} />
          <Route path="historique" element={<Historique />} />
          <Route path="reglages" element={<EcranSurvie />} />
        </Route>
        <Route path="seance/nouvelle" element={<NouvelleSeance />} />
      </Routes>
    </RouterProvider>
  )
}
