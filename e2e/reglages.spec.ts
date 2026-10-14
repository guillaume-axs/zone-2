import { fauxCapteur } from './capteur.ts'
import { expect, geste, ouvrir, test } from './banc.ts'
import { plein, zoneDefinie } from './donnees.ts'
import { fauxSauvegarde } from './sauvegarde.ts'

/**
 * Écran Réglages (sujets 14 et 16). États couverts :
 * - Zone 2 : non définie, définie ;
 * - Capteur cardio : rien, recherche (sans puis avec nom), connecté (nom et
 *   FC), décroché, aucun capteur, annulé, déconnecté ; nom d'appareil long ;
 * - Mes données (sujet 15) : base vide, base pleine, export, import, fusion,
 *   fenêtre fermée, échec d'écriture ou de lecture, fichier étranger ;
 *   séances importées visibles aussitôt sur l'Accueil et l'Historique.
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
    await capteur.emettre('etat', { etat: 'CONNECTEE', nom: 'Polar Verity Sense 0A1B2C3D4E5F 6A7B8C9D0E1F' })
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

test('zone : premier réglage par l’âge, une faute, sa correction, puis enregistrer', async ({ page }) => {
  await ouvrir(page, '/reglages')
  await geste(page, 'ouvrir Zone 2', page.getByRole('link', { name: /Zone 2/ }))
  await expect(page).toHaveURL(/reglages\/zone-2/)

  const age = page.getByLabel('Âge')
  const fin = page.getByLabel('Fin de zone en battements par minute')
  const debut = page.getByLabel('Début de zone en battements par minute')
  const enregistrer = page.getByRole('button', { name: 'Enregistrer' })
  await expect(enregistrer).toBeDisabled()

  await geste(page, 'appui sur Âge', age)
  await geste(page, 'saisie de l’âge', age, (l) => l.pressSequentially('45'))
  await expect(fin).not.toHaveValue('')
  await expect(debut).not.toHaveValue('')

  await geste(page, 'appui sur Fin de zone', fin)
  await geste(page, 'fin hors bornes', fin, (l) => l.pressSequentially('250'))
  // L'erreur paraît sous la fin au moment où le curseur arrive sur le début :
  // ni l'un ni l'autre ne doit bouger.
  await geste(page, 'Suivant', fin, (l) => l.press('Enter'))
  await expect(debut).toBeFocused()
  await geste(page, 'sortie du champ début', debut, (l) => l.blur())
  await expect(page.getByRole('alert')).toBeVisible()

  await geste(page, 'appui sur Fin de zone', fin)
  await geste(page, 'correction', fin, (l) => l.pressSequentially('140'))
  await expect(page.getByRole('alert')).toHaveCount(0)

  await geste(page, 'Enregistrer', enregistrer)
  await expect(page).toHaveURL(/\/reglages$/)
  await expect(page.getByRole('link', { name: /Zone 2/ })).toContainText('140 bpm')
  // La ligne montre la nouvelle plage : aucun toast ne la redit.
  await expect(page.locator('.toast')).toHaveCount(0)
})

test('zone : fermer sans enregistrer', async ({ page }) => {
  await ouvrir(page, '/reglages/zone-2', { zones: zoneDefinie })
  await expect(page.getByLabel('Fin de zone en battements par minute')).toHaveValue('135')
  await geste(page, 'saisie', page.getByLabel('Âge'), (l) => l.pressSequentially('30'))
  await geste(page, 'fermer', page.getByRole('link', { name: 'Fermer sans enregistrer' }))
  await expect(page.getByRole('link', { name: /Zone 2/ })).toContainText('120 – 135 bpm')
})

const ligneExport = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Exporter mes séances/ })
const ligneImport = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /Importer une sauvegarde/ })
const toast = (page: import('@playwright/test').Page) => page.locator('.toast')

const fichier = (sessions: unknown[]) =>
  JSON.stringify({ app: 'zone2', version: 1, exportedAt: new Date().toISOString(), sessions })

test('données : base vide, la ligne d’export est inactive', async ({ page }) => {
  await fauxSauvegarde(page)
  await ouvrir(page, '/reglages')
  await expect(page.getByText('Mes données')).toBeVisible()
  await expect(ligneExport(page)).toBeDisabled()
  await expect(ligneExport(page)).toContainText('Aucune séance')
  await expect(ligneExport(page).locator('svg')).toBeVisible()
  await expect(ligneImport(page)).toBeEnabled()
})

/** Toute la ligne inactive pâlit, et l'appui n'y change rien ; la ligne active, elle, répond. */
test('données : la ligne inactive est pâle en entier et ne répond pas à l’appui', async ({ page }) => {
  await ouvrir(page, '/reglages')
  const couleur = (l: import('@playwright/test').Locator, propriete: 'color' | 'stroke') =>
    l.evaluate((e, p) => getComputedStyle(e)[p], propriete)
  const fg4 = await page.evaluate(() => {
    const e = document.createElement('i')
    e.style.color = 'var(--fg-4)'
    document.body.append(e)
    const c = getComputedStyle(e).color
    e.remove()
    return c
  })
  const ligne = ligneExport(page)
  expect(await couleur(ligne.locator('.reglages__intitule'), 'color')).toBe(fg4)
  expect(await couleur(ligne.locator('.reglages__etat'), 'color')).toBe(fg4)
  expect(await couleur(ligne.locator('.reglages__icone'), 'stroke')).toBe(fg4)

  const opaciteSousLeDoigt = async (l: import('@playwright/test').Locator) => {
    const b = (await l.boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    const o = await l.evaluate((e) => getComputedStyle(e).opacity)
    await page.mouse.up()
    return o
  }
  expect(await opaciteSousLeDoigt(ligne)).toBe('1')
  expect(await opaciteSousLeDoigt(ligneImport(page))).toBe('0.72')
})

/**
 * Relève l'état de la ligne d'export et de la valeur Zone 2 à chaque rendu :
 * un état intermédiaire ne dure qu'une image, aucune attente ne le verrait.
 */
async function releverLesRendus(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __rendus: unknown[] }
    w.__rendus = []
    new MutationObserver(() => {
      const ligne = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Exporter mes séances'))
      if (!ligne) return
      w.__rendus.push({
        inactive: ligne.disabled,
        etat: ligne.querySelector('.reglages__etat')?.textContent,
        zone: document.querySelector('a[href="/reglages/zone-2"] .reglages__droite')?.textContent,
      })
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
  })
  return () => page.evaluate(() => (window as unknown as { __rendus: unknown[] }).__rendus)
}

test('données : au retour du formulaire, l’export sans séance n’est jamais rendu actif', async ({ page }) => {
  await ouvrir(page, '/reglages/zone-2', { zones: zoneDefinie })
  const rendus = await releverLesRendus(page)
  await geste(page, 'fermer', page.getByRole('link', { name: 'Fermer sans enregistrer' }))
  await expect(ligneExport(page)).toBeDisabled()
  const vus = await rendus()
  expect(vus.length).toBeGreaterThan(0)
  expect(vus).toEqual(vus.map(() => ({ inactive: true, etat: 'Aucune séance', zone: '120 – 135 bpm' })))
})

test('données : à l’arrivée sur l’onglet, le compte et la zone sont là dès le premier rendu', async ({ page }) => {
  await ouvrir(page, '/', { sessions: plein, zones: zoneDefinie })
  const rendus = await releverLesRendus(page)
  await geste(page, 'onglet Réglages', page.getByRole('link', { name: 'Réglages' }))
  await expect(ligneExport(page)).toContainText(`${plein.length} séances`)
  const vus = await rendus()
  expect(vus.length).toBeGreaterThan(0)
  expect(vus).toEqual(vus.map(() => ({ inactive: false, etat: `${plein.length} séances`, zone: '120 – 135 bpm' })))
})

test('données : exporter, supprimées comprises, le compteur ne montre que les visibles', async ({ page }) => {
  const sauvegarde = await fauxSauvegarde(page)
  const supprimee = { ...plein[0], id: 'supprimee', deletedAt: new Date().toISOString() }
  await ouvrir(page, '/reglages', { sessions: [...plein, supprimee] })
  await expect(ligneExport(page)).toContainText('36 séances')

  await geste(page, 'appui sur Exporter', ligneExport(page))
  await expect(toast(page)).toContainText('36 séances exportées')
  const [ecrit] = await sauvegarde.exportes()
  expect(ecrit.nom).toMatch(/^zone2-\d{4}-\d{2}-\d{2}\.json$/)
  expect(JSON.parse(ecrit.contenu).sessions).toHaveLength(37)
})

test('données : importer, puis réimporter le même fichier n’ajoute rien', async ({ page }) => {
  const sauvegarde = await fauxSauvegarde(page)
  await ouvrir(page, '/reglages')
  await sauvegarde.choisir(fichier(plein))

  await geste(page, 'appui sur Importer', ligneImport(page), undefined, { bouge: ['li'] })
  await expect(toast(page)).toContainText('36 séances importées')
  await expect(ligneExport(page)).toContainText('36 séances')
  await expect(ligneExport(page)).toBeEnabled()

  await geste(page, 'réimport du même fichier', ligneImport(page))
  await expect(toast(page).filter({ hasText: 'Aucune nouvelle séance' })).toBeVisible()
  await expect(ligneExport(page)).toContainText('36 séances')
})

test('données : un fichier étranger est refusé en entier', async ({ page }) => {
  const sauvegarde = await fauxSauvegarde(page)
  await ouvrir(page, '/reglages')
  await sauvegarde.choisir(JSON.stringify({ sessions: plein }))
  await geste(page, 'appui sur Importer', ligneImport(page))
  await expect(toast(page)).toContainText('Ce fichier ne contient aucune séance')
  await expect(ligneExport(page)).toContainText('Aucune séance')
})

test('données : fermer la fenêtre sans choisir ne dit rien', async ({ page }) => {
  const sauvegarde = await fauxSauvegarde(page)
  await ouvrir(page, '/reglages', { sessions: plein })
  await sauvegarde.repondre('export', 'ferme')
  await sauvegarde.repondre('import', 'ferme')
  await geste(page, 'export, fenêtre fermée', ligneExport(page))
  await geste(page, 'import, fenêtre fermée', ligneImport(page))
  await expect(toast(page)).toHaveCount(0)
})

test('données : le téléphone refuse d’écrire ou de lire', async ({ page }) => {
  const sauvegarde = await fauxSauvegarde(page)
  await ouvrir(page, '/reglages', { sessions: plein })
  await sauvegarde.repondre('export', 'echec')
  await sauvegarde.repondre('import', 'echec')
  await geste(page, 'export refusé', ligneExport(page))
  await expect(toast(page)).toContainText('Export impossible')
  await geste(page, 'import refusé', ligneImport(page))
  await expect(toast(page).filter({ hasText: 'Import impossible' })).toBeVisible()
  await expect(ligneExport(page)).toContainText('36 séances')
})

test('données : les séances importées paraissent aussitôt sur l’Accueil et l’Historique', async ({ page }) => {
  const sauvegarde = await fauxSauvegarde(page)
  await ouvrir(page, '/reglages')
  await sauvegarde.choisir(fichier(plein))
  await geste(page, 'appui sur Importer', ligneImport(page), undefined, { bouge: ['li'] })
  await expect(toast(page)).toContainText('36 séances importées')
  // Il reste ouvert : l'Accueil est contrôlé toast par-dessus (sujet 17).

  // Sans rechargement : seuls les écrans branchés sur la base peuvent suivre.
  await geste(page, 'onglet Accueil', page.getByRole('link', { name: 'Accueil' }))
  await expect(page.locator('a.hero')).toBeVisible()
  await expect(page.locator('.ghost')).toHaveCount(0)

  await geste(page, 'onglet Historique', page.getByRole('link', { name: 'Historique' }))
  await expect(page.locator('.hist__item')).toHaveCount(36)
})

/**
 * Note, image par image, chaque animation en cours — « élément nom durée » — et
 * le plus grand nombre de toasts vus à la fois.
 */
const noterAnimations = (page: import('@playwright/test').Page) =>
  page.addInitScript(() => {
    const suivi = { vues: new Set<string>(), toasts: 0 }
    ;(window as unknown as { suivi: typeof suivi }).suivi = suivi
    const noter = () => {
      for (const a of document.getAnimations()) {
        const effet = a.effect as KeyframeEffect | null
        const cible = effet?.target?.classList[0] ?? ''
        const nom = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty
        suivi.vues.add(`${cible}${effet?.pseudoElement ?? ''} ${nom} ${effet?.getTiming().duration}`)
      }
      suivi.toasts = Math.max(suivi.toasts, document.querySelectorAll('.toast').length)
      requestAnimationFrame(noter)
    }
    requestAnimationFrame(noter)
  })
const suiviVu = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const { vues, toasts } = (window as unknown as { suivi: { vues: Set<string>; toasts: number } }).suivi
    return { vues: [...vues], toasts }
  })

/** Exporte deux fois, toast ouvert, change d'onglet, puis ferme le toast. */
async function parcoursDuToast(page: import('@playwright/test').Page) {
  await noterAnimations(page)
  await fauxSauvegarde(page)
  await ouvrir(page, '/reglages', { sessions: plein })
  await geste(page, 'appui sur Exporter', ligneExport(page))
  await expect(toast(page)).toContainText('36 séances exportées')
  await geste(page, 'exporter à nouveau, toast ouvert', ligneExport(page))
  await expect(toast(page)).toContainText('36 séances exportées')
  await geste(page, 'onglet Accueil, toast ouvert', page.getByRole('link', { name: 'Accueil' }))
  await geste(page, 'fermer le toast', page.getByRole('button', { name: 'Fermer' }))
  // Le second a remplacé le premier : rien ne revient une fois fermé.
  await expect(toast(page)).toHaveCount(0)
  await page.waitForTimeout(500)
  await expect(toast(page)).toHaveCount(0)
  return suiviVu(page)
}

test('toast : il glisse seul, sans transition de vue, et attend que le précédent soit sorti', async ({ page }) => {
  const { vues, toasts } = await parcoursDuToast(page)
  expect(vues).toContain('toast toast-entree 320')
  expect(vues).toContain('toast toast-sortie 220')
  // Pendant une transition de vue, un appui allait à la page entière et se perdait.
  expect(vues.filter((v) => v.includes('::view-transition'))).toEqual([])
  expect(toasts).toBe(1)
  // Entre deux onglets, il rejoint la place du nouvel écran (cure des toasts).
  expect(vues).toContain('toasts bottom 200')
})

/**
 * Balaye le toast de `dx` pixels et relève sa position à chaque image jusqu'à ce
 * qu'il quitte l'écran (ou 600 ms s'il reste) : un écart ne dure qu'une image.
 */
async function balayer(page: import('@playwright/test').Page, dx: number) {
  await fauxSauvegarde(page)
  await ouvrir(page, '/reglages', { sessions: plein })
  await geste(page, 'appui sur Exporter', ligneExport(page))
  const b = (await toast(page).boundingBox())!
  // Sur le texte, hors des boutons (un geste parti d'un bouton n'est pas un
  // balayage), et du côté opposé au sens : le doigt reste dans l'écran.
  const x = dx > 0 ? b.x + 24 : b.x + b.width - 80
  const y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 8 })
  const releve = page.evaluate(
    (repos) =>
      new Promise<{ x: number; y: number }[]>((ok) => {
        const positions: { x: number; y: number }[] = []
        const debut = performance.now()
        const image = () => {
          const el = document.querySelector('.toast')
          if (!el || performance.now() - debut > 600) return ok(positions)
          // La place à l'écran, pas `translate` : il se lit `calc(100% + 8px)` en route.
          const r = el.getBoundingClientRect()
          positions.push({ x: Math.round(r.x - repos.x), y: Math.round(r.y - repos.y) })
          requestAnimationFrame(image)
        }
        image()
      }),
    { x: b.x, y: b.y },
  )
  await page.mouse.up()
  return releve
}

for (const sens of [1, -1]) {
  test(`toast : balayé ${sens > 0 ? 'à droite' : 'à gauche'}, il sort de ce côté`, async ({ page }) => {
    const positions = await balayer(page, sens * 200)
    await expect(toast(page)).toHaveCount(0)
    // Il ne descend jamais, et chaque image l'emmène plus loin dans le sens du geste.
    expect(positions.filter((p) => p.y !== 0)).toEqual([])
    const xs = positions.map((p) => sens * p.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(xs.at(-1)).toBeGreaterThan(200)
  })
}

test('toast : lâché avant le seuil, il revient en place et reste', async ({ page }) => {
  await balayer(page, 40)
  await expect(toast(page)).toBeVisible()
  await expect.poll(() => toast(page).evaluate((e) => getComputedStyle(e).translate)).toBe('none')
})

test('toast : mouvement réduit, rien ne glisse', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { vues, toasts } = await parcoursDuToast(page)
  // L'anneau du minuteur continue de tourner : il dit le temps, il ne bouge pas.
  expect(vues.filter((v) => !v.startsWith('toast__anneau '))).toEqual([])
  expect(toasts).toBe(1)
})

// Le pied se cherche après une installation, il ne se lit pas : 9 px, gris le plus pâle.
// Seule exception au plancher de 11 px (choix du PO, 2026-10-15).
test('le pied des Réglages reste discret', async ({ page }) => {
  await ouvrir(page, '/reglages')
  const pied = page.locator('.reglages__pied')
  await expect(pied).toHaveCSS('font-size', '9px')
  const pale = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fg-5').trim())
  await expect(pied).toHaveCSS('color', await page.evaluate((c) => {
    const e = document.createElement('i'); e.style.color = c; document.body.append(e)
    const r = getComputedStyle(e).color; e.remove(); return r
  }, pale))
})
