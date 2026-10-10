import type { Page } from '@playwright/test'
import type { Session, ZoneConfig } from '../src/db/schema.ts'

/**
 * Les jeux de données du banc. Aucun n'est tiré de séances réelles : le dépôt
 * est public (sujet 8). Les dates partent d'aujourd'hui, sinon le jeu « plein »
 * sortirait des fenêtres de l'Accueil avec le temps.
 */

const JOUR = 86_400_000

function seance(ilYaJours: number, n: number): Session {
  const debut = new Date(Date.now() - ilYaJours * JOUR).toISOString()
  return {
    id: `seance-${n}`,
    startedAt: debut,
    durationS: 3600,
    avgPowerW: 140 + (n % 7) * 3,
    avgHrBpm: 128 + (n % 5),
    source: 'manual',
    createdAt: debut,
    updatedAt: debut,
  }
}

export const uneSeance: Session[] = [seance(1, 1)]

/** Trois séances par semaine sur douze semaines. */
export const plein: Session[] = Array.from({ length: 36 }, (_, n) => seance(1 + Math.floor(n * 2.3), n))

export const zoneDefinie: ZoneConfig[] = [
  { id: 'zone-1', validFrom: new Date(Date.now() - 90 * JOUR).toISOString(), z2MinBpm: 120, z2MaxBpm: 135 },
]

/**
 * Met l'app dans un état. Une première visite laisse Dexie créer la base à sa
 * version courante ; on y écrit ensuite en IndexedDB brut, puis on recharge.
 * Aucune ligne de test n'entre ainsi dans le bundle de production.
 * Sans argument, la base reste vide (et la zone non définie).
 */
export async function ouvrir(
  page: Page,
  chemin = '/',
  { sessions = [], zones = [] }: { sessions?: Session[]; zones?: ZoneConfig[] } = {},
) {
  await page.goto(chemin)
  if (!sessions.length && !zones.length) return
  await page.evaluate(
    ({ sessions, zones }) =>
      new Promise<void>((ok, ko) => {
        const req = indexedDB.open('zone2')
        req.onerror = () => ko(req.error)
        req.onsuccess = () => {
          const tx = req.result.transaction(['sessions', 'zoneConfigs'], 'readwrite')
          for (const s of sessions) tx.objectStore('sessions').put(s)
          for (const z of zones) tx.objectStore('zoneConfigs').put(z)
          tx.oncomplete = () => {
            req.result.close()
            ok()
          }
          tx.onerror = () => ko(tx.error)
        }
      }),
    { sessions, zones },
  )
  await page.reload()
}
