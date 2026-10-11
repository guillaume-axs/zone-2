# Cure des toasts

Demande du PO (2026-10-11) : se caler sur le standard actuel du toast. Inventaire
des huit toasts de l'app : un seul redit ce que l'écran montre déjà — la plage
de la Zone 2, affichée par sa ligne des Réglages au retour. Il part. Les sept
autres annoncent une annulation possible ou un résultat invisible à l'écran.

Le toast gardé « Séance enregistrée » recouvre « Pourquoi ? » sur l'Accueil :
choix du PO, le modèle Material — le toast passe par-dessus le contenu le temps
de sa vie, jamais sur le « + » ni la barre. Son glissement entre onglets passe de
250 à 200 ms (Material : durée courte pour un petit trajet, 68 px ici).

## Critères

| Critère | Vérifié par |
|---|---|
| Après l'enregistrement de la Zone 2, aucun toast ; la ligne montre la nouvelle plage | Playwright `reglages.spec` |
| Le toast peut recouvrir le contenu de la page, jamais le « + » ni la barre | Banc `controler` + `banc.spec` |
| Un élément recouvert par autre chose qu'un toast reste signalé | `banc.spec` (test existant) |
| Après un import, l'Accueil est contrôlé toast ouvert, « Pourquoi ? » compris | Playwright `reglages.spec` (banc) |
| Le glissement du toast entre onglets dure 200 ms, coupé en mouvement réduit | Playwright `reglages.spec`, « toast : … » (ajouté le 2026-10-11, PR #35 : « relu au diff » n'est pas un test) |
| Les sept autres toasts ne changent pas | Parcours existants de `reglages.spec` |
| Glissement du toast entre deux onglets | Playwright `reglages.spec` : transition `bottom` de 200 ms mesurée (PR #35 ; ce n'était pas un angle mort) |
