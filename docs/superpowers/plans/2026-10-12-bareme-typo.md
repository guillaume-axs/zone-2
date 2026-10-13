# Barème typographique : le garde-fou et toute l'app

Demande du PO (2026-10-12) : ramener toute l'app au barème des rôles typographiques
(`DECISIONS.md`, précision du 2026-10-11), avec un garde-fou en dur qui empêche à jamais
de réinventer une taille ou une police. Trois lots : 1. garde-fou, Accueil, Efficience ;
2. Historique, Réglages, toasts, onglets ; 3. saisie, Zone 2.

Arbitrages du PO : héros en Instrument Serif comme le veut la charte (A) ; lignes du
Sommaire en intitulé + valeur (B) ; un rôle « Commande » en mono capitales 10,5 px pour le
sélecteur de fenêtre et les boutons texte, les onglets du bas restant une exception (C).

## Approche

- Les rôles deviennent des classes dans `src/styles/typo.css`, seul fichier autorisé à
  fixer police, taille, graisse, espacement de lettres ou capitales : `.t-hero`,
  `.t-intitule`, `.t-valeur`, `.t-precision`, `.t-titre`, `.t-commande`. Un écran ne
  choisit plus une taille, il choisit un rôle. Les feuilles d'écran gardent la couleur des
  états (choisi, inactif, amélioration).
- Le mur : stylelint (`property-disallowed-list`), lancé par un test vitest — la CI lance
  `npm test`, pas `npm run lint`. Le même test refuse une typographie écrite en ligne dans
  le TSX. La liste d'exemption des lots 2 et 3 est vidée : le mur couvre toute l'app.
- Correspondance de ce lot :

| Texte | Avant | Rôle |
|---|---|---|
| Héros (efficience, volume) | Grotesk 300, 80 px | Chiffre héros |
| « EFFICIENCE » au-dessus du héros | mono 11 px `fg-2` | Intitulé |
| Glose, tendance, « indisponible », méta des séances, écran vide | 12,5 px, tendance en mono | Précision |
| Intitulés du Sommaire, date des séances | Grotesk 14 px, mono 12 px | Intitulé |
| Valeurs du Sommaire, efficience des séances, point choisi de la courbe | mono 14 à 17 px | Valeur |
| Unité « W », axes, semaines, « DERNIÈRES SÉANCES », titre du détail | 9,5 à 12 px | Titre |
| Sélecteur de fenêtre | mono 10,5 px | Commande |
| Texte de la bulle d'aide | 12 px `fg-2` | Valeur (texte lu) |
| Invitation à la première séance | mono 12 px braise | Précision, en braise |

Lots 2 et 3 : dates de l'Historique et intitulés des champs en Intitulé (fin du `fg-4` qui
voulait dire « inactif ») ; états des Réglages en Précision ; toast en Valeur, ANNULER,
étiquettes et « Enregistrer » en Commande ; durée en Chiffre héros ; − et + dessinés en SVG ;
`.label`, `hist__value` et 5 fichiers de police devenus inutiles supprimés.

## Critères

| Critère | Vérifié par |
|---|---|
| Aucune police, taille, graisse, espacement ou capitales hors de `typo.css`, sans exemption | `src/styles/typo.test.ts` (stylelint) |
| Une taille inventée dans une feuille d'écran fait échouer le test | `src/styles/typo.test.ts` |
| `typo.css` ne contient que des rôles `.t-*` | `src/styles/typo.test.ts` (stylelint) |
| Aucune typographie en ligne dans le TSX | `src/styles/typo.test.ts` |
| Le héros de l'Accueil et de l'Efficience est en Instrument Serif 80 px, sur une ligne | Playwright `efficience.spec` |
| Rien ne saute en changeant de fenêtre, cibles à 48 px | banc (parcours existants) |
| Accueil plein, sans fréquence cardiaque, premier lancement, Efficience et bulle : rendu relu avant / après | captures Playwright relues par Claude, montrées au PO |
| Historique, Réglages, Zone 2, saisie avec erreur : rendu relu avant / après | captures Playwright relues par Claude, montrées au PO |
| Étiquettes chaleur / fatigue / à jeun / malade à 48 px (44 px sur `main`, défaut antérieur) | contrôle du banc à l'ouverture de la saisie |
| Lisibilité des 9,5 px pendant l'effort | angle mort — S22 |
| « Enregistrer » en Commande, plus discret, reste repérable mains moites | angle mort — S22 |
