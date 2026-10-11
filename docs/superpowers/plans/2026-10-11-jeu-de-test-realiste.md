# Jeu de test réaliste

Demande du PO (2026-10-11) : le jeu de test de l'app dev doit ressembler à un vrai
bloc de zone 2, pour que les courbes aient quelque chose à montrer. Aujourd'hui,
puissance et fréquence cardiaque tournent en boucle sur 7 et 5 valeurs : la courbe
est plate et la tendance ne dit rien.

## Approche

- Toujours 36 séances sur 12 semaines, aucune aujourd'hui, mêmes identifiants
  `jeu-de-test-${n}` : recharger n'ajoute rien.
- Fréquence cardiaque autour de 130 bpm. Puissance qui monte d'environ 135 W à
  environ 147 W sur les 12 semaines, soit à peu près +8 % d'efficience. Ce chiffre
  est une hypothèse plausible, pas une mesure publiée.
- Bruit fixe (pas de `Math.random`) d'environ ±3 W et ±2 bpm : le jeu est le même
  à chaque appui.
- Durées de 45, 60, 75 ou 90 minutes.
- Trois séances marquées « chaleur » ou « fatigue » : fréquence cardiaque plus
  haute, puissance un peu plus basse, l'efficience y fait un creux.
- Le README reçoit les liens des deux apps (le lien de `main` est cassé depuis la
  PR #36).

## Critères

| Critère | Vérifié par |
|---|---|
| Efficience des 4 dernières semaines supérieure de plus de 1 % aux 4 précédentes | `src/dev/jeu.test.ts` |
| Puissance, fréquence cardiaque et durée dans des plages plausibles | `src/dev/jeu.test.ts` |
| Le jeu est identique à chaque appel | `src/dev/jeu.test.ts` |
| Les séances « chaleur » et « fatigue » ont une efficience sous la moyenne | `src/dev/jeu.test.ts` |
| 36 séances, recharger n'en ajoute aucune | Playwright `dev.spec` (existant) |
| L'Accueil montre la tendance en hausse | Playwright `dev.spec` (`.better`) |
| Les courbes de l'Accueil et de l'Efficience montent lisiblement, avec des creux visibles | captures Playwright relues par Claude avant la PR |
| Le lien de l'app dev du README répond | `curl` après merge |
