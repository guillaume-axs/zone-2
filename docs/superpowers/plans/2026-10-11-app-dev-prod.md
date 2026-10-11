# Apps dev et prod

Demande du PO (2026-10-11) : deux applications côte à côte sur le S22. **Zone 2**
garde les vraies séances et ne change que sur sa demande. **Zone 2 dev** est un
bac à sable, mis à jour à chaque merge, avec deux lignes en plus dans les Réglages :
« Vider la base » et « Charger le jeu de test ». Révision du sujet 9 accordée pour
la dev seulement. Contrainte du PO : le code de la dev n'apparaît **strictement
jamais** dans la prod.

## Approche

- **Android** : deux variantes (`productFlavors`). `prod` garde `fr.zone2.app`,
  elle s'installe donc par-dessus l'app actuelle. `dev` prend `fr.zone2.app.dev`
  et le nom « Zone 2 dev ». Deux identifiants, deux bases séparées.
- **Web** : une constante de build, `VITE_DEV`, vraie seulement au serveur de dev
  et au build `--mode dev`. Les lignes dev vivent dans `src/dev/` ; au build de
  prod, la condition est fausse et le code est retiré du paquet.
- **Mur** : à la CI, le paquet web de la prod (celui qui part dans l'APK) est
  fouillé : s'il contient « Vider la base » ou « Charger le jeu de test », le build
  échoue. Le paquet dev est fouillé aussi, dans l'autre sens : un mur qui ne peut
  jamais rien trouver ne prouve rien.
- **Publication** : `latest` reçoit `zone2-dev.apk` à chaque merge. La prod ne
  part que sur une étiquette `v…`, posée quand le PO le demande, dans la release
  `prod` (`releases/download/prod/zone2.apk`).
- Le jeu de test est celui du banc (`plein`), déplacé dans `src/dev/` : 36 séances
  inventées, datées depuis aujourd'hui, fusionnées par identifiant.
- Aucun toast : la ligne « Exporter » montre le résultat (« 36 séances », « Aucune
  séance »), la ligne « Zone 2 » aussi (« Non définie »).

## Critères

| Critère | Vérifié par |
|---|---|
| Les deux APK s'installent côte à côte | émulateur CI (`pm list packages`) |
| L'app dev s'appelle « Zone 2 dev », la prod « Zone 2 » | CI build (`aapt2 dump badging`) |
| Le paquet prod ne contient aucun texte des lignes dev | CI build (recherche dans `dist/`) |
| Le paquet dev les contient (le mur sait trouver) | CI build (recherche dans `dist/`) |
| « Charger le jeu de test » : 36 séances, Accueil plein, Historique rempli | Playwright `dev.spec` |
| Charger deux fois n'en ajoute aucune | Playwright `dev.spec` |
| « Vider la base » : séances et zone effacées, écrans vides | Playwright `dev.spec` |
| Le groupe Dev respecte le banc (cibles, recouvrement, pas de saut) | Playwright `dev.spec` (banc) |
| Les flux Maestro passent sur l'APK prod | émulateur CI |
| `latest` = dev à chaque merge, `prod` seulement sur étiquette `v…` | relu au diff |
| La prod s'installe par-dessus l'app actuelle sans perte de données | angle mort — S22 |
| Les deux icônes cohabitent sur l'écran d'accueil du téléphone | angle mort — S22 |
