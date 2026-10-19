# J1 — capture live de la série FC

*Cahier des charges validé par le PO le 2026-10-19. Cadre : `DECISIONS.md` sujets 3, 4, 11, 12,
15 §2, 16 et 18.*

## Le besoin

Qu'une vraie séance laisse **tous ses battements** dans l'app. L'affichage n'est pas la valeur — la
console du vélo montre déjà la FC, elle ne garde rien (sujet 18).

## L'usage

Téléphone posé sur la console, mains moites, 45 min à 2 h. Écran parfois verrouillé volontairement.
Aucune manipulation pendant l'effort, sauf Terminer.

## Périmètre

**Dedans** (sujet 18) : démarrer une séance depuis le bouton central · le service natif écrit chaque
battement, écran verrouillé compris, et se reconnecte seul · écran d'effort sobre — FC en héros, temps
écoulé, temps en zone, écran maintenu allumé · Terminer par appui long de 2 s · la séance est rangée
et le formulaire s'ouvre prérempli.

**Ajouté pendant ce cadrage :**

- **La séance interrompue est retrouvée** (arbitrage PO, Q1). Un journal jamais rangé, trouvé au
  lancement, est rangé seul ; « Séance de N min retrouvée » ; le formulaire s'ouvre, durée modifiable.
- **L'export porte les battements** (format version 2). Sans cela, un export perd la série sans le
  dire. Les fichiers version 1 restent lisibles.

**Dehors** (sujet 18) : alertes de sortie de zone · pause · état « Échauffement » · signature du
battement · mini-courbe de fin · puissance live (J1 bis).

## Arbitrages du PO (2026-10-19)

| # | Question | Décision |
|---|---|---|
| Q1 | Séance tuée en cours de route | Retrouvée et rangée au lancement suivant, dans J1 |
| Q2 | Pas de zone réglée | On démarre quand même ; temps en zone `—` ; une invite mène aux Réglages |
| Q3 | Durée et FC préremplies | Non modifiables (texte). Seule exception : la séance retrouvée, dont la durée se corrige |
| — | Démarrer ou saisir une séance finie | **Ouvert** : la forme se décide par le benchmark de l'écran Démarrer (rouvre la précision du sujet 3) |
| — | Qui tient la ceinture pendant la séance | **Le service seul** (approche A). Deux connexions en parallèle sont proscrites |

## Choix techniques (dev)

- **FC moyenne** = moyenne des FC envoyées par la ceinture (une trame par seconde), écrite dans
  `avgHrBpm` (sujet 11, 2026-09-20). Hypothèse : c'est aussi le calcul de la console. Le critère 13 la
  vérifie ; écart > 2 bpm → on change de formule. Réversible : les battements bruts restent.
- **Battement** = un intervalle RR de la ceinture, gardé brut (sujet 4, révision du 2026-10-13).

## Architecture

```
ceinture ─► service de séance (Kotlin) ── seul détenteur de la ceinture
              │  écrit le journal : un fichier par séance, nommé par l'heure de départ
              │  compte temps écoulé et temps en zone (bornes reçues au démarrage)
              ▼
            greffon ── relaie FC + compteurs à chaque trame ─► écran d'effort (affiche, ne calcule pas)

fin de séance, ou journal orphelin trouvé au lancement :
  greffon lit le fichier ─► TS valide (zod) ─► Dexie : séance + battements, une transaction
                        ◄─ greffon efface le fichier, seulement après
```

- **Le service compte, l'écran affiche.** Écran verrouillé, la WebView est gelée (sujet 2 bis) : un
  compteur côté JS raterait la période verrouillée.
- **Un fichier par séance** : une séance neuve n'écrase jamais un journal non rangé. Le service du PoC
  efface aujourd'hui le journal à chaque démarrage (`SurvieService.kt`) — c'est la première chose
  corrigée.
- **Identifiant déterministe** tiré de l'heure de départ : ranger deux fois le même journal ne crée
  pas de doublon (sujet 11).
- **Rangement en TypeScript**, pas en Kotlin : testable en unitaire et au banc, validation zod.
- **Dexie version 3** : table `battements`, une ligne par séance (sujet 11, point 1).
- **Pendant une séance**, la ligne Capteur des Réglages montre l'état du service et n'ouvre pas son
  propre accès.
- **Banc** : la fausse ceinture `e2e/capteur.ts` injecte le pont Capacitor dans le seul test ; aucun
  code de test n'entre dans l'app.

## Critères

| # | Critère | Vérifié par |
|---|---|---|
| 1 | Depuis le bouton central, on peut démarrer une séance live **ou** saisir une séance finie — forme fixée par le benchmark | banc |
| 2 | « Démarrer » ne s'active qu'une fois la ceinture trouvée ; Bluetooth coupé ou accès refusé suivent le parcours de la ligne Capteur (sujet 16) | banc |
| 3 | Sans zone réglée : la séance démarre, le temps en zone affiche `—`, une invite mène aux Réglages | banc |
| 4 | Écran d'effort : FC, temps écoulé, temps en zone, mis à jour à chaque trame | banc |
| 5 | Rien reçu depuis 5 s : la FC affiche `—` ; la séance continue, la reconnexion est automatique | banc + S22 |
| 6 | Un tap ne termine pas ; un appui de 2 s termine | banc |
| 7 | Le retour Android ne termine pas la séance : l'app passe en arrière-plan, le service continue | banc + S22 |
| 8 | Fin : séance rangée avec durée, FC moyenne et battements ; le journal n'est effacé qu'après confirmation | unitaire |
| 9 | Ranger deux fois le même journal ne crée pas de doublon | unitaire |
| 10 | Formulaire : durée et FC moyenne en texte non modifiable ; puissance et contexte saisissables | banc |
| 11 | Séance tuée puis app rouverte : rangée seule, « Séance de N min retrouvée », durée modifiable | banc + S22 |
| 12 | App devant : l'écran reste allumé. Verrouillé volontairement : chaque battement est enregistré, et au déverrouillage l'écran montre FC et temps à jour | banc (retour) + S22 (verrouillé) |
| 13 | **Critère J1** : 45 min, écran verrouillé au moins une fois, ~3 500 battements rangés, même FC que la console à l'instant T, moyennes à 2 bpm près | angle mort — S22 |
| 14 | Export puis import : les battements reviennent ; un fichier version 1 s'importe toujours | unitaire + banc |

## Livraison — trois PR

1. **Service et rangement** — journal par séance, compteurs, Dexie v3, export v2, séance retrouvée au
   lancement. Critères 8, 9, 11 (rangement), 14.
2. **Écran Démarrer** — benchmark (deux apps premium qui offrent live et saisie), maquette, code.
   Critères 1 à 3.
3. **Écran d'effort et fin** — benchmark, maquette, code, formulaire prérempli. Critères 4 à 7, 10,
   12 ; puis le critère 13 sur le S22.

Chaque écran suit la méthode de `CLAUDE.md` : standard Material d'abord, deux captures du marché,
maquette sur le CSS réel.

## Textes de `DECISIONS.md` à remettre en cohérence (PR 1)

Le sujet 11 (2026-09-20) et le sujet 15 §2 parlent encore d'une courbe à 5 s — formule de `avgHrBpm`,
calcul de la couverture. Le choix du 2026-10-13 (chaque battement) les remplace.
