# Polices chargées avant le premier affichage

Choix du PO (option A, 2026-10-17). L'app ne s'affiche qu'une fois chargées toutes les polices
déclarées dans `fonts.css`, avec un plafond de 3 s, la durée de blocage de `font-display: block`.

Le banc tolérait jusqu'ici tout décalage survenu pendant le chargement d'une police. Sa
justification était fausse : le texte reste bien invisible, mais les cadres (étiquettes,
boutons) sont visibles et sautent quand la vraie police remplace celle de secours dans la mise
en page. Cette tolérance disparaît.

## Critères

| Critère | Vérifié par |
|---|---|
| Aucun élément ne bouge au premier affichage, sur chaque écran | banc, `premierAffichage`, sans tolérance de police |
| La tolérance de police n'existe plus dans `banc.ts` | relecture du diff |
| Le banc n'est plus aveugle : sans le correctif, il signale le saut de « À JEUN » | preuve rouge avant correctif |
| Une police qui ne charge pas n'empêche pas l'app de s'afficher | `fumee.spec.ts`, fichier de police bloqué |
| Test des graisses stable | `--repeat-each=10`, 10 sur 10 |
| Démarrage sans délai visible | angle mort — S22 |
