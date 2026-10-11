# Les écrans suivent l'import — et Playwright ne teste que son propre serveur

Demande du PO (2026-10-11) : prouver que les séances importées paraissent sur
l'Accueil et l'Historique, et fermer le piège du serveur réutilisé.

## Critères

| Critère | Vérifié par |
|---|---|
| Après un import, l'Accueil quitte le premier lancement et montre le héros, sans recharger | Playwright `reglages.spec` |
| Après un import, l'Historique liste les 36 séances, sans recharger | Playwright `reglages.spec` |
| Playwright ne réutilise jamais un serveur qu'il n'a pas lancé | `playwright.config.ts` — `reuseExistingServer: false` |
| Au changement d'onglet, le toast rejoint l'ancre du nouvel écran ; il ne bouge jamais dans un même écran | Banc `geste` + `banc.spec` |
| Sur chaque écran, le toast se pose au plus 16 px au-dessus du « + », ou de la barre sans « + » | Banc `controler` + `banc.spec` |
| Accueil plein : les onglets de période font 48 px de haut, sans changement visible | Playwright `reglages.spec` (banc) |
| Accueil plein : « Pourquoi ? » offre une cible de 48 × 48 px, sans changement visible | Playwright `reglages.spec` (banc) |
| Toast qui recouvre « Pourquoi ? » sur l'Accueil | Reporté au lot « cure des toasts » — le parcours ferme le toast avant l'onglet |
| Glissement du toast entre deux onglets, à l'œil | angle mort — S22 |
