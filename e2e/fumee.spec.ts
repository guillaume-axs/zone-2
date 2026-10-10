import { expect, test } from '@playwright/test'

test("l'Accueil s'ouvre", async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Réglages' })).toBeVisible()
})
