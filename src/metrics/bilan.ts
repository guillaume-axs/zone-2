import type { Session } from '../db/schema'
import { efficiency } from './efficiency'

/**
 * Bilan d'une fenêtre de temps — ce que l'Accueil affiche (sujet 4 : tout se
 * calcule à la lecture, rien n'est stocké).
 *
 * Toutes les fonctions sont pures : elles reçoivent les séances vivantes
 * (déjà filtrées de `deletedAt`) et l'instant courant, jamais la base.
 */

export type Fenetre = '4s' | '3m' | 'tout'

const JOURS: Record<Exclude<Fenetre, 'tout'>, number> = { '4s': 28, '3m': 90 }
const MS_PAR_JOUR = 86_400_000

/**
 * Seuil sous lequel une variation d'efficience est dite « stable ».
 * Provisoire : fixé à 1 % sans données réelles, à revoir vers décembre 2026
 * après trois mois de séances.
 */
export const SEUIL_TENDANCE = 0.01

function entre(sessions: Session[], debut: number, fin: number) {
  return sessions.filter((s) => {
    const t = new Date(s.startedAt).getTime()
    return t >= debut && t < fin
  })
}

/** Séances de la fenêtre qui se termine à `now`, du plus ancien au plus récent. */
export function dansFenetre(sessions: Session[], fenetre: Fenetre, now: Date) {
  const tri = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  if (fenetre === 'tout') return tri
  const fin = now.getTime() + 1
  return entre(tri, fin - JOURS[fenetre] * MS_PAR_JOUR, fin)
}

/** Séances de la fenêtre de même durée qui précède — vide pour « tout ». */
export function fenetrePrecedente(sessions: Session[], fenetre: Fenetre, now: Date) {
  if (fenetre === 'tout') return []
  const fin = now.getTime() + 1 - JOURS[fenetre] * MS_PAR_JOUR
  return entre(sessions, fin - JOURS[fenetre] * MS_PAR_JOUR, fin)
}

function moyenne(valeurs: number[]) {
  if (valeurs.length === 0) return null
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length
}

/** Efficience de chaque séance qui en a une, dans l'ordre reçu. */
export function efficiences(sessions: Session[]) {
  return sessions.map(efficiency).filter((e): e is number => e !== null)
}

export function efficienceMoyenne(sessions: Session[]) {
  return moyenne(efficiences(sessions))
}

export function puissanceMoyenne(sessions: Session[]) {
  return moyenne(sessions.map((s) => s.avgPowerW).filter((p): p is number => p !== undefined))
}

/** Temps total sur le vélo, en secondes. */
export function volumeS(sessions: Session[]) {
  return sessions.reduce((total, s) => total + s.durationS, 0)
}

export type Tendance = { sens: 'hausse' | 'baisse' | 'stable'; variation: number }

/**
 * Variation relative entre deux valeurs. `null` dès qu'un des deux termes
 * manque : sans référence, il n'y a pas de tendance à montrer.
 */
export function tendance(actuel: number | null, precedent: number | null): Tendance | null {
  if (actuel === null || precedent === null || precedent === 0) return null
  const variation = (actuel - precedent) / precedent
  if (Math.abs(variation) < SEUIL_TENDANCE) return { sens: 'stable', variation }
  return { sens: variation > 0 ? 'hausse' : 'baisse', variation }
}

/** Lundi 00:00 local de la semaine qui contient `d`. */
function lundi(d: Date) {
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7))
  return l
}

/**
 * Volume (secondes) des `n` dernières semaines calendaires, lundi à dimanche,
 * de la plus ancienne à la semaine en cours.
 */
export function volumeParSemaine(sessions: Session[], now: Date, n: number) {
  const debutSemaine = lundi(now)
  return Array.from({ length: n }, (_, i) => {
    const debut = new Date(debutSemaine)
    debut.setDate(debut.getDate() - 7 * (n - 1 - i))
    const fin = new Date(debut)
    fin.setDate(fin.getDate() + 7)
    return volumeS(entre(sessions, debut.getTime(), fin.getTime()))
  })
}
