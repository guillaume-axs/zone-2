import { defineConfig } from '@playwright/test'

/**
 * Le banc d'essai (sujet 17), étage 1 : l'app dans un Chromium au gabarit
 * du S22 — 360×780 CSS, densité 3, tactile.
 *
 * Port à part : un `npm run dev` lancé à la main ne se fait pas prendre
 * pour le serveur du banc. En CI, le build de l'app dev plutôt que le
 * serveur de dev : plus proche de l'APK, et pas de démarrage à froid de Vite.
 * L'app dev parce que le groupe « Dev » des Réglages a ses parcours ; la prod
 * n'en diffère que par ce groupe, dont l'absence se vérifie sur le paquet.
 */
export default defineConfig({
  testDir: 'e2e',
  // Un seul navigateur : à deux, la machine de dev (2 Go) s'étouffe et les
  // tests se figent au hasard. Un banc instable ne protège de rien.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    screenshot: 'on',
    trace: 'on',
  },
  webServer: {
    command: process.env.CI
      ? 'npm run build:dev && npm run preview -- --port 5199 --strictPort'
      : 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    // Jamais un serveur qu'il n'a pas lancé : le 2026-10-11, un `vite preview`
    // oublié dans une autre copie du dépôt a fait passer les parcours sur une
    // ancienne app. Port déjà pris → échec franc, au lieu d'un faux vert.
    reuseExistingServer: false,
  },
})
