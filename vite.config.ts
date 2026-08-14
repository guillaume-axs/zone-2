import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Le module de métriques est du TypeScript pur : il n'a besoin
  // d'aucun DOM, et `node` démarre bien plus vite que `jsdom`.
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
