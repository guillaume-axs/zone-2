import type { ReactNode } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  OverlayArrow,
  Popover,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components'
import type { Fenetre, Tendance } from '../metrics/bilan'
import { FENETRES } from './fenetre'
import { fr } from './format'
import './Bilan.css'

/* Pièces communes à l'Accueil et au Détail : la période, le héros, la bulle d'aide. */

export function SelecteurFenetre({
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

/** Le chiffre héros et sa tendance. Accent = amélioration, gris = dégradation ou stable. */
export function Valeur({ texte, tendance, depuis }: { texte: string; tendance: Tendance | null; depuis: string }) {
  return (
    <>
      <div className="value">{texte}</div>
      {tendance && (
        <div className={`trend${tendance.sens === 'hausse' ? ' better' : ''}`}>
          {tendance.sens === 'stable'
            ? `stable ${depuis}`
            : `${tendance.sens === 'hausse' ? '↑' : '↓'} ${fr(Math.abs(tendance.variation) * 100, 1)} % ${depuis}`}
        </div>
      )}
    </>
  )
}

/** Le « ? » : cible de 40 px, glyphe de 16 px, explication repliée dans une bulle. */
export function Aide({ children }: { children: ReactNode }) {
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
