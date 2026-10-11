# Un nouveau toast remplace l'ancien

## Cause

La file de React Aria garde l'ancien toast derrière le nouveau, et le plus récent passe
devant : fermer le nouveau fait revenir l'ancien, qui n'apprend plus rien.

## Norme (benchmark du 2026-10-11)

- Material Components Android : « Only one snackbar will be shown at a time. Showing a new
  snackbar will dismiss any previous ones first. » Dans `SnackbarManager.show`, l'ancien sort
  par son animation habituelle (`DISMISS_EVENT_CONSECUTIVE`), puis le nouveau entre.
- Jetpack Compose : un à la fois, le suivant attend ; un ancien ne revient jamais après un
  plus récent.

## Approche (validée par le PO)

Annoncer ferme d'abord le toast affiché, puis ajoute le nouveau. Les deux changements de la
file attendent la fin de la sortie en cours : l'ancien glisse dehors, puis le nouveau entre.

## Critères

| Critère | Vérifié par |
|---|---|
| Un nouveau toast remplace l'ancien : fermer le nouveau ne fait rien réapparaître | Playwright : exporter deux fois, fermer une fois, plus aucun toast |
| L'ancien sort en glissant avant que le nouveau entre, jamais deux à l'écran | Playwright : `toast-sortie` puis `toast-entree`, au plus un `.toast` à chaque image |
| « Annuler » d'une séance reste possible tant que son toast est affiché | Playwright : tests existants de l'annulation |
| Mouvement réduit : le remplacement est immédiat | Playwright : aucune animation hors anneau |
