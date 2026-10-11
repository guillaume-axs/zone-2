import { expect, geste, ouvrir, test } from './banc.ts'
import { plein } from './donnees.ts'

/**
 * Le détail Efficience, derrière le héros de l'Accueil. Le banc contrôle chaque
 * étape : la flèche retour y a été trouvée trop petite (44 px) le 2026-10-11,
 * aucun parcours n'ouvrant encore cet écran.
 */

test('efficience : s’ouvre depuis le héros, la flèche ramène sur la même fenêtre', async ({ page }) => {
  await ouvrir(page, '/?f=3m', { sessions: plein })
  await geste(page, 'appui sur le héros', page.locator('a.hero'))
  await expect(page).toHaveURL(/\/efficience\?f=3m/)
  await expect(page.locator('.chart')).toBeVisible()

  await geste(page, 'appui sur la flèche', page.getByRole('link', { name: 'Retour à l’accueil' }))
  await expect(page).toHaveURL(/\/\?f=3m/)
  await expect(page.locator('.seg', { hasText: '3 mois' })).toHaveAttribute('data-selected', 'true')
})

test('efficience : sans séance, l’écran dit qu’il n’a rien à montrer', async ({ page }) => {
  await ouvrir(page, '/efficience')
  await expect(page.locator('.detail__vide')).toBeVisible()
})
