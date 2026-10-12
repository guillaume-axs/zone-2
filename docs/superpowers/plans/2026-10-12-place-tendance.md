# Place gardée pour la ligne de tendance

Défaut trouvé le 2026-10-11 par le banc : sur l'Accueil et l'Efficience, la ligne
« ↑ x % » n'existe que s'il y a une fenêtre précédente à comparer. En « 3 mois » et
« Tout », elle disparaît et tout ce qui suit remonte d'environ 30 px au changement
de fenêtre. Le PO a choisi de garder la place, vide (pas de texte « pas encore de
comparaison » : un texte n'apparaît que s'il y a une vraie comparaison).

## Approche

- `Valeur` (`src/ecrans/Bilan.tsx`) rend toujours `.trend`, vide sans comparaison.
- `.trend` reçoit `min-height: 1lh` : une ligne vide garde la hauteur d'une ligne pleine.
- `efficience.spec` change de fenêtre par appui, au lieu d'ouvrir `/?f=3m` en direct.

## Critères

| Critère | Vérifié par |
|---|---|
| Passer de 4 semaines à 3 mois puis à Tout ne fait rien sauter sur l'Accueil | `efficience.spec` (banc, `geste`) |
| Même chose sur l'écran Efficience | `efficience.spec` |
| Sans comparaison, aucun texte n'apparaît, la place reste vide | `efficience.spec` (`.trend` vide) |
| Avec comparaison, la ligne « ↑ x % » est inchangée | `dev.spec` (`.better`, existant) |
| Le blanc ne se remarque pas à l'œil | captures relues par Claude avant la PR |
