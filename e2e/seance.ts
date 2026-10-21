import type { Page } from '@playwright/test'

/**
 * Le greffon `Seance` sans téléphone, injecté comme le faux capteur
 * (`capteur.ts`). Il part vide : `armer` y dépose les journaux que le service
 * aurait laissés, puis recharge — le rangement au lancement tourne alors une
 * seule fois, sur un état connu. Il remplace `window.Capacitor` : il ne
 * cohabite pas avec `fauxCapteur`.
 */

export interface Journal {
  id: string
  contenu: string
}

export interface Appel {
  methode: string
  args: unknown
}

declare global {
  interface Window {
    __seance: { appels: Appel[]; journaux: Journal[]; active?: string }
  }
}

export async function fauxSeance(page: Page, { active, echec }: { active?: string; echec?: string } = {}) {
  await page.addInitScript(({ active, echec }) => {
    const s: Window['__seance'] = (window.__seance = { appels: [], journaux: [], active })
    Object.assign(window, {
      Capacitor: {
        PluginHeaders: [
          {
            name: 'Seance',
            methods: ['seanceActive', 'journaux', 'effacer', 'removeListener'].map((name) => ({ name, rtype: 'promise' })),
          },
        ],
        nativePromise: async (_greffon: string, methode: string, args: { id: string }) => {
          s.appels.push({ methode, args })
          if (methode === echec) throw new Error(`${methode} impossible`)
          if (methode === 'seanceActive') return s.active ? { id: s.active, debutMs: Date.now() } : {}
          if (methode === 'journaux') return { journaux: s.journaux.filter((j) => j.id !== s.active) }
          if (methode === 'effacer') s.journaux = s.journaux.filter((j) => j.id !== args.id)
          return undefined
        },
      },
    })
  }, { active, echec })

  return {
    /** Dépose ces journaux dans le téléphone et recharge : le lancement suivant les trouve. */
    async armer(...journaux: Journal[]) {
      await page.addInitScript((j) => window.__seance.journaux.push(...j), journaux)
      await page.reload()
    },
    /** Les méthodes du greffon que l'app a appelées, avec leurs arguments, dans l'ordre. */
    appels: () => page.evaluate(() => window.__seance.appels),
    /** Rend la main quand l'app a appelé cette méthode : le dernier appel qu'un lancement fera. */
    attendre: (methode: string) =>
      page.waitForFunction((m) => window.__seance.appels.some((a) => a.methode === m), methode),
    /** Les journaux qui restent sur le téléphone. */
    restants: () => page.evaluate(() => window.__seance.journaux.map((j) => j.id)),
  }
}
