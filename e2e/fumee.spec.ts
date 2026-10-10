import { expect, test } from '@playwright/test'
import { ouvrir, plein, uneSeance, zoneDefinie } from './donnees.ts'

test("l'Accueil s'ouvre vide", async ({ page }) => {
  await ouvrir(page)
  await expect(page.getByRole('link', { name: 'Réglages' })).toBeVisible()
})

test("l'Historique montre les séances semées", async ({ page }) => {
  await ouvrir(page, '/historique', { sessions: uneSeance })
  await expect(page.locator('.hist__item')).toHaveCount(1)
  await ouvrir(page, '/historique', { sessions: plein, zones: zoneDefinie })
  await expect(page.locator('.hist__item')).toHaveCount(36)
})
