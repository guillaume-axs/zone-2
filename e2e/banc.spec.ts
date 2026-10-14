import type { Page } from '@playwright/test'
import { controler, expect, geste, premierAffichage, test } from './banc.ts'

/**
 * Le banc se teste lui-même : chaque défaut est posé exprès sur une page nue,
 * et le contrôle qui le vise doit échouer. Un contrôle qui ne sait plus
 * échouer ne protège plus rien.
 */

// La balise viewport de l'app : sans elle, Chromium mobile met la page à 980 px.
// Le corps porte un rôle, comme dans l'app : chaque test vise un seul défaut.
const nue = (page: Page, html: string, role = 't-valeur') =>
  page.setContent(
    `<meta name="viewport" content="width=device-width, initial-scale=1"><body class="${role}">${html}</body>`,
  )

const BOUTON = 'style="display:block;width:200px;height:56px;margin:16px"'

test('une page saine passe', async ({ page }) => {
  await nue(page, `<button ${BOUTON}>Un</button><button ${BOUTON}>Deux</button>`)
  await controler(page, 'page saine')
})

test('un texte sans rôle est signalé', async ({ page }) => {
  await nue(page, `<p>Enregistre ta première séance</p><input value="12">`, '')
  await expect(controler(page, 'sans rôle')).rejects.toThrow(/texte sans rôle : Enregistre ta première séance/)
  await expect(controler(page, 'sans rôle')).rejects.toThrow(/texte sans rôle : <input/)
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

test('un débordement, un texte coupé, une valeur cassée sont signalés', async ({ page }) => {
  await nue(page, `
    <p style="width:120px;overflow:hidden;white-space:nowrap">Un libellé beaucoup trop long</p>
    <p style="width:40px">188 bpm</p>
    <div style="width:600px;height:10px">large</div>`)
  await expect(controler(page, 'débordement')).rejects.toThrow(/défile en largeur[\s\S]*texte coupé[\s\S]*valeur cassée sur 2 lignes : 188 bpm/)
})

test('un saut au chargement est signalé', async ({ page }) => {
  // Le cas de `useLiveQuery` : les données arrivent après le premier dessin.
  await page.goto('data:text/html,<meta name="viewport" content="width=device-width"><div id="d"></div><p>Volume</p>'
    + '<script>setTimeout(() => d.style.height = "80px", 300)</script>')
  await page.waitForTimeout(500)
  await expect(premierAffichage(page, 'chargement')).rejects.toThrow(/Volume/)
})

// Le gabarit des onglets réduit à ses ancres : la barre, le « + », un toast.
// `#aller` change d'écran (l'adresse) et retire le « + », comme Réglages.
const gabarit = (bas: number, aller: string) => `
  <nav class="nav" style="position:fixed;bottom:0;left:0;right:0;height:62px"></nav>
  <button class="fab" style="position:fixed;bottom:78px;right:16px;width:56px;height:56px">+</button>
  <div class="toasts" style="position:fixed;left:8px;right:8px;bottom:${bas}px">
    <div class="toast" style="height:56px">Séance enregistrée</div>
  </div>
  <button ${BOUTON} onclick="${aller}">Aller</button>`

test('au changement d’écran, le toast rejoint l’ancre du nouvel écran', async ({ page }) => {
  await nue(page, gabarit(146, "location.hash='reglages';document.querySelector('.fab').remove();document.querySelector('.toasts').style.bottom='78px'"))
  await geste(page, 'onglet', page.getByText('Aller'))
})

test('un toast qui bouge sans changement d’écran est un saut', async ({ page }) => {
  await nue(page, gabarit(146, "document.querySelector('.fab').remove();document.querySelector('.toasts').style.bottom='78px'"))
  await expect(geste(page, 'appui', page.getByText('Aller'))).rejects.toThrow(/Séance enregistrée/)
})

test('un toast sur le contenu est permis', async ({ page }) => {
  await nue(page, gabarit(146, '').replace(
    `<button ${BOUTON} onclick="">Aller</button>`,
    `<button style="position:fixed;left:16px;bottom:150px;width:120px;height:48px">Pourquoi ?</button>`,
  ))
  await controler(page, 'toast sur le contenu')
})

test('un toast loin de son ancre, ou posé dessus, est signalé', async ({ page }) => {
  await nue(page, gabarit(200, ''))
  await expect(controler(page, 'loin')).rejects.toThrow(/toast hors de sa place : Séance enregistrée \(66 px au-dessus de \+\)/)
  await nue(page, gabarit(100, ''))
  await expect(controler(page, 'dessus')).rejects.toThrow(/toast hors de sa place/)
})
