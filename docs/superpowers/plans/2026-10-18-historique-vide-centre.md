# Historique vide — la phrase au centre

Retour S22 du PO (2026-10-18) : « Aucune séance pour l'instant. » en haut à gauche laisse tout
l'écran vide jusqu'à l'invitation. Comme sur les écrans vides du marché (Zumba, Noxogy, budget,
screensdesign), la phrase se centre entre le titre et l'invitation. Deux variantes montrées au PO :
A, style inchangé (Précision) ; B, 15 px dans le gris de la Précision.

## Critères

| Critère | Vérifié par |
|---|---|
| La phrase est centrée horizontalement, à mi-hauteur entre le titre et l'invitation | `vide.spec.ts` |
| Elle ne recouvre ni le titre, ni l'invitation, ni le « + » | `vide.spec.ts` + banc (`controler`) |
| Les critères de la grille restent verts (cadre, invitation, pas de faux vide) | `vide.spec.ts` |
| Rien ne saute au premier affichage | `ouvrir` (banc) |
| La phrase reste discrète devant l'invitation braise | angle mort — S22 |
