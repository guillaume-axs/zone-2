# Ligne inactive des Réglages

Trois défauts relevés par le PO le 2026-10-12 sur l'onglet Réglages :

1. On distingue mal une ligne inactive d'une ligne active : l'état « Aucune séance »
   reste en `fg-3`, comme celui d'une ligne active ; seuls l'intitulé et l'icône pâlissent.
2. La ligne d'export change de style juste après l'arrivée sur l'onglet : au premier
   rendu, le compte n'est pas lu (`undefined`), la ligne s'affiche active puis passe
   inactive (ou son état apparaît dans un blanc).
3. Une ligne inactive réagit à l'appui : `button:active` (`base.css`) s'applique aussi
   à un bouton `disabled` dans Chromium — vérifié le 2026-10-12.

## Approche

- Option A retenue par le PO (sujet 7 bis tenu) : toute la ligne inactive passe en
  `fg-4` — intitulé, état et icône.
- `button:active:not(:disabled)` dans `base.css`.
- `Reglages` lit les bornes et le compte, et ne pose les listes qu'une fois les deux
  lectures arrivées : le premier rendu visible est l'état final.

## Critères

| Critère | Vérifié par |
|---|---|
| Ligne inactive : intitulé, état et icône en gris pâle (`fg-4`) | `reglages.spec` (couleurs calculées) |
| Appui sur une ligne inactive : aucun changement de style | `reglages.spec` (opacité 1 pendant l'appui) |
| Appui sur une ligne active : le retour au toucher demeure | `reglages.spec` (opacité 0.72 pendant l'appui) |
| Retour du formulaire Zone avec 0 séance : l'export n'est jamais rendu actif | `reglages.spec` (relevé de chaque rendu) |
| Arrivée sur Réglages avec séances : le compte et la valeur Zone 2 sont là dès le premier rendu | `reglages.spec` (relevé de chaque rendu) |
| Lisibilité de la ligne inactive sur le S22 | angle mort — S22 |
