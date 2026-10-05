import { Capacitor, registerPlugin } from '@capacitor/core'
import { useSyncExternalStore } from 'react'
import { DEPART, type Ligne, type Signal, signalEtat, signalFc, suivant } from './ligne'

/** Le greffon natif `CapteurPlugin.kt`. */
interface CapteurPlugin {
  connecter(): Promise<{ lance: boolean }>
  annuler(): Promise<void>
  deconnecter(): Promise<void>
  addListener(evenement: 'etat' | 'fc', rappel: (donnees: unknown) => void): Promise<unknown>
}

const Capteur = registerPlugin<CapteurPlugin>('Capteur')

/*
 * L'état vit hors des composants : la liaison survit au changement d'onglet,
 * seul quitter l'application la coupe (sujet 16). Revenir aux Réglages doit
 * donc retrouver la ligne telle qu'on l'a laissée.
 *
 * Dans le navigateur (`npm run dev`), le greffon n'existe pas : la ligne reste
 * à « Connecter » et l'appui ne fait rien.
 */
const natif = Capacitor.isPluginAvailable('Capteur')
let ligne: Ligne = DEPART
const abonnes = new Set<() => void>()
let branche = false

function envoyer(s: Signal) {
  ligne = suivant(ligne, s)
  abonnes.forEach((f) => f())
}

// Un signal mal formé ne peut venir que d'un défaut du code natif : il est
// écarté plutôt que de casser l'affichage.
function brancher() {
  if (branche || !natif) return
  branche = true
  void Capteur.addListener('etat', (d) => {
    const r = signalEtat.safeParse(d)
    if (r.success) envoyer({ type: 'etat', signal: r.data })
  })
  void Capteur.addListener('fc', (d) => {
    const r = signalFc.safeParse(d)
    if (r.success) envoyer({ type: 'fc', bpm: r.data.bpm })
  })
}

function abonner(f: () => void) {
  brancher()
  abonnes.add(f)
  return () => {
    abonnes.delete(f)
  }
}

/*
 * La coupure n'est appliquée qu'une fois le natif revenu : les signaux émis
 * avant l'arrêt passent le pont avant la réponse, et ne peuvent donc plus
 * rallumer la ligne derrière elle.
 */
async function couper(action: () => Promise<void>) {
  if (natif) await action()
  envoyer({ type: 'coupe' })
}

const actions = {
  connecter: () => {
    if (natif) void Capteur.connecter()
  },
  annuler: () => void couper(() => Capteur.annuler()),
  deconnecter: () => void couper(() => Capteur.deconnecter()),
}

export function useCapteur() {
  return { ligne: useSyncExternalStore(abonner, () => ligne), ...actions }
}
