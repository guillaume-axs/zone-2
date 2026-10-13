import { globSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'
import stylelint from 'stylelint'
import { describe, expect, it } from 'vitest'

/* Le mur du barème typographique : la configuration est `stylelint.config.mjs`. */

const ecarts = async (options: stylelint.LinterOptions) => {
  const { results } = await stylelint.lint(options)
  return results.flatMap((r) => r.warnings.map((w) => `${relative('.', r.source ?? '')}:${w.line} ${w.text}`))
}

describe('barème typographique', () => {
  it('aucune feuille ne fixe de typographie hors des rôles de typo.css', async () => {
    expect(await ecarts({ files: 'src/**/*.css' })).toEqual([])
  })

  it('une taille inventée dans une feuille d’écran est refusée', async () => {
    const code = '.nouveau { font-size: 13px; }'
    expect(await ecarts({ code, codeFilename: 'src/ecrans/Nouveau.css' })).toHaveLength(1)
  })

  it('typo.css ne porte que des rôles .t-*', async () => {
    const code = '.nouveau { font-size: 13px; }'
    expect(await ecarts({ code, codeFilename: 'src/styles/typo.css' })).toHaveLength(1)
  })

  it('aucune typographie écrite en ligne dans le TSX', () => {
    const enLigne = /\b(fontSize|fontFamily|fontWeight|letterSpacing|textTransform)\b|\bfont-(size|family|weight)=/
    const fautifs = globSync('src/**/*.tsx').filter((f) => enLigne.test(readFileSync(f, 'utf8')))
    expect(fautifs).toEqual([])
  })
})
