import { test as base, expect, type Locator, type Page } from '@playwright/test'
import type { Session, ZoneConfig } from '../src/db/schema.ts'

/**
 * Le banc d'essai (sujet 17) : ce qu'un œil humain remarque sans y penser,
 * vérifié à chaque geste. Un bouton qui saute, un toast qui recouvre, une
 * cible trop petite, un texte coupé.
 *
 * Tout passe par `geste` : un parcours n'appelle jamais `click` en direct,
 * sinon l'action échappe aux contrôles.
 */

/** Taille minimale d'une cible tactile et écart entre deux cibles, en px CSS (= dp). */
const CIBLE = 48
const ECART = 8

declare global {
  interface Window {
    __decalages: string[]
    __banc?: number
  }
}

export const test = base.extend({
  page: async ({ page }, utiliser) => {
    // Au chargement il n'y a aucune action de l'utilisateur : le CLS standard
    // s'applique tel quel, contrairement aux sauts qui suivent un geste. Un
    // décalage pendant qu'une police charge ne se voit pas : en
    // `font-display: block`, le texte reste invisible jusqu'à l'arrivée de sa
    // police, puis paraît directement à sa place (fichiers locaux, < 100 ms).
    await page.addInitScript(() => {
      window.__decalages = []
      const polices: [number, number][] = []
      document.fonts.addEventListener('loading', () => polices.push([performance.now(), Infinity]))
      // Une image de marge : le décalage est daté de l'image où la police s'applique.
      document.fonts.addEventListener('loadingdone', () => (polices.at(-1)![1] = performance.now() + 20))
      new PerformanceObserver((liste) => {
        type Source = { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }
        type Decalage = { startTime: number; sources: Source[] }
        for (const e of liste.getEntries() as unknown as Decalage[]) {
          if (polices.some(([de, a]) => e.startTime >= de && e.startTime <= a)) continue
          for (const { node, previousRect: a, currentRect: b } of e.sources) {
            // Sous le pixel, l'œil ne voit rien : arrondis de police, demi-pixels.
            if (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1) continue
            // Une boîte vide qui s'élargit ne se voit pas : seul compte ce qui
            // porte du texte, un dessin ou une action (même règle que `releve`).
            const porteur =
              node instanceof Element &&
              (node.matches('button, a, input, select, textarea, svg, img, [role]') ||
                [...node.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()))
            if (!porteur) continue
            const nom = node instanceof HTMLElement ? node.innerText.trim().slice(0, 40) : String(node?.nodeName)
            window.__decalages.push(`${nom} (${Math.round(a.x)},${Math.round(a.y)} → ${Math.round(b.x)},${Math.round(b.y)})`)
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await utiliser(page)
  },
})
export { expect }

/**
 * Met l'app dans un état, puis contrôle le premier affichage. Une première
 * visite laisse Dexie créer la base à sa version courante ; on y écrit ensuite
 * en IndexedDB brut, puis on recharge. Aucune ligne de test n'entre ainsi dans
 * le bundle de production. Sans données, la base reste vide et la zone non
 * définie.
 */
export async function ouvrir(
  page: Page,
  chemin = '/',
  { sessions = [], zones = [] }: { sessions?: Session[]; zones?: ZoneConfig[] } = {},
) {
  await page.goto(chemin)
  if (sessions.length || zones.length) {
    await page.evaluate(
      ({ sessions, zones }) =>
        new Promise<void>((ok, ko) => {
          const req = indexedDB.open('zone2')
          req.onerror = () => ko(req.error)
          req.onsuccess = () => {
            const tx = req.result.transaction(['sessions', 'zoneConfigs'], 'readwrite')
            for (const s of sessions) tx.objectStore('sessions').put(s)
            for (const z of zones) tx.objectStore('zoneConfigs').put(z)
            tx.oncomplete = () => {
              req.result.close()
              ok()
            }
            tx.onerror = () => ko(tx.error)
          }
        }),
      { sessions, zones },
    )
    await page.reload()
  }
  await premierAffichage(page, chemin)
  await controler(page, `ouverture de ${chemin}`)
}

/** Rien ne doit bouger entre le premier dessin et l'écran posé — `useLiveQuery` compris. */
export async function premierAffichage(page: Page, nom: string) {
  await stabiliser(page)
  const decalages = await page.evaluate(() => window.__decalages)
  expect(decalages, `Premier affichage de ${nom} : des éléments sautent pendant le chargement`).toEqual([])
}

/**
 * Un geste de l'utilisateur — ou un signal du natif —, contrôlé. La position de chaque élément est
 * relevée avant et après : tout ce qui bouge sans figurer dans `bouge` est un
 * saut. Le CLS ne sert à rien ici — il ignore les 500 ms qui suivent une
 * action, exactement là où nos sauts arrivent.
 *
 * `bouge` liste les sélecteurs dont le contenu a le droit de se déplacer
 * (une ligne qui change d'état, une liste qui s'allonge).
 */
export async function geste(
  page: Page,
  nom: string,
  cible: Locator,
  faire: (l: Locator) => Promise<void> = (l) => l.click(),
  { bouge = [] }: { bouge?: string[] } = {},
) {
  await test.step(nom, async () => {
    await cible.scrollIntoViewIfNeeded()
    await stabiliser(page)
    const avant = await releve(page)
    await faire(cible)
    await stabiliser(page)
    const apres = await releve(page)
    const sauts = await page.evaluate(
      ({ avant, apres, bouge }) =>
        Object.entries(apres)
          .filter(([id, b]) => {
            const a = avant[id]
            // Une valeur qui change (« 128 bpm » → « 97 bpm ») n'a pas sauté :
            // seuls comptent les voisins qu'elle aurait poussés.
            if (!a || a.nom !== b.nom || (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1)) return false
            const el = document.querySelector(`[data-banc="${id}"]`)
            return !bouge.some((s) => el?.closest(s))
          })
          .map(([id, b]) => `${b.nom} (${Math.round(avant[id].y)} → ${Math.round(b.y)} px)`),
      { avant, apres, bouge },
    )
    expect(sauts, `« ${nom} » : des éléments ont sauté`).toEqual([])
    await controler(page, nom)
  })
}

/** Les contrôles qui valent pour n'importe quel état d'écran. */
export async function controler(page: Page, etape: string) {
  const fautes = await page.evaluate(
    ({ CIBLE, ECART }) => {
      const fautes: string[] = []
      const vw = document.documentElement.clientWidth
      const nom = (el: Element) =>
        el.getAttribute('aria-label') ||
        (el as HTMLElement).innerText?.trim().replace(/\s+/g, ' ').slice(0, 40) ||
        `<${el.tagName.toLowerCase()} class="${el.className}">`
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect()
        const st = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.opacity !== '0'
      }
      const cibles = [
        ...document.querySelectorAll(
          'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=switch], [role=tab]',
        ),
      ].filter((el) => visible(el) && !el.closest('[aria-hidden=true], [inert]'))
      // Un lien dans une phrase est exempté (WCAG 2.5.8) : sa cible, c'est la ligne.
      const isolees = cibles.filter((el) => !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'))

      if (document.documentElement.scrollWidth > vw + 1) fautes.push(`la page défile en largeur`)

      for (const el of isolees) {
        const r = el.getBoundingClientRect()
        if (r.width < CIBLE - 0.5 || r.height < CIBLE - 0.5)
          fautes.push(`cible trop petite : ${nom(el)} (${Math.round(r.width)}×${Math.round(r.height)} px)`)
      }

      for (let i = 0; i < isolees.length; i++)
        for (let j = i + 1; j < isolees.length; j++) {
          const [a, b] = [isolees[i], isolees[j]]
          if (a.contains(b) || b.contains(a)) continue
          const [r, s] = [a.getBoundingClientRect(), b.getBoundingClientRect()]
          const dx = Math.max(s.left - r.right, r.left - s.right)
          const dy = Math.max(s.top - r.bottom, r.top - s.bottom)
          const ecart = Math.max(dx, dy)
          // Deux cibles qui se touchent bord à bord (lignes d'une liste,
          // onglets) sont le motif Material : seul un vide trop étroit trompe.
          if (ecart < -0.5) fautes.push(`cibles superposées : ${nom(a)} / ${nom(b)}`)
          else if (ecart > 0.5 && ecart < ECART)
            fautes.push(`cibles trop proches : ${nom(a)} / ${nom(b)} (${Math.round(ecart)} px)`)
        }

      // Recouvrement : l'élément est amené à l'écran ; s'il reste caché, rien
      // ne permet à l'utilisateur de l'atteindre.
      const defiles = [...document.querySelectorAll('*')].map((el) => [el, el.scrollTop] as const)
      for (const el of cibles) {
        el.scrollIntoView({ block: 'center', inline: 'center' })
        const r = el.getBoundingClientRect()
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (dessus && !el.contains(dessus) && !dessus.contains(el))
          fautes.push(`recouvert : ${nom(el)} sous ${nom(dessus)}`)
      }
      for (const [el, top] of defiles) el.scrollTop = top

      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1 || r.left < -1) fautes.push(`hors de l'écran : ${nom(el)}`)
        const st = getComputedStyle(el)
        if (st.overflowX !== 'visible' && st.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1) fautes.push(`texte coupé : ${nom(el)}`)
        // Une valeur courte (« 188 bpm », « Annuler ») ne se lit plus si elle
        // casse en deux lignes. Un nom ou une phrase, eux, ont le droit.
        // Mesuré sur l'élément entier : en JSX, `{bpm} bpm` fait deux nœuds texte.
        const texte = el.textContent!.trim()
        if (texte.length <= 12) {
          const plage = document.createRange()
          plage.selectNodeContents(el)
          // Une ligne de plus seulement si la boîte commence sous la précédente :
          // un bout aligné autrement (points animés) chevauche, il ne casse pas.
          const boites = [...plage.getClientRects()].filter((r) => r.width).sort((a, b) => a.top - b.top)
          let lignes = 0
          let bas = -Infinity
          for (const r of boites) {
            if (r.top >= bas - 1) lignes++
            bas = Math.max(bas, r.bottom)
          }
          if (lignes > 1) fautes.push(`valeur cassée sur ${lignes} lignes : ${texte}`)
        }
      }
      return fautes
    },
    { CIBLE, ECART },
  )
  expect(fautes, `${etape} : défauts visibles`).toEqual([])
  await test.info().attach(etape, { body: await page.screenshot(), contentType: 'image/png' })
}

/**
 * Attend que l'écran se pose : animations courtes finies (les boucles et le
 * compte à rebours d'un toast ne finissent jamais, on ne les attend pas),
 * puis deux relevés identiques à 100 ms d'écart.
 */
async function stabiliser(page: Page) {
  await page.evaluate(async () => {
    const courtes = document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming()
      return t && t.iterations !== Infinity && Number(t.endTime) <= 1500
    })
    await Promise.race([
      Promise.all(courtes.map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 2000)),
    ])
  })
  let precedent = ''
  for (let i = 0; i < 20; i++) {
    const r = JSON.stringify(await releve(page))
    if (r === precedent) return
    precedent = r
    await page.waitForTimeout(100)
  }
}

/**
 * Position de chaque élément visible qui porte du texte, une image ou une
 * action. Chacun reçoit un identifiant `data-banc` au premier relevé : un nœud
 * que React conserve garde le sien d'un relevé à l'autre. Les éléments sous
 * animation infinie (pulsation, points de recherche) sont ignorés.
 */
async function releve(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, { x: number; y: number; nom: string }> = {}
    for (const el of document.querySelectorAll('body *')) {
      const porteur =
        el.matches('button, a, input, select, textarea, svg, img, [role]') ||
        [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim())
      if (!porteur || (el.closest('svg') && el.closest('svg') !== el)) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      if (el.getAnimations({ subtree: false }).some((a) => a.effect?.getComputedTiming().iterations === Infinity))
        continue
      if (!el.hasAttribute('data-banc')) el.setAttribute('data-banc', String((window.__banc = (window.__banc ?? 0) + 1)))
      out[el.getAttribute('data-banc')!] = {
        x: r.x,
        y: r.y,
        nom:
          el.getAttribute('aria-label') ||
          (el as HTMLElement).innerText?.trim().replace(/\s+/g, ' ').slice(0, 40) ||
          `<${el.tagName.toLowerCase()}>`,
      }
    }
    return out
  })
}
