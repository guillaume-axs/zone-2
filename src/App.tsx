import { useEffect } from 'react'
import { App as Android } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { RouterProvider } from 'react-aria-components'
import { Route, Routes, useHref, useNavigate } from 'react-router'
import Accueil from './ecrans/Accueil'
import Efficience from './ecrans/Efficience'
import Historique from './ecrans/Historique'
import NouvelleSeance from './ecrans/NouvelleSeance'
import Onglets from './ecrans/Onglets'
import Zone2 from './ecrans/Zone2'
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
      const chemin = window.location.pathname
      if (chemin === '/') Android.exitApp()
      // Un sous-écran de réglage remonte d'un niveau, pas jusqu'à l'Accueil :
      // c'est le comportement attendu du retour sur une destination imbriquée.
      else if (chemin.startsWith('/reglages/')) navigate('/reglages')
      else navigate('/')
    })
    return () => {
      ecouteur.then((e) => e.remove())
    }
  }, [navigate])

  /**
   * L'écran de lancement (launchAutoHide: false) tombe une fois les polices
   * prêtes : la première image visible est composée, avec les marges système
   * déjà appliquées — plus de saut au lancement.
   */
  useEffect(() => {
    document.fonts.ready.then(() => SplashScreen.hide())
  }, [])

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
        {/* Plein écran, hors du gabarit des onglets : le bouton flottant y
            occuperait le bas, où se trouve « Enregistrer » (sujet 13). */}
        <Route path="reglages/zone-2" element={<Zone2 />} />
      </Routes>
    </RouterProvider>
  )
}
