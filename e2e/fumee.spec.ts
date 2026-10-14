import { expect, ouvrir, test } from './banc.ts'
import { plein, uneSeance, zoneDefinie } from './donnees.ts'

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

// Le banc tait les sauts pendant qu'une police charge ; le champ de la durée en
// faisait un visible (− , + et « MINUTES » poussés de 13 px). Sa hauteur ne doit
// pas dépendre d'Instrument Serif.
test('la saisie s’ouvre sans saut, que la police du chiffre soit là ou non', async ({ page }) => {
  const hauteur = () => page.locator('.stepper__value').evaluate((e) => e.getBoundingClientRect().height)
  await ouvrir(page, '/seance/nouvelle')
  const chargee = await hauteur()
  await page.route('**/InstrumentSerif*', (r) => r.abort())
  await page.reload()
  await page.locator('.stepper__value').waitFor()
  expect(await hauteur()).toBe(chargee)
})

// Sans son fichier, une graisse 500 ou 600 serait simulée par le navigateur :
// un faux gras qui épaissit le dessin au lieu d'employer celui de la police.
test('les graisses du barème viennent de leurs fichiers', async ({ page }) => {
  await ouvrir(page, '/seance/nouvelle')
  const chargees = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`)
  })
  expect(chargees).toEqual(expect.arrayContaining(['IBM Plex Mono 500', 'Space Grotesk 300 700']))
})

// Le message d'erreur passe dans la marge réservée sous le champ : à 11 px, il
// venait buter contre le trait de la saisie.
test('l’erreur d’un champ garde son écart avec le trait du champ', async ({ page }) => {
  await ouvrir(page, '/seance/nouvelle')
  const champ = page.locator('.field', { hasText: 'Puissance moy.' })
  await champ.locator('.field__num').fill('9999')
  await champ.locator('.field__num').press('Tab')
  const [trait, erreur] = await Promise.all([
    champ.locator('.field__num').evaluate((e) => e.getBoundingClientRect().bottom),
    champ.locator('.field__err').evaluate((e) => e.getBoundingClientRect().top),
  ])
  expect(erreur - trait).toBeGreaterThanOrEqual(6)
})
