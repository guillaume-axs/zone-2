import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/typo.css'
import App from './App.tsx'

// Rien ne s'affiche avant les polices : un texte en `font-display: block` est
// invisible, mais pas son cadre, dont la place est d'abord calculée avec la
// police de secours puis saute à l'arrivée de la vraie. Chaque face déclarée
// dans fonts.css est chargée, pas seulement celles que la page a déjà
// demandées. Au-delà de 3 s, la durée de blocage du navigateur, on affiche
// quand même : une police manquante ne doit pas bloquer l'app.
await Promise.race([
  Promise.allSettled([...document.fonts].map((f) => f.load())),
  new Promise((r) => setTimeout(r, 3000)),
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
