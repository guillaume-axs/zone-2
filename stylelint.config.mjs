/*
 * Le garde-fou du barème typographique (DECISIONS.md, précision du 2026-10-12) :
 * police, taille, graisse, espacement de lettres et capitales ne se fixent que
 * dans `src/styles/typo.css`, par rôle. Lancé par `src/styles/typo.test.ts`,
 * donc par la CI.
 */

// Feuilles pas encore ramenées au barème. La liste se vide aux lots 2 et 3 ;
// n'y ajouter aucune feuille.
const PAS_ENCORE = [
  'src/styles/base.css',
  'src/ecrans/Historique.css',
  'src/ecrans/Onglets.css',
  'src/ecrans/Reglages.css',
  'src/forms/SessionForm.css',
]

export default {
  rules: {
    'property-disallowed-list': [
      ['font', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform'],
      { message: (p) => `« ${p} » se fixe dans src/styles/typo.css : choisir un rôle .t-*` },
    ],
  },
  overrides: [
    {
      files: ['src/styles/typo.css'],
      rules: {
        'property-disallowed-list': null,
        'selector-class-pattern': ['^t-[a-z]+$', { message: 'typo.css ne porte que des rôles .t-*' }],
      },
    },
    { files: ['src/styles/fonts.css', ...PAS_ENCORE], rules: { 'property-disallowed-list': null } },
  ],
}
