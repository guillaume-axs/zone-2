import { expect, ouvrir, test } from './banc.ts'
import { plein, uneSeance, zoneDefinie } from './donnees.ts'

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
// Seul Space Grotesk, variable, porte ces graisses : le mono reste en 400.
test('les graisses du barème viennent de leurs fichiers', async ({ page }) => {
  await ouvrir(page, '/seance/nouvelle')
  const chargees = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`)
  })
  expect(chargees).toEqual(expect.arrayContaining(['IBM Plex Mono 400', 'Space Grotesk 300 700']))
})

// Le message d'erreur passe dans la marge réservée sous le champ : à 11 px, il
// venait buter contre le trait de la saisie. Le PO la veut bien décollée (2026-10-15).
test('l’erreur d’un champ garde son écart avec le trait du champ', async ({ page }) => {
  await ouvrir(page, '/seance/nouvelle')
  const champ = page.locator('.field', { hasText: 'Puissance moy.' })
  await champ.locator('.field__num').fill('9999')
  await champ.locator('.field__num').press('Tab')
  const [trait, erreur] = await Promise.all([
    champ.locator('.field__num').evaluate((e) => e.getBoundingClientRect().bottom),
    champ.locator('.field__err').evaluate((e) => e.getBoundingClientRect().top),
  ])
  expect(erreur - trait).toBeGreaterThanOrEqual(12)
})

// Barème allégé (2026-10-15) : le PO trouvait les capitales mono « bourrines ».
// Tous les rôles en capitales mono restent en 400, espacés de 0,12 em, sur chaque écran.
test('les capitales mono sont en 400, peu espacées, partout', async ({ page }) => {
  const forme = (sel: string) =>
    page.locator(sel).first().evaluate((e) => {
      const s = getComputedStyle(e)
      return `${s.fontWeight} ${(parseFloat(s.letterSpacing) / parseFloat(s.fontSize)).toFixed(2)}`
    })
  await ouvrir(page, '/', { sessions: plein, zones: zoneDefinie })
  for (const sel of ['.t-intitule', '.t-titre', '.t-commande']) expect(await forme(sel), sel).toBe('400 0.12')
})

// Une date de liste a le même rôle partout, et ne se confond plus avec la valeur.
test('une date de liste : même rôle sur l’Historique et l’Efficience, autre couleur que la valeur', async ({ page }) => {
  const style = (sel: string) =>
    page.locator(sel).first().evaluate((e) => {
      const s = getComputedStyle(e)
      return { police: `${s.fontFamily} ${s.fontSize} ${s.fontWeight}`, couleur: s.color }
    })
  await ouvrir(page, '/historique', { sessions: plein, zones: zoneDefinie })
  const date = await style('.hist__item > :first-child')
  const valeur = await style('.hist__value')
  expect(date.couleur).not.toBe(valeur.couleur)
  await ouvrir(page, '/efficience', { sessions: plein, zones: zoneDefinie })
  expect(await style('.recent .date, .row .date')).toEqual(date)
})

// L'app attend ses polices avant de s'afficher (main.tsx) : un fichier qui ne
// répond jamais ne doit pas la laisser sur un écran vide.
test('une police qui ne répond pas ne bloque pas l’affichage', async ({ page }) => {
  await page.route('**/IBMPlexMono-400.woff2', () => {})
  // Pas d'attente du chargement complet : la police en suspens ne finit jamais.
  await page.goto('/', { waitUntil: 'commit' })
  await expect(page.getByText('Efficience', { exact: true })).toBeVisible({ timeout: 15000 })
})
