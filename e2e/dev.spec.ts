import type { Page } from '@playwright/test'
import { expect, geste, ouvrir, test } from './banc.ts'
import { plein, zoneDefinie } from './donnees.ts'

/**
 * Le groupe « Dev » des Réglages (sujet 9, révisé le 2026-10-11) : charger le
 * jeu de test, vider la base. Le banc tourne sur l'app dev — le serveur de dev
 * en local, le build `--mode dev` en CI. Son absence de la prod, elle, est
 * vérifiée sur le paquet même, au build de l'APK.
 */

const charger = (page: Page) => page.getByRole('button', { name: /Charger le jeu de test/ })
const vider = (page: Page) => page.getByRole('button', { name: /Vider la base/ })
const ligneExport = (page: Page) => page.getByRole('button', { name: /Exporter mes séances/ })

test('dev : charger le jeu de test remplit l’Accueil et l’Historique, deux fois n’ajoute rien', async ({ page }) => {
  await ouvrir(page, '/reglages')
  await expect(ligneExport(page)).toContainText('Aucune séance')

  await geste(page, 'appui sur Charger', charger(page))
  await expect(ligneExport(page)).toContainText('36 séances')
  await expect(page.locator('.toast')).toHaveCount(0)
  await geste(page, 'second appui sur Charger', charger(page))
  await expect(ligneExport(page)).toContainText('36 séances')

  await geste(page, 'onglet Accueil', page.getByRole('link', { name: 'Accueil' }))
  await expect(page.locator('a.hero')).toBeVisible()
  await expect(page.locator('.ghost')).toHaveCount(0)
  await expect(page.locator('a.hero .trend')).toHaveClass(/better/)
  await geste(page, 'onglet Historique', page.getByRole('link', { name: 'Historique' }))
  await expect(page.locator('.hist__item')).toHaveCount(36)
})

test('dev : vider la base efface les séances et la zone', async ({ page }) => {
  await ouvrir(page, '/reglages', { sessions: plein, zones: zoneDefinie })
  await expect(ligneExport(page)).toContainText('36 séances')

  await geste(page, 'appui sur Vider', vider(page))
  await expect(ligneExport(page)).toContainText('Aucune séance')
  await expect(page.getByRole('link', { name: /Zone 2/ })).toContainText('Non définie')

  await geste(page, 'onglet Historique', page.getByRole('link', { name: 'Historique' }))
  await expect(page.locator('.hist__item')).toHaveCount(0)
})
