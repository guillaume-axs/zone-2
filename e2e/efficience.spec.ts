import type { Page } from '@playwright/test'
import { expect, geste, ouvrir, test } from './banc.ts'
import { plein } from './donnees.ts'

/**
 * Le détail Efficience, derrière le héros de l'Accueil. Le banc contrôle chaque
 * étape : la flèche retour y a été trouvée trop petite (44 px) le 2026-10-11,
 * aucun parcours n'ouvrant encore cet écran.
 */

const fenetre = (page: Page, nom: string) => page.locator('.seg', { hasText: nom })

/** Le héros : Instrument Serif chargée, 80 px, sur une seule ligne (barème typographique). */
async function heros(page: Page) {
  const valeur = page.locator('.value').first()
  await expect(valeur).toHaveCSS('font-size', '80px')
  await expect(valeur).toHaveCSS('font-family', /^"Instrument Serif"/)
  expect(await page.evaluate(() => document.fonts.check('80px "Instrument Serif"'))).toBe(true)
  expect((await valeur.boundingBox())!.height).toBeLessThan(80)
}

test('efficience : s’ouvre depuis le héros, la flèche ramène sur la même fenêtre', async ({ page }) => {
  await ouvrir(page, '/', { sessions: plein })
  await heros(page)
  // Sans fenêtre précédente, la tendance se tait mais garde sa place : rien ne saute.
  await geste(page, 'fenêtre 3 mois', fenetre(page, '3 mois'))
  await expect(page.locator('a.hero .trend')).toHaveText('')
  await geste(page, 'fenêtre Tout', fenetre(page, 'Tout'))
  await geste(page, 'fenêtre 3 mois', fenetre(page, '3 mois'))
  await geste(page, 'appui sur le héros', page.locator('a.hero'))
  await expect(page).toHaveURL(/\/efficience\?f=3m/)
  await expect(page.locator('.chart')).toBeVisible()
  await heros(page)
  await geste(page, 'détail : fenêtre 4 semaines', fenetre(page, '4 semaines'))
  await geste(page, 'détail : fenêtre 3 mois', fenetre(page, '3 mois'))

  await geste(page, 'appui sur la flèche', page.getByRole('link', { name: 'Retour à l’accueil' }))
  await expect(page).toHaveURL(/\/\?f=3m/)
  await expect(page.locator('.seg', { hasText: '3 mois' })).toHaveAttribute('data-selected', 'true')
})

test('efficience : sans séance, l’écran dit qu’il n’a rien à montrer', async ({ page }) => {
  await ouvrir(page, '/efficience')
  await expect(page.locator('.detail__vide')).toBeVisible()
})
