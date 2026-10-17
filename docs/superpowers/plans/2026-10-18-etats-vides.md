# États vides — Historique, Accueil, Saisie

Grille du sujet 17 (complément du 2026-10-18) appliquée aux trois écrans qui n'avaient pas de
test d'état vide. Captures sur base vide : Accueil et Saisie passent, Historique ne dit pas ce
qui viendra. Choix du PO : la phrase « Aucune séance pour l'instant. », seule — ni image, ni lien
d'import (l'import ne lit qu'une sauvegarde Zone 2, déjà dans les Réglages).

## Critères

| Critère | Vérifié par |
|---|---|
| Historique vide dit « Aucune séance pour l'instant. » sous le titre | `vide.spec.ts` |
| Historique et Accueil vides désignent le « + », qui mène à la saisie | `vide.spec.ts` |
| Historique et Accueil vides gardent leur titre et la barre d'onglets | `vide.spec.ts` |
| Accueil vide dit ce qui viendra : « Efficience », sa glose, des tirets à la place des valeurs | `vide.spec.ts` |
| Pas de faux vide : base remplie, ni la phrase ni l'invitation n'apparaissent pendant le chargement | `vide.spec.ts` |
| Rien ne saute au premier affichage des écrans vides | `ouvrir` (banc) |
| Saisie s'ouvre sur 45 minutes, puissance et FC vides affichées « — » | `vide.spec.ts` |
| Saisie : « Enregistrer » visible sans défiler au gabarit S22 | `vide.spec.ts` |
| La phrase se lit bien, au bon endroit, sur le vrai écran | angle mort — S22 |
