import type { Page } from '@playwright/test'
import { expect, ouvrir, test } from './banc.ts'
import { uneSeance } from './donnees.ts'

// Grille du sujet 17 : un écran vide ne ment pas pendant le chargement, dit ce
// qui viendra, montre comment le remplir, et garde son cadre.

declare global {
  interface Window {
    __videVu: boolean
  }
}

const VIDE ="Aucune séance pour l'instant."
const INVITATION = 'Enregistre ta première séance'

async function cadre(page: Page, titre: string) {
  await expect(page.locator('.tete').getByText(titre, { exact: true })).toBeVisible()
  for (const onglet of ['Accueil', 'Historique', 'Réglages']) {
    await expect(page.getByRole('link', { name: onglet })).toBeVisible()
  }
}

async function versLaSaisie(page: Page) {
  await expect(page.getByText(INVITATION)).toBeVisible()
  await page.getByRole('link', { name: 'Nouvelle séance' }).click()
  await expect(page).toHaveURL(/\/seance\/nouvelle$/)
}

test("l'Historique vide dit qu'il n'a rien, et comment le remplir", async ({ page }) => {
  await ouvrir(page, '/historique')
  await cadre(page, 'Historique')
  await expect(page.getByText(VIDE)).toBeVisible()
  // Le filigrane est au centre du vide : centré en largeur, à mi-hauteur entre
  // le titre et l'invitation, à quelques pixels près.
  const boite = (texte: string) =>
    page.locator('main').getByText(texte, { exact: true }).evaluate((e) => {
      const r = document.createRange()
      r.selectNodeContents(e)
      const b = r.getBoundingClientRect()
      return { haut: b.top, bas: b.bottom, milieuX: b.left + b.width / 2 }
    })
  const [titre, vide, invitation] = await Promise.all([boite('Historique'), boite(VIDE), boite(INVITATION)])
  expect(Math.abs(vide.milieuX - 180)).toBeLessThan(4)
  const milieu = (titre.bas + invitation.haut) / 2
  expect(Math.abs((vide.haut + vide.bas) / 2 - milieu)).toBeLessThan(40)
  await versLaSaisie(page)
})

test("l'Accueil vide montre ce qui viendra, et comment le remplir", async ({ page }) => {
  await ouvrir(page)
  await cadre(page, 'Accueil')
  await expect(page.getByText('Efficience', { exact: true })).toBeVisible()
  await expect(page.getByText('watts produits par battement de cœur')).toBeVisible()
  await expect(page.locator('.row .val')).toHaveText(['—', '—', '—'])
  await versLaSaisie(page)
})

// Le message vide ne doit jamais clignoter avant les données : on note tout
// texte de vide qui entre dans la page, du premier octet à l'écran posé.
for (const chemin of ['/', '/historique']) {
  test(`base remplie, ${chemin} ne s'affiche jamais vide, même en chargeant`, async ({ page }) => {
    await page.addInitScript(
      ([vide, invitation]) => {
        window.__videVu = false
        new MutationObserver(() => {
          const texte = document.body?.textContent ?? ''
          if (texte.includes(vide) || texte.includes(invitation)) window.__videVu = true
        }).observe(document, { childList: true, subtree: true, characterData: true })
      },
      [VIDE, INVITATION],
    )
    await ouvrir(page, chemin, { sessions: uneSeance })
    expect(await page.evaluate(() => window.__videVu)).toBe(false)
  })
}

test('la saisie s’ouvre sur 45 minutes, le reste vide, Enregistrer à portée', async ({ page }) => {
  await ouvrir(page, '/seance/nouvelle')
  await expect(page.getByLabel('Durée en minutes')).toHaveValue('45')
  for (const champ of ['Puissance moyenne en watts', 'Fréquence cardiaque moyenne']) {
    await expect(page.getByLabel(champ)).toHaveValue('')
    await expect(page.getByLabel(champ)).toHaveAttribute('placeholder', '—')
  }
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeInViewport({ ratio: 1 })
})
