# Mesure du banc d'essai

Le banc (sujet 17 de `DECISIONS.md`) n'a de valeur que s'il réduit les allers-retours sur le S22.
Ce compteur le dit, feature par feature.

**Une PR de retours terrain** est une PR ouverte pour corriger ce que le PO a trouvé sur le S22
après la livraison d'une feature. On ajoute la ligne quand la passe S22 de la feature est close.

**Objectif depuis le banc : au plus 1 par feature.** Avant : 2,7 en moyenne.

| Feature | PR | Retours terrain | Banc |
|---|---|---|---|
| Saisie + Accueil | #10 à #13 | 3 (#15, #16, #17) | non |
| Réglages + zone 2 | #22 | 2 (#23, #24) | non |
| Capteur cardio | #25 | 3 (#26, #27, #28) | non |
| Export + import | #30 | — | oui |

Quand une ligne dépasse 1, chaque défaut trouvé est classé : **angle mort assumé** (rien à
changer), **critère oublié** (enrichir les états fixes), **défaut que le banc aurait dû voir**
(renforcer ses contrôles).
