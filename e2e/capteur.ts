import type { Page } from '@playwright/test'

/**
 * Le greffon `Capteur` sans téléphone ni ceinture. Capacitor route les appels
 * d'un greffon natif par `window.Capacitor` — `PluginHeaders`, `nativePromise`,
 * `nativeCallback` — que le pont Android injecte avant l'app. On injecte les
 * mêmes : `useCapteur.ts` ne voit pas la différence, et chaque signal passe par
 * le même chemin que le vrai, validation zod comprise.
 */

declare global {
  interface Window {
    __capteur: { appels: string[]; rappels: Record<string, (d: unknown) => void> }
  }
}

export async function fauxCapteur(page: Page) {
  await page.addInitScript(() => {
    const capteur: Window['__capteur'] = (window.__capteur = { appels: [], rappels: {} })
    const promesse = (rtype: string) => (name: string) => ({ name, rtype })
    Object.assign(window, {
      Capacitor: {
        PluginHeaders: [
          {
            name: 'Capteur',
            methods: [
              ...['connecter', 'annuler', 'deconnecter', 'removeListener'].map(promesse('promise')),
              promesse('callback')('addListener'),
            ],
          },
        ],
        nativePromise: async (_greffon: string, methode: string) => {
          capteur.appels.push(methode)
          return methode === 'connecter' ? { lance: true } : undefined
        },
        nativeCallback: (_greffon: string, _methode: string, o: { eventName: string }, rappel: (d: unknown) => void) => {
          capteur.rappels[o.eventName] = rappel
          return o.eventName
        },
      },
    })
  })

  return {
    /** Ce que le Kotlin aurait émis : `etat` ({ etat, nom }) ou `fc` ({ bpm }). */
    emettre: (evenement: 'etat' | 'fc', donnees: object) =>
      page.evaluate(([e, d]) => window.__capteur.rappels[e as string](d), [evenement, donnees] as const),
    /** Les méthodes du greffon que l'app a appelées, dans l'ordre. */
    appels: () => page.evaluate(() => window.__capteur.appels),
  }
}
