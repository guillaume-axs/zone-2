# Export et import des séances (sujet 15)

Deux lignes sous « Mes données » dans les Réglages : « Exporter mes séances »
écrit un fichier `zone2-AAAA-MM-JJ.json` par la fenêtre « Enregistrer sous »
du système ; « Importer une sauvegarde » relit un tel fichier et fusionne par
identifiant, sans jamais rien remplacer. Maquette v5 validée le 2026-10-11.

## Approche validée (2026-10-11)

- Un greffon à part, `SauvegardePlugin.kt` : il écrit et lit du texte, rien de plus.
- Le fichier emporte les séances supprimées ; le compteur de la ligne ne montre que les visibles.
- Validation zod du fichier entier : une seule séance mal formée fait tout refuser.
- Import en une transaction Dexie : tout est écrit, ou rien.
- « Export impossible » et « Import impossible » gardés, et testés comme le reste.

## Critères

| Critère | Vérifié par |
|---|---|
| « Mes données » : deux lignes, intitulé, précision, icône | Playwright `reglages.spec` |
| Base vide : ligne grise, icône en place, « Aucune séance », l'appui ne fait rien | Playwright `reglages.spec` |
| Base pleine (jeu `plein`, 36 séances) : « 36 séances », icône en braise | Playwright `reglages.spec` |
| Cibles d'au moins 48 dp, aucun saut, aucun débordement à 360 px, précision sur une ligne | Playwright (murs du banc) |
| Le fichier relu redonne les séances, supprimées comprises | Vitest `sauvegarde.test` |
| Une seule séance mal formée fait refuser tout le fichier | Vitest `sauvegarde.test` |
| Réimporter le même fichier ajoute 0 séance, rien n'est écrasé | Playwright `reglages.spec` |
| Textes des toasts après export et import | Playwright `reglages.spec` + Maestro |
| « Export impossible » et « Import impossible » | Playwright, faux greffon qui échoue |
| Fichier sans séance ou étranger : « Ce fichier ne contient aucune séance » | Playwright `reglages.spec` |
| La vraie app sur l'émulateur affiche « Mes données » | Maestro `sauvegarde.yaml` |
| « Enregistrer sous » : nom pré-rempli, enregistrement dans Téléchargements | Maestro `sauvegarde.yaml` |
| Import d'un fichier déposé dans Téléchargements, toast du nombre importé | Maestro `sauvegarde.yaml` |
| Fermer une fenêtre sans choisir : aucun toast | Maestro `sauvegarde.yaml` + Playwright |
| Export et import par Google Drive | angle mort — S22 |
