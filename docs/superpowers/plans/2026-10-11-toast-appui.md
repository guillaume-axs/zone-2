# Un appui n'est jamais perdu pendant le glissement du toast

## Cause

Le toast entre et sort par une transition de vue. Pendant la transition, le
calque `::view-transition` couvre l'écran : un appui tombe sur `<html>`, React
Aria l'ignore, aucune action ne part. Mesuré sur l'émulateur CI : 3 échecs du
flux `sauvegarde` sur 10, chaque fois 8,4 à 8,8 s après le retour dans l'app,
soit à la sortie du toast (8 s).

## Approche (option A, choisie par le PO)

- `Onglets.css` : `:root { view-transition-name: none }` et
  `::view-transition { pointer-events: none }`, le couple utilisé par les tests
  de référence des navigateurs (WPT `input-targets-root-while-render-blocked`).
- CI : chaque flux Maestro tourne seul, sur une app constatée fermée (plus de
  processus, plus d'activité) — sinon Android tue parfois l'app relancée
  (écran noir).
- CI : les exports `zone2-*.json` sont effacés avant chaque flux (MediaStore),
  et l'effacement est constaté. Accumulés d'un passage à l'autre, ils
  poussaient `sauvegarde-test.json` hors de l'écran du sélecteur : 2 échecs
  sur 10 à la première preuve, aux passages 9 et 10.

## Critères

| Critère | Vérifié par |
|---|---|
| Un appui pendant l'entrée ou la sortie du toast atteint son bouton | `.maestro/sauvegarde.yaml`, 10 passages consécutifs sans échec (branche `diag/sauvegarde`) |
| Un flux ne dépend pas des fichiers laissés par le précédent | 10 passages consécutifs sur le même émulateur |
| Aucun écran noir au lancement d'un flux | 10 passages consécutifs, puis chaque run du job `emulateur` |
| Le toast glisse à l'entrée et à la sortie | Playwright : `toast-entree` puis `toast-sortie` tournent sur le toast (`document.getAnimations()`) |
| Le reste de l'écran ne fond plus pendant la transition | Playwright : aucune animation sur `root` pendant la transition |
| Mouvement réduit : aucune animation | Playwright : aucune animation pendant la transition |
