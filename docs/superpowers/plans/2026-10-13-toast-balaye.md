# Toast balayé : il sort de côté

Défaut relevé par le PO le 2026-10-13 : balayé de côté, le toast revient vers le
centre et part vers le bas. Cause : le balayage appelle la fermeture ordinaire, dont
l'animation `toast-sortie` vise toujours `translate: 0 24px`, quelle que soit la
position où le doigt l'a lâché.

Le PO a fait passer ce défaut devant le gel du sujet 18 (arbitrage du 2026-10-13).

## Approche

- Au lâcher d'un balayage, le toast reçoit `--sortie` : sa largeur dans le sens du
  geste, sur l'axe horizontal. `toast-sortie` vise `var(--sortie, 0 24px)`.
- Croix, minuteur et remplacement gardent la descente.

## Critères

| Critère | Vérifié par |
|---|---|
| Balayé à droite : le toast sort à droite, sans descendre ni revenir vers le centre | `reglages.spec` (trajectoire relevée image par image) |
| Balayé à gauche : même chose à gauche | `reglages.spec` |
| Lâché avant le seuil : le toast revient en place et reste | `reglages.spec` |
| Fermé par la croix : il descend comme avant | `reglages.spec` (parcours existant, `toast-sortie 220`) |
| Mouvement réduit : rien ne glisse | `reglages.spec` (existant) |
| Le geste au doigt sur le S22 | angle mort — S22 |
