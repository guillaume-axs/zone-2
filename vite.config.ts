import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Le commit qui a produit ce build, mis en forme ici et pas dans l'écran.
 *
 * Deux raisons de le faire au build : la valeur est figée de toute façon, et la
 * date échappe ainsi à la langue du téléphone — `toLocaleDateString` tourne sur
 * la machine qui compile, pas sur l'appareil.
 *
 * Vide si git est injoignable (archive sans historique) : le pied de page
 * disparaît alors, plutôt que d'afficher un « inconnu » qui n'apprend rien.
 */
function commit() {
  try {
    const [hash, iso] = execSync('git log -1 --format=%h%n%cI', { encoding: 'utf8' }).trim().split('\n')
    const date = new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${hash} · ${date}`
  } catch {
    return ''
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_COMMIT': JSON.stringify(commit()),
    // L'app dev (sujet 9) : vrai au serveur de dev et au build `--mode dev`,
    // faux au build de prod. La valeur est écrite en dur dans le code avant
    // la minification, qui retire alors tout ce qu'elle garde.
    'import.meta.env.VITE_DEV': JSON.stringify(command === 'serve' || mode === 'dev'),
  },
  // Le module de métriques est du TypeScript pur : il n'a besoin
  // d'aucun DOM, et `node` démarre bien plus vite que `jsdom`.
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}))
