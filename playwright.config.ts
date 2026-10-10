import { defineConfig } from '@playwright/test'

/**
 * Le banc d'essai (sujet 17), étage 1 : l'app dans un Chromium au gabarit
 * du S22 — 360×780 CSS, densité 3, tactile.
 *
 * Port à part : un `npm run dev` lancé à la main ne se fait pas prendre
 * pour le serveur du banc. En CI, le build de production plutôt que le
 * serveur de dev : plus proche de l'APK, et pas de démarrage à froid de Vite.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
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
      ? 'npm run build && npm run preview -- --port 5199 --strictPort'
      : 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
  },
})
