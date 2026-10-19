# J1 — capture live de la série FC

*Cahier des charges validé par le PO le 2026-10-19, relu par un architecte (agent à contexte vide) le
même jour. Cadre : `DECISIONS.md` sujets 2 bis, 3, 4, 11, 12, 15 §2, 16 et 18.*

## Le besoin

Qu'une vraie séance laisse **toutes ses trames cardiaques** dans l'app. L'affichage n'est pas la
valeur — la console du vélo montre déjà la FC, elle ne garde rien (sujet 18).

## L'usage

Téléphone posé sur la console, mains moites, 45 min à 2 h. Écran parfois verrouillé volontairement.
Aucune manipulation pendant l'effort, sauf Terminer.

## Périmètre

**Dedans** (sujet 18) : démarrer une séance depuis le bouton central · le service natif écrit chaque
trame, écran verrouillé compris, et se reconnecte seul · écran d'effort sobre — FC en héros, temps
écoulé, temps en zone, écran maintenu allumé · Terminer par appui long de 2 s · la séance est rangée
et le formulaire s'ouvre prérempli.

**Ajouté pendant ce cadrage :**

- **La séance interrompue est retrouvée** (Q1). Un journal orphelin trouvé au lancement est rangé
  seul ; « Séance de N min retrouvée » ; le formulaire s'ouvre, durée modifiable.
- **L'export porte les trames** (format version 2). Les fichiers version 1 restent lisibles.

**Dehors** (sujet 18) : alertes de sortie de zone · pause · état « Échauffement » · signature du
battement · mini-courbe de fin · puissance live (J1 bis).

## Arbitrages du PO (2026-10-19)

| # | Question | Décision |
|---|---|---|
| Q1 | Séance tuée en cours de route | Retrouvée et rangée au lancement suivant, dans J1 |
| Q2 | Pas de zone réglée | On démarre quand même ; temps en zone `—` ; une invite mène aux Réglages |
| Q3 | Durée et FC préremplies | Non modifiables (texte). Seule exception : la séance retrouvée, dont la durée se corrige |
| A1 | Ce qu'on garde de chaque trame | **Heure de réception, FC envoyée, intervalles RR.** Contact peau et événements de liaison restent dans le journal, pas en base |
| A2 | Qui cherche la ceinture avant « Démarrer » | **Le service, dès l'ouverture de l'écran Démarrer.** Il se connecte et affiche la FC — preuve de connexion — mais n'enregistre qu'au « Démarrer » |
| — | Qui tient la ceinture pendant la séance | **Le service seul.** Deux accès en parallèle sont proscrits |
| — | Démarrer ou saisir une séance finie | **Ouvert** : tranché par le benchmark de l'écran Démarrer (rouvre la précision du sujet 3) |

## Choix techniques (dev)

- **Trame rangée** = `{ t_ms, bpm, rr[] }`. `t_ms` depuis le départ ; plusieurs RR dans une trame
  (la ceinture les a mis en file) se datent à rebours depuis `t_ms`, le dernier finissant à `t_ms`.
- **FC moyenne** = moyenne des `bpm` des trames, écrite dans `avgHrBpm` (sujet 11, 2026-09-20).
  Hypothèse : c'est le calcul de la console ; le critère 13 la vérifie. Recalculable : les `bpm` sont
  gardés.
- **Identifiant** : un UUID tiré par le service au départ, écrit en première ligne et dans le nom du
  fichier `seance-<uuid>.log`. Fixe pour un journal donné, compatible avec le futur Postgres.
- **L'ancien `survie.log` du PoC** est ignoré, jamais rangé comme une séance.

## Architecture

```
écran Démarrer ouvert ─► service de séance (Kotlin) ── seul détenteur de la ceinture
                           │  se connecte, relaie la FC ; n'écrit rien encore
« Démarrer » ─────────────►│  note la séance active (uuid, fichier, bornes, heure de départ)
                           │  écrit seance-<uuid>.log, une ligne par trame
                           │  compte le temps en zone
                           ▼
                         greffon ── relaie FC + compteurs ─► écran d'effort (affiche)
                                 ── instantané à la demande (retour de la WebView gelée)

« Terminer » : le service écrit la fin, ferme le fichier, PUIS répond.
Rangement (fin, ou orphelin au lancement) :
  greffon lit le fichier ─► TS valide (zod) ─► Dexie : séance + trames, une transaction
                        ◄─ greffon efface le fichier, seulement après
```

**État du service.** La séance active est écrite sur le disque avant la première trame. Relancé seul
par Android, le service la relit, rejoue son journal pour retrouver ses compteurs et continue dans le
même fichier. Au lancement, l'app demande d'abord `seanceActive()` : si une séance tourne, elle rouvre
l'écran d'effort. **Orphelin = un journal qui n'est pas la séance active** — une séance en cours n'est
jamais rangée.

**Écran.** Il affiche, il ne calcule pas — écran verrouillé, le JavaScript est gelé (sujet 2 bis). Au
retour de l'app, il lit un instantané au lieu de rejouer les événements en retard. Le temps écoulé se
calcule à l'affichage depuis l'heure de départ du service : il avance même sans trame.

**Rangement.**
- Déjà en base → rien n'est écrit (ni écrasé), le fichier est effacé — comme `nouvelles()` de
  `sauvegarde.ts`.
- Une dernière ligne coupée par un arrêt brutal est ignorée, pas tout le fichier.
- Un journal illisible n'est **jamais** effacé ; l'erreur s'affiche.
- Dexie version 3 : table `trames`, une ligne par séance (sujet 11, point 1).

**Formulaire de fin.** Il **complète** la séance existante (puissance, contexte, durée si retrouvée) ;
il n'en crée pas une seconde.

**Robustesse du service.** Une écriture ratée s'affiche dans la notification, jamais avalée en
silence. Un échec de découverte des services BLE ne coupe pas la reconnexion. Le service suit lui-même
la coupure du Bluetooth et le silence de 5 s. Écriture vidée à chaque trame, `sync()` toutes les 30 s
et à l'arrêt.

**Écran allumé** : `FLAG_KEEP_SCREEN_ON` posé par le natif sur l'écran d'effort (aucun greffon
installé ne le fait). **Bouton retour** sur l'écran d'effort : l'app passe en arrière-plan
(`App.minimizeApp()`), elle ne revient pas à l'Accueil.

**Export v2.** Les trames se fusionnent à part : une séance déjà présente (venue d'un export v1)
reçoit ses trames si elle n'en a pas.

**Banc** : la fausse ceinture `e2e/capteur.ts` injecte le pont Capacitor dans le seul test ; aucun
code de test n'entre dans l'app.

## Critères

| # | Critère | Vérifié par |
|---|---|---|
| 1 | Depuis le bouton central, on peut démarrer une séance live **ou** saisir une séance finie — forme fixée par le benchmark | banc |
| 2 | L'écran Démarrer affiche la FC dès la ceinture connectée ; « Démarrer » ne s'active qu'à ce moment. Bluetooth coupé ou accès refusé suivent le parcours de la ligne Capteur (sujet 16) | banc |
| 3 | Sans zone réglée : la séance démarre, le temps en zone affiche `—`, une invite mène aux Réglages | banc |
| 4 | Écran d'effort : la FC suit chaque trame ; le temps écoulé avance chaque seconde, trame ou non ; le temps en zone vient du service | banc |
| 5 | Rien reçu depuis 5 s : la FC affiche `—` ; la séance continue, la reconnexion est automatique | banc + S22 |
| 6 | Un tap ne termine pas ; un appui de 2 s termine | banc |
| 7 | Le retour Android sur l'écran d'effort met l'app en arrière-plan ; le service continue | banc + S22 |
| 8 | Fin : séance rangée avec durée, FC moyenne et trames ; le journal n'est effacé qu'après confirmation | unitaire + banc |
| 9 | Ranger un journal déjà rangé n'écrit rien : ni doublon, ni watts écrasés | unitaire |
| 10 | Formulaire : il complète la séance live ; durée et FC moyenne en texte non modifiable ; puissance et contexte saisissables | banc |
| 11 | Séance tuée puis app rouverte : rangée seule, « Séance de N min retrouvée », durée modifiable | banc + S22 |
| 12 | App rouverte pendant qu'une séance tourne : l'écran d'effort revient, rien n'est rangé | banc + S22 |
| 13 | **Critère J1** : 45 min, écran verrouillé au moins une fois ; trames reçues ≥ 99 % de la durée ; somme des RR = durée à 2 % près ; même FC que la console à l'instant T ; moyennes à 2 bpm près | angle mort — S22 |
| 14 | App devant : l'écran reste allumé. Verrouillé volontairement : chaque trame est enregistrée, et au déverrouillage l'écran montre FC et temps à jour | banc (retour) + S22 (verrouillé) |
| 15 | Écriture impossible : la notification le dit | unitaire (Kotlin) ou angle mort — S22 |
| 16 | Dernière ligne coupée : le reste est rangé. Journal illisible : jamais effacé, erreur affichée | unitaire |
| 17 | Export puis import : les trames reviennent ; un fichier v1 s'importe toujours ; une séance v1 déjà présente reçoit ses trames | unitaire + banc |

## Livraison — trois PR

1. **Service et rangement** — séance active et `seanceActive()`, journal par séance, compteurs,
   instantané, arrêt attendu, robustesse, Dexie v3, export v2, orphelin au lancement. Toute l'API du
   service y naît, pour que la PR 3 ne la réinvente pas. Critères 8, 9, 11, 12, 15, 16, 17.
2. **Écran Démarrer** — benchmark (deux apps premium qui offrent live et saisie), maquette, code.
   Critères 1 à 3.
3. **Écran d'effort et fin** — benchmark, maquette, code, formulaire qui complète. Critères 4 à 7, 10,
   14 ; puis le critère 13 sur le S22.

Chaque écran suit la méthode de `CLAUDE.md` : standard Material d'abord, deux captures du marché,
maquette sur le CSS réel.

## Textes de `DECISIONS.md` à remettre en cohérence (PR 1)

Le sujet 11 (2026-09-20) et le sujet 15 §2 parlent encore d'une courbe à 5 s — formule de `avgHrBpm`,
calcul de la couverture. Le choix du 2026-10-13, précisé par A1, les remplace.
