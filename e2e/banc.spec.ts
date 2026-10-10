import type { Page } from '@playwright/test'
import { controler, expect, geste, premierAffichage, test } from './banc.ts'

/**
 * Le banc se teste lui-même : chaque défaut est posé exprès sur une page nue,
 * et le contrôle qui le vise doit échouer. Un contrôle qui ne sait plus
 * échouer ne protège plus rien.
 */

// La balise viewport de l'app : sans elle, Chromium mobile met la page à 980 px.
const nue = (page: Page, html: string) =>
  page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1">${html}`)

const BOUTON = 'style="display:block;width:200px;height:56px;margin:16px"'

test('une page saine passe', async ({ page }) => {
  await nue(page, `<button ${BOUTON}>Un</button><button ${BOUTON}>Deux</button>`)
  await controler(page, 'page saine')
})

test('un élément qui saute est nommé', async ({ page }) => {
  await nue(page, `
    <div id="haut"></div>
    <button ${BOUTON} onclick="haut.innerHTML='<p>Erreur</p>'">Valider</button>
    <button ${BOUTON}>Annuler</button>`)
  await expect(geste(page, 'valider', page.getByText('Valider'))).rejects.toThrow(/Annuler/)
})

test('un saut déclaré est permis', async ({ page }) => {
  await nue(page, `
    <div id="haut"></div>
    <section><button ${BOUTON} onclick="haut.innerHTML='<p>Erreur</p>'">Valider</button></section>`)
  await geste(page, 'valider', page.getByText('Valider'), undefined, { bouge: ['section'] })
})

test('un bouton recouvert est signalé', async ({ page }) => {
  await nue(page, `
    <button ${BOUTON}>Enregistrer</button>
    <div style="position:fixed;top:0;left:0;width:100%;height:120px;background:red">Toast</div>`)
  await expect(controler(page, 'recouvert')).rejects.toThrow(/recouvert : Enregistrer sous Toast/)
})

test('une cible trop petite est signalée', async ({ page }) => {
  await nue(page, `<button style="width:40px;height:40px">x</button>`)
  await expect(controler(page, 'petite')).rejects.toThrow(/cible trop petite : x \(40×40/)
})

test('deux cibles trop proches sont signalées', async ({ page }) => {
  await nue(page, `
    <button style="display:block;width:56px;height:56px">A</button>
    <button style="display:block;width:56px;height:56px;margin-top:4px">B</button>`)
  await expect(controler(page, 'proches')).rejects.toThrow(/cibles trop proches : A \/ B/)
})

test('un débordement et un texte coupé sont signalés', async ({ page }) => {
  await nue(page, `
    <p style="width:120px;overflow:hidden;white-space:nowrap">Un libellé beaucoup trop long</p>
    <div style="width:600px;height:10px">large</div>`)
  await expect(controler(page, 'débordement')).rejects.toThrow(/défile en largeur[\s\S]*texte coupé/)
})

test('un saut au chargement est signalé', async ({ page }) => {
  // Le cas de `useLiveQuery` : les données arrivent après le premier dessin.
  await page.goto('data:text/html,<meta name="viewport" content="width=device-width"><div id="d"></div><p>Volume</p>'
    + '<script>setTimeout(() => d.style.height = "80px", 300)</script>')
  await page.waitForTimeout(500)
  await expect(premierAffichage(page, 'chargement')).rejects.toThrow(/Volume/)
})
