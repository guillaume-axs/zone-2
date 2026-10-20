import { controler, expect, geste, ouvrir, test } from './banc.ts'
import { uneSeance } from './donnees.ts'
import { fauxSauvegarde } from './sauvegarde.ts'
import { fauxSeance, type Journal } from './seance.ts'

/**
 * Le rangement au lancement (J1) : ce que le service natif a laissé sur le
 * téléphone, l'app le range dans Dexie — le vrai magasin, pas un double — puis
 * efface le fichier. Chaque parcours : ouvrir, armer, un seul rechargement,
 * puis constats sur ce lancement-là.
 */

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'

/** Un journal de `min` minutes, commencé il y a deux heures, avec deux trames. */
const journal = (id: string, min: number): Journal => {
  const debut = Date.now() - 2 * 3_600_000
  return {
    id,
    contenu: [
      `D,${debut},${id},120,135`,
      `B,${debut + 1000},130,1,800`,
      `B,${debut + 2000},132,1,790;805`,
      `S,${debut + min * 60_000}`,
      '',
    ].join('\n'),
  }
}

const toast = (page: import('@playwright/test').Page) => page.locator('.toast')

/** Ce que la base Dexie contient, lu en IndexedDB brut. */
const lire = (page: import('@playwright/test').Page, magasin: 'sessions' | 'trames') =>
  page.evaluate(
    (m) =>
      new Promise<{ id: string; [k: string]: unknown }[]>((ok, ko) => {
        const req = indexedDB.open('zone2')
        req.onerror = () => ko(req.error)
        req.onsuccess = () => {
          const r = req.result.transaction(m).objectStore(m).getAll()
          r.onsuccess = () => {
            req.result.close()
            ok(r.result)
          }
          r.onerror = () => ko(r.error)
        }
      }),
    magasin,
  )

/** Le toast, s'il venait, suivrait de quelques ms la dernière écriture : on lui laisse ce temps. */
async function aucunToast(page: import('@playwright/test').Page) {
  await page.waitForTimeout(500)
  await expect(toast(page)).toHaveCount(0)
}

const noms = (appels: { methode: string }[]) => appels.map((a) => a.methode)

test('séance tuée : rangée au lancement, toast, journal effacé après', async ({ page }) => {
  const seance = await fauxSeance(page)
  await ouvrir(page, '/historique')
  await seance.armer(journal(U1, 45))

  await expect(toast(page)).toContainText('Séance de 45 min retrouvée')
  await expect(page.getByText('45 min · 131 bpm')).toBeVisible()
  const appels = await seance.appels()
  expect(noms(appels)).toEqual(['seanceActive', 'journaux', 'effacer'])
  expect(appels[2].args).toEqual({ id: U1 })
  expect(await seance.restants()).toEqual([])
  expect(await lire(page, 'trames')).toEqual([
    {
      id: U1,
      trames: [
        { t_ms: 1000, bpm: 130, rr: [800] },
        { t_ms: 2000, bpm: 132, rr: [790, 805] },
      ],
    },
  ])
  await controler(page, 'séance retrouvée au lancement')
})

test('déjà rangée : rien n’est réécrit', async ({ page }) => {
  const seance = await fauxSeance(page)
  await ouvrir(page, '/historique', { sessions: [{ ...uneSeance[0], id: U1, avgPowerW: 140 }] })
  await seance.armer(journal(U1, 45))

  await expect.poll(async () => noms(await seance.appels())).toContain('effacer')
  expect(await seance.restants()).toEqual([])
  const sessions = await lire(page, 'sessions')
  expect(sessions).toHaveLength(1)
  expect(sessions[0]).toMatchObject({ id: U1, avgPowerW: 140, source: 'manual' })
  expect(await lire(page, 'trames')).toEqual([])
  await aucunToast(page)
})

test('séance active : rien n’est rangé', async ({ page }) => {
  const seance = await fauxSeance(page, { active: U1 })
  await ouvrir(page, '/historique')
  await seance.armer(journal(U1, 45))

  await expect.poll(async () => noms(await seance.appels())).toContain('seanceActive')
  expect(noms(await seance.appels())).toEqual(['seanceActive'])
  expect(await seance.restants()).toEqual([U1])
  expect(await lire(page, 'sessions')).toEqual([])
  await aucunToast(page)
})

test('journal illisible : gardé, un message', async ({ page }) => {
  const seance = await fauxSeance(page)
  await ouvrir(page, '/historique')
  await seance.armer({ id: U1, contenu: 'D,1,u\nn’importe quoi\nS,2\n' })

  await expect(toast(page)).toHaveText(/Une séance n'a pas pu être rangée/)
  expect(noms(await seance.appels())).toEqual(['seanceActive', 'journaux'])
  expect(await seance.restants()).toEqual([U1])
  expect(await lire(page, 'sessions')).toEqual([])
})

test('journal vide : effacé sans un mot', async ({ page }) => {
  const seance = await fauxSeance(page)
  await ouvrir(page, '/historique')
  await seance.armer({ id: U1, contenu: '' })

  await expect.poll(async () => await seance.restants()).toEqual([])
  expect(await lire(page, 'sessions')).toEqual([])
  await aucunToast(page)
})

test('deux orphelins : les deux rangés, un toast', async ({ page }) => {
  const seance = await fauxSeance(page)
  await ouvrir(page, '/historique')
  await seance.armer(journal(U1, 30), journal(U2, 60))

  await expect.poll(async () => (await lire(page, 'sessions')).length).toBe(2)
  await expect.poll(async () => await seance.restants()).toEqual([])
  expect((await lire(page, 'trames')).map((t) => t.id).sort()).toEqual([U1, U2])
  await expect(toast(page)).toHaveCount(1)
  await expect(toast(page)).toContainText(/Séance de \d+ min retrouvée/)
})

test('un illisible parmi deux : l’autre est rangée, un seul message', async ({ page }) => {
  const seance = await fauxSeance(page)
  await ouvrir(page, '/historique')
  await seance.armer({ id: U1, contenu: 'rien de lisible\n' }, journal(U2, 30))

  await expect(toast(page)).toHaveCount(1)
  await expect(toast(page)).toHaveText(/Une séance n'a pas pu être rangée/)
  expect((await lire(page, 'sessions')).map((s) => s.id)).toEqual([U2])
  expect(await seance.restants()).toEqual([U1])
})

test('import v2 : une séance déjà là reçoit ses trames', async ({ page }) => {
  const sauvegarde = await fauxSauvegarde(page)
  await ouvrir(page, '/reglages', { sessions: [{ ...uneSeance[0], id: U1 }] })
  expect(await lire(page, 'trames')).toEqual([])
  const trames = [{ t_ms: 1000, bpm: 130, rr: [800] }]
  await sauvegarde.choisir(
    JSON.stringify({
      app: 'zone2',
      version: 2,
      exportedAt: new Date().toISOString(),
      sessions: [{ ...uneSeance[0], id: U1 }],
      trames: [{ id: U1, trames }],
    }),
  )

  await geste(page, 'appui sur Importer', page.getByRole('button', { name: /Importer une sauvegarde/ }))
  await expect(toast(page)).toContainText('Aucune nouvelle séance')
  expect(await lire(page, 'trames')).toEqual([{ id: U1, trames }])
  expect(await lire(page, 'sessions')).toHaveLength(1)
})
