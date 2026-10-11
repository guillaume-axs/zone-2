# Flèche retour de l'Efficience

Trouvé par le banc le 2026-10-11, en prenant les captures du jeu de test : la
flèche retour de l'écran Efficience mesure 44 px, sous les 48 px des autres
cibles de l'app (`.form__fermer`, `.help`). Aucun parcours n'ouvrait cet écran.

## Approche

- `.back__arrow` passe à 48 × 48 px ; son décalage gauche passe de −13 à −15 px,
  pour que le dessin ne bouge pas.
- Le seuil du banc reste à 48 px.
- Nouveau parcours `e2e/efficience.spec.ts` : ouverture depuis le héros, retour
  par la flèche, état vide.

## Critères

| Critère | Vérifié par |
|---|---|
| La flèche retour mesure au moins 48 × 48 px | banc (`controler`) dans `efficience.spec` |
| Le dessin de la flèche reste à la même place | relu sur capture avant / après par Claude |
| L'Efficience s'ouvre depuis le héros de l'Accueil, sans défaut visible | `efficience.spec` |
| La flèche ramène à l'Accueil sur la même fenêtre (4 semaines ou 3 mois) | `efficience.spec` |
| Sans séance, l'écran affiche son état vide, sans défaut | `efficience.spec` |
| Le « ? » d'aide reste à au moins 8 px de la flèche | banc (`ECART`) |
