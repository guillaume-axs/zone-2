import type { Page } from '@playwright/test'

/**
 * Le greffon `Sauvegarde` sans téléphone, injecté comme le faux capteur
 * (`capteur.ts`). Chaque méthode répond ce que le parcours lui a dicté :
 * l'utilisateur a choisi un endroit, a fermé la fenêtre, ou le téléphone a
 * refusé d'écrire. Le dernier cas ne se provoque pas sur un vrai Android.
 */

type Reponse = 'fait' | 'ferme' | 'echec'

declare global {
  interface Window {
    __sauvegarde: {
      exporte: { nom: string; contenu: string }[]
      export: Reponse
      import: Reponse
      fichier: string
    }
  }
}

export async function fauxSauvegarde(page: Page) {
  await page.addInitScript(() => {
    const s: Window['__sauvegarde'] = (window.__sauvegarde = { exporte: [], export: 'fait', import: 'fait', fichier: '' })
    Object.assign(window, {
      Capacitor: {
        PluginHeaders: [
          { name: 'Sauvegarde', methods: ['exporter', 'importer'].map((name) => ({ name, rtype: 'promise' })) },
        ],
        nativePromise: async (_greffon: string, methode: string, o: { nom: string; contenu: string }) => {
          const r = methode === 'exporter' ? s.export : s.import
          if (r === 'echec') throw new Error(methode === 'exporter' ? 'écriture impossible' : 'lecture impossible')
          if (r === 'ferme') return { fait: false }
          if (methode === 'exporter') s.exporte.push(o)
          return methode === 'exporter' ? { fait: true } : { fait: true, contenu: s.fichier }
        },
      },
    })
  })

  return {
    /** Ce que la prochaine fenêtre fera de l'appui. */
    repondre: (methode: 'export' | 'import', r: Reponse) =>
      page.evaluate(([m, r]) => (window.__sauvegarde[m] = r), [methode, r] as const),
    /** Le fichier que l'utilisateur choisira à l'import. */
    choisir: (contenu: string) => page.evaluate((c) => (window.__sauvegarde.fichier = c), contenu),
    /** Les fichiers écrits, dans l'ordre. */
    exportes: () => page.evaluate(() => window.__sauvegarde.exporte),
  }
}
