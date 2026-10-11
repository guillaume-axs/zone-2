# Un appui n'est jamais perdu pendant le glissement du toast

## Cause

Le toast entrait et sortait par une transition de vue (`document.startViewTransition`,
l'exemple de la documentation React Aria). Pendant la transition, un calque couvre
l'écran : un appui tombe sur `<html>`, React Aria l'ignore. Mesuré sur l'émulateur
CI : 3 échecs du flux `sauvegarde` sur 10, chaque fois 8,4 à 8,8 s après le retour
dans l'app, soit à la sortie du toast (8 s).

Premier correctif essayé : `:root { view-transition-name: none }` et
`::view-transition { pointer-events: none }`. Insuffisant : pendant que le
navigateur photographie l'écran, la norme envoie tout appui à `<html>` (WPT
`input-targets-root-while-render-blocked`). Encore 1 appui perdu sur 10.

## Approche (choisie par le PO, benchmark du 2026-10-11)

Sonner et Base UI animent le toast seul, en CSS ; aucune ne passe par une
transition de vue. On fait de même, en gardant le toast de React Aria :

- Entrée : animation CSS du toast lui-même à son insertion.
- Sortie : `wrapUpdate` marque le toast affiché `data-sortie`, attend la fin de
  son animation, puis seulement laisse React le retirer. Un nouveau toast attend
  donc que l'ancien soit parti.
- Mouvement réduit : aucune animation, le retrait est immédiat.
- CI : chaque flux Maestro tourne seul, sur une app constatée fermée (sinon
  écran noir), après effacement constaté des exports `zone2-*.json` (accumulés,
  ils poussaient `sauvegarde-test.json` hors de l'écran du sélecteur).
- Flux `sauvegarde` : il attend le sélecteur avant de choisir son dossier, et va
  toujours dans Téléchargements (il s'ouvrait parfois sur « Récents »).

## Écarts de la cure des toasts (PR #34), corrigés ici

- « Le glissement entre onglets dure 200 ms, coupé en mouvement réduit » était
  vérifié par « relu au diff » : il reçoit un test Playwright.
- « Glissement du toast entre deux onglets, à l'œil » était laissé au S22 : il
  se mesure comme le reste, il reçoit un test.
- L'échec du flux `sauvegarde` avait été attribué à l'émulateur et relancé :
  c'était l'appui perdu. Un test qui échoue sans changement de code est un bug.

## Critères

| Critère | Vérifié par |
|---|---|
| Un appui n'est jamais perdu, toast en mouvement ou non | `.maestro/sauvegarde.yaml`, 10 passages consécutifs sans échec (branche `diag/sauvegarde`) |
| Un flux ne dépend pas des fichiers ni du dossier laissés par le précédent | Les mêmes 10 passages, sur le même émulateur |
| Aucun écran noir au lancement d'un flux | Les mêmes 10 passages, puis chaque run du job `emulateur` |
| Le toast glisse à l'entrée (320 ms) et à la sortie (220 ms), seul | Playwright : `toast-entree` puis `toast-sortie` sur `.toast`, aucune transition de vue |
| Un nouveau toast attend que l'ancien soit sorti : jamais deux à l'écran | Playwright : au plus un `.toast` à chaque image |
| Entre deux onglets, le toast glisse en 200 ms | Playwright : transition `bottom` de 200 ms sur `.toasts` |
| Mouvement réduit : ni glissement d'entrée ou de sortie, ni entre onglets | Playwright |
