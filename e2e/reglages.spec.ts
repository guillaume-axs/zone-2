import { fauxCapteur } from './capteur.ts'
import { expect, geste, ouvrir, test } from './banc.ts'
import { zoneDefinie } from './donnees.ts'

/**
 * Écran Réglages (sujets 14 et 16). États couverts :
 * - Zone 2 : non définie, définie ;
 * - Capteur cardio : rien, recherche (sans puis avec nom), connecté (nom et
 *   FC), décroché, aucun capteur, annulé, déconnecté ; nom d'appareil long.
 */

const ligneCapteur = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Capteur cardio/ })

test('capteur : connecter, recevoir la FC, décrocher', async ({ page }) => {
  const capteur = await fauxCapteur(page)
  await ouvrir(page, '/reglages')
  const ligne = ligneCapteur(page)
  await expect(ligne).toContainText('Connecter')

  await geste(page, 'appui sur Connecter', ligne)
  expect(await capteur.appels()).toContain('connecter')
  await geste(page, 'le natif cherche', ligne, () => capteur.emettre('etat', { etat: 'RECHERCHE' }))
  await expect(ligne).toContainText('Recherche')
  await expect(ligne).toContainText('Annuler')

  await geste(page, 'ceinture trouvée', ligne, () => capteur.emettre('etat', { etat: 'CONNECTEE', nom: 'Polar H10 0A1B2C3D' }))
  await geste(page, 'premier battement', ligne, () => capteur.emettre('fc', { bpm: 128 }))
  await expect(ligne).toContainText('Polar H10 0A1B2C3D')
  await expect(ligne).toContainText('128 bpm')
  await expect(ligne).toContainText('Déconnecter')

  await geste(page, 'la FC change', ligne, () => capteur.emettre('fc', { bpm: 97 }))
  await expect(ligne).toContainText('97 bpm')

  await geste(page, 'la ceinture décroche', ligne, () => capteur.emettre('etat', { etat: 'DECROCHEE' }))
  await expect(ligne).toContainText('Connecter')
})

test('capteur : annuler la recherche, puis déconnecter', async ({ page }) => {
  const capteur = await fauxCapteur(page)
  await ouvrir(page, '/reglages')
  const ligne = ligneCapteur(page)

  await geste(page, 'appui sur Connecter', ligne)
  await geste(page, 'le natif cherche', ligne, () => capteur.emettre('etat', { etat: 'RECHERCHE' }))
  await geste(page, 'appui sur Annuler', ligne)
  await expect(ligne).toContainText('Connecter')
  expect(await capteur.appels()).toEqual(['connecter', 'annuler'])

  await geste(page, 'appui sur Connecter', ligne)
  await geste(page, 'ceinture connectée', ligne, async () => {
    await capteur.emettre('etat', { etat: 'CONNECTEE', nom: 'Polar H10 0A1B2C3D' })
    await capteur.emettre('fc', { bpm: 128 })
  })
  await geste(page, 'appui sur Déconnecter', ligne)
  await expect(ligne).toContainText('Connecter')
  expect((await capteur.appels()).at(-1)).toBe('deconnecter')
})

test('capteur : aucune ceinture trouvée, réessayer', async ({ page }) => {
  const capteur = await fauxCapteur(page)
  await ouvrir(page, '/reglages')
  const ligne = ligneCapteur(page)

  await geste(page, 'appui sur Connecter', ligne)
  await geste(page, 'rien trouvé', ligne, () => capteur.emettre('etat', { etat: 'INTROUVABLE' }))
  await expect(ligne).toContainText('Aucun capteur')
  await geste(page, 'appui sur Réessayer', ligne)
  expect(await capteur.appels()).toEqual(['connecter', 'connecter'])
})

test("capteur : un nom d'appareil long ne casse pas la ligne", async ({ page }) => {
  const capteur = await fauxCapteur(page)
  await ouvrir(page, '/reglages')
  const ligne = ligneCapteur(page)
  await geste(page, 'appui sur Connecter', ligne)
  await geste(page, 'connecté, nom long', ligne, async () => {
    await capteur.emettre('etat', { etat: 'CONNECTEE', nom: 'Polar Verity Sense 0A1B2C3D4E5F' })
    await capteur.emettre('fc', { bpm: 188 })
  })
})

test('capteur : la ligne se retrouve telle quelle après un tour des onglets', async ({ page }) => {
  const capteur = await fauxCapteur(page)
  await ouvrir(page, '/reglages')
  const ligne = ligneCapteur(page)
  await geste(page, 'appui sur Connecter', ligne)
  await geste(page, 'connecté', ligne, async () => {
    await capteur.emettre('etat', { etat: 'CONNECTEE', nom: 'Polar H10 0A1B2C3D' })
    await capteur.emettre('fc', { bpm: 128 })
  })
  await geste(page, "onglet Accueil", page.getByRole('link', { name: 'Accueil' }))
  await geste(page, 'onglet Réglages', page.getByRole('link', { name: 'Réglages' }))
  await expect(ligneCapteur(page)).toContainText('128 bpm')
})

test('zone : non définie puis définie', async ({ page }) => {
  await ouvrir(page, '/reglages')
  await expect(page.getByRole('link', { name: /Zone 2/ })).toContainText('Non définie')
  await ouvrir(page, '/reglages', { zones: zoneDefinie })
  await expect(page.getByRole('link', { name: /Zone 2/ })).toContainText('120 – 135 bpm')
})
