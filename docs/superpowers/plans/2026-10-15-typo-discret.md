# Barème plus discret — retour du PO sur la PR #45

**Demande (2026-10-15).** Après le barème du 2026-10-14, le PO trouve l'app « trop intense et
bourrine » : intitulés de l'Accueil, axes et détail du graphe Efficience, valeurs et dates de
l'Historique, libellés et erreurs des formulaires, pied des Réglages « énorme ». Critère n°1 :
aucune incohérence d'un écran à l'autre, jamais.

**Approche (option A, validée).** On ne touche qu'aux rôles de `typo.css` ; chaque écran suit.
- Capitales mono (Intitulé, Titre, Commande) : graisse 500 → 400, espacement 0,2 em → 0,12 em.
- Rôle nouveau **Note** : mono 9 px, 400, `fg-5` — le pied des Réglages, seule exception au
  plancher de 11 px (choix du PO).
- Une date de liste prend le rôle Titre (`fg-4`), sur l'Historique comme sur l'Efficience.
- Historique : la valeur repasse en `fg-2`.
- Efficience : le détail du point choisi passe en Précision.
- Formulaires : marge haute 12 → 8 px, place de l’erreur 28 → 34 px (retour du PO : erreur trop proche du champ) ; le champ garde 48 px.
- Libellés de champ : 11 px, choisis par le PO sur la planche face à 10 px.

## Critères

| Critère | Vérifié par |
|---|---|
| Aucune taille, graisse ou espacement hors de `typo.css` | `src/styles/typo.test.ts` (stylelint) |
| Capitales mono en 400 avec un espacement de 0,12 em, sur chaque écran | test Playwright : style calculé d'un intitulé, d'un titre et d'une commande |
| Pied des Réglages en rôle Note, 9 px, `fg-5` | test Playwright `reglages.spec` |
| Une date de liste a le même rôle sur l'Historique et l'Efficience | test Playwright : style calculé comparé |
| Historique : la date et la valeur ne portent pas la même couleur | test Playwright `historique` |
| L'erreur d'un champ ne chevauche ni le champ ni le trait, rien ne bouge quand elle paraît | banc (chevauchements) et parcours existants de la saisie et de Zone 2 |
| Aucun texte visible sans rôle `.t-*` | contrôle du banc sur chaque écran |
| Rendu avant / après de chaque écran, variante 10 px des libellés (écartée) | planche de captures montrée au PO |
| L’erreur d’un champ est à 12 px au moins du trait du champ | Playwright `fumee.spec` |
| Les capitales en 400 restent lisibles sur fond noir, mains moites | angle mort — S22 |
