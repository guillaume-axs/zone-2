# Zone 2 — Décisions de cadrage

> Journal des décisions validées pendant la phase de cadrage.
> Date : 2026-08-09. À convertir en spec formelle une fois les 7 sujets clos.

## Contexte

App perso de suivi d'entraînement cycliste en zone 2 sur vélo stationnaire (salle de sport).
Objectifs : perte de gras + préparation triathlon longue distance.
Usage **100% mobile Android**, y compris pendant la séance. Profil : data engineer, mode Product Owner.

**Deux raisons d'être** (validées) : l'étape 2 (FC en direct) est le vrai but ; et zéro friction de saisie,
parce que le risque n°1 déclaré est le décrochage une fois la nouveauté passée.

---

## Sujet 1 — Périmètre du MVP (étape 1) ✅

**Dans le périmètre**
- Saisie manuelle d'une séance — formulaire unique, feuille modale
- Historique : liste complète, éditable, supprimable
- Accueil : stats du mois (volume, nb séances, delta vs mois précédent) + graphique EF + filtres `4 sem / 3 mois / tout` + 3 dernières séances
- Persistance locale + synchro
- Export des données

**Hors périmètre — explicitement**
- Graphiques FC seule et puissance seule (redondants avec l'EF tant qu'il n'y a pas 3 mois d'historique)
- Comparaison 4 sem vs 4 sem précédentes
- Comptes tiers, fonctions sociales, Strava/Garmin
- Toute la capture live BLE → **étape 2**

**Champs du formulaire** *(révisé le 2026-08-14 — voir sujet 9)* — un seul obligatoire :

| Champ | Statut |
|---|---|
| Durée (min) | **obligatoire** |
| Puissance moyenne (W) | optionnel — lue sur la console du vélo |
| FC moyenne (bpm) | optionnel |
| Contexte (4 tags) | optionnel — salle chaude / fatigué / à jeun / malade |

Une séance sans FC ni watts s'enregistre quand même : elle compte dans le volume, elle n'apparaît pas dans la courbe d'EF.

**Quatre champs retirés du formulaire, conservés dans le modèle** — date & heure, distance, RPE, note.
Ils ne sont pas indexés dans Dexie : les réintroduire ne coûtera aucune migration. La date et l'heure
sont désormais horodatées à l'enregistrement, sans champ de saisie ; la correction après coup relève
de l'écran d'édition de l'historique. La note a été coupée parce qu'un champ libre qu'on ne remplit
jamais coûte plus en friction qu'il ne rapporte en information.

**Décision produit clé :** le dashboard ne dit rien avant ~8-10 séances. Le MVP doit donc être gratifiant
**dès la première saisie** → le bloc stats du mois est aussi important que les courbes.

---

## Sujet 2 — Cible technique ✅

| Décision | Choix |
|---|---|
| Runtime | **Capacitor + React + TypeScript + Vite** → APK Android |
| Build | **GitHub Actions**, APK publié en artefact de release (pas d'Android Studio, pas de câble) |
| Stockage | **Local-first** — l'app fonctionne sans réseau, indispensable en salle et pendant une séance |
| Pérennité | **Supabase** — Postgres UE + auth + RLS |
| Synchro | File d'attente locale, push/pull, dernier écrivain gagne. **Pas de CRDT** (1 user, 1 device) |
| 3ᵉ copie | Dump JSON+CSV vers repo Git privé, **tous les 3 jours** |
| Multi-user | Schéma synchronisable (UUID, `updated_at`, soft delete) et **rien de plus** |
| Coût | **0 €/mois** — ~1 Mo/an sur un quota de 500 Mo |

**Motif du choix Capacitor plutôt que PWA :** exigence « zéro friction » sur la reconnexion de la ceinture.
Le Web Bluetooth fonctionne sur Chrome Android (GATT sans flag) mais `getDevices()` et les permissions
persistantes restent derrière un flag en 2026 → 2 taps par séance, et le BLE est throttlé dès que la page
passe en arrière-plan. Inacceptable au regard de l'exigence.

**Motif du choix Capacitor plutôt que React Native :** conserve Tailwind + shadcn/ui et la boucle
d'itération visuelle en navigateur (`npm run dev`). L'APK n'est nécessaire que pour tester le BLE.

**Le dump tous les 3 jours résout deux problèmes d'un coup :** troisième copie des données **et**
neutralisation de la mise en pause Supabase après 7 jours d'inactivité (le job touche la base et réarme le compteur).

---

## Sujet 2 bis — BLE en arrière-plan ✅ *(décidé le 2026-08-11)*

**Exigence :** pendant une séance d'1 à 4 h, l'utilisateur doit pouvoir recevoir un appel, ouvrir YouTube,
verrouiller son écran — **sans aucune perte de mesure ni déconnexion**.

### Architecture retenue — à implémenter à l'étape 2

```
Service de premier plan Android (Kotlin)   ← notification permanente obligatoire
   ├─ tient la connexion GATT
   ├─ reçoit chaque battement
   └─ l'écrit dans un journal natif, ligne par ligne  ← voir sujet 11
       └─ le JavaScript ne tourne PAS pendant la séance
       └─ il importe le journal en base à la fin, quand il se réveille
+ écran d'accueil guidant la désactivation de l'optimisation batterie, une seule fois
```

**Le point clé :** en faisant tout le travail en natif, le gel de la WebView cesse d'être un problème —
on ne dépend plus du JS pendant la séance. Il ne sert qu'à afficher, quand l'écran est allumé.
C'est l'architecture de Strava, Garmin et Polar.

### Ce qui a été vérifié (et écarté)

| Piste | Verdict |
|---|---|
| `@capacitor-community/bluetooth-le` seul | ❌ **Aucun service de premier plan.** Issue #643 ouverte depuis avril 2024, jamais répondue. JS gelé à ~5 min |
| `@capawesome-team/capacitor-android-foreground-service` | ❌ Types `location` et `microphone` **uniquement** — pas `connectedDevice`, donc illégal pour du BLE sur Android 14+ |
| `@capacitor/background-runner` | ❌ Pas d'accès BLE, 10 min maximum |
| `Cap-go/capacitor-bluetooth-low-energy` | ⚠️ Revendique `startForegroundService()` mais **9 étoiles** — non éprouvé |
| **Bascule vers React Native** | ❌ **Évaluée puis réfutée.** `react-native-ble-plx` ne déclare aucun `<service>` dans son manifeste ; `isBackgroundEnabled` n'ajoute qu'une ligne `uses-feature` ; issues #217/#484/#127/#1177 sans réponse ; l'arrière-plan RN passe par Headless JS, non branché à la bibliothèque. Le seul fork qui l'implémente a 12 étoiles et cherche des mainteneurs |
| **Capawesome BLE (payant)** | ✅ Fonctionne — service `connectedDevice` + tâches Kotlin natives. Écarté : casse le « 0 €/mois » |

**Motif de la décision :** aucun framework hybride ne livre ça gratuitement. Ni Capacitor, ni React Native.
Dans les deux cas il faut écrire le Kotlin — donc **on reste sur Capacitor** et on l'écrit nous-mêmes.

### Limite à assumer

**Samsung, Xiaomi, OnePlus et Huawei tuent les services en arrière-plan** de façon agressive, même
correctement déclarés, même avec exemption batterie. **Aucune pile ne résout ça** — pas même du Kotlin natif pur.
→ Filet de sécurité **matériel** : privilégier une **ceinture à mémoire interne** (type Polar H10) qui
enregistre de son côté. *Relecture par une app tierce : vérifiée le 2026-08-27, voir plus bas.*

**Appareil cible confirmé : Samsung Galaxy S22.** C'est le cas défavorable. One UI empile trois mécanismes
par-dessus Android : optimisation batterie, mise en veille des applications peu utilisées, et « Soins de
l'appareil » qui réactive ses optimisations de lui-même. Référencé sur dontkillmyapp.com.
→ **L'écran d'accueil guidant la désactivation devient obligatoire**, et devra couvrir les trois réglages.
→ **La ceinture à mémoire interne n'est plus un confort mais la seule garantie réelle.**
*À revérifier concrètement à l'étape 2 — les comportements One UI changent à chaque version.*

### Contraintes Android à respecter

- Permissions `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (Android 12+), `POST_NOTIFICATIONS` (13+)
- `foregroundServiceType="connectedDevice"` **obligatoire** sur Android 14+, sinon `MissingForegroundServiceTypeException`
- La notification permanente n'est pas contournable — c'est le prix d'entrée de la catégorie

### Vérifications du 2026-08-27, avant l'étape 2

**Capteur retenu : Polar H10, ceinture Pro.** Service standard `0x180D`, intervalles RR à 1 Hz, deux
connexions BLE simultanées, pile CR2025 d'environ 400 h. Ce n'est pas la précision qui l'a désigné —
elle a convergé entre ceintures ECG — mais **sa mémoire interne**, qui est la réponse matérielle à la
limite ci-dessus.

La question laissée ouverte avant achat est **levée** : le *Polar BLE SDK* est public, maintenu, Android
et iOS, distribué via JitPack, et expose `FEATURE_POLAR_H10_EXERCISE_RECORDING` — la mémoire est donc
relisible par notre application. Sa licence propriétaire autorise l'usage privé et commercial à condition
de conserver la mention de copyright. **Aucun wrapper Capacitor n'existe** : ce pont est du travail à
écrire, à budgéter à l'étape 2.

**L'appareil cible a changé de version.** Le S22 tourne désormais sous **Android 16 / One UI 8**, sa
dernière montée de version majeure, et le projet vise `targetSdk 36`. La limite assumée se mesure donc
dans la configuration la moins indulgente qui existera pour cet appareil.

**La limite assumée cesse d'être une hypothèse : elle est mesurée.** Le PoC de survie (PR #5) fait battre
un service `connectedDevice` toutes les secondes et journalise chaque battement sur disque. Critère
d'acceptation : **quatre heures, aucun silence de plus de 5 s, service vivant à la fin.**

| Verdict | Conséquence |
|---|---|
| Aucune interruption | L'étape 2 part sur cette architecture, la mémoire de la ceinture reste un filet |
| Interrompu | La mémoire interne devient le mode nominal, la connexion vivante n'étant plus qu'un confort |

**Le code natif est en Kotlin, comme prévu ici.** Le PoC a d'abord été écrit en Java par simple
mimétisme avec les fichiers générés par Capacitor — un écart à cette décision, corrigé le 2026-08-27 :
le support Kotlin est configuré et les trois fichiers natifs sont convertis. Ce n'était pas une
préférence de style. **Le SDK Polar impose `kotlinx-coroutines-core` et `kotlinx-coroutines-rx3`**, il
est écrit en Kotlin, et ses fonctions `suspend` ne sont pas appelables depuis Java sans passer par
`runBlocking` — qui bloque le thread — ou par un adaptateur RxJava3. Écrire l'étape 2 en Java aurait
signifié programmer contre une traduction de l'API sur le code le plus critique du projet.

**Règle qui en découle : plus une ligne de Java dans `android/`.** Java n'a jamais été un choix ici,
seulement le défaut des fichiers générés.

---

## Sujet 3 — Parcours utilisateur ✅

**Navigation :** barre d'onglets en bas — `Accueil / Historique / Réglages` + bouton flottant central.
Vieillit bien : à l'étape 2 le bouton central devient **« ▶ Démarrer »** et la saisie manuelle passe en action secondaire.

**Écrans (étape 1)**

| Écran | Contenu |
|---|---|
| Accueil | Stats du mois · graphique EF · filtres période · 3 dernières séances |
| Historique | Liste complète, tap pour éditer, swipe pour supprimer |
| Réglages | Zones cibles · compte · état de synchro · export |
| Saisie (**écran plein**, route dédiée) | Formulaire pré-rempli |
| *(étape 2)* Séance live | Plein écran, lancé par le bouton central |

**Formulaire pré-rempli depuis la séance précédente.** Parcours nominal : ouvrir → `+` → corriger 2 chiffres →
Enregistrer = **4 gestes, ~6 secondes**.

**Parade au risque du pré-remplissage** (enregistrer par erreur les valeurs de la veille) : valeurs reprises
affichées en gris atténué avec la mention « repris du 07/08 » ; un tap sur un champ le sélectionne entièrement.

---

## Sujet 3 bis — Bibliothèque de composants ✅ *(décidé le 2026-08-11)*

**Retenu : React Aria Components** (Adobe, v1.20.0 — juillet 2026).

Bibliothèque *headless* : elle fournit le comportement — accessibilité, gestion du focus, états tactiles —
**et aucun style**. La charte graphique du sujet 7 reste donc intacte.

**Motif du choix :** le risque identifié est « des composants qui réagissent mal aux interactions une fois
sur mobile ». Le `usePress` d'Adobe traite explicitement les différences doigt / souris / stylet et règle le
problème du `:hover` qui reste collé après un appui tactile. C'est le critère décisif, pas le nombre de composants.

**Écarté :** Ark UI (v5.38.1, août 2026) — excellent et plus large, mais l'argument mobile est moins central
dans sa conception. Ionic React — impose son propre système de design Material/iOS. shadcn/ui — pensé pour
le bureau, ne traite quasiment aucun des pièges tactiles. **Vaul — abandonné, dernière publication
décembre 2024.**

**Conséquence assumée : pas de composant *drawer*.** Aucune des deux finalistes n'en fournit et la référence
du domaine est morte. → **Le formulaire de saisie devient un écran plein avec sa propre route.** Plus simple,
plus ergonomique pour un formulaire sur mobile, et cela supprime le composant le plus risqué du projet.

**Critère de validation, vérifiable à l'œil sur le téléphone :** appuyer sur un bouton ; il ne doit pas rester
allumé une fois le doigt retiré.

### Révision du 2026-08-21 — la dépendance est retirée, le critère reste

`react-aria-components` a été **désinstallée**. Son unique usage était le bouton de l'écran de preuve de vie
de l'itération 1, écran supprimé avec l'arrivée de la saisie. L'écran de saisie n'emploie que des contrôles
natifs — `<button>`, `<input>` — qui n'ont besoin d'aucune aide pour être accessibles et tactiles.

**Le critère de validation, lui, ne bouge pas** : un bouton ne doit jamais rester allumé après le retrait du
doigt. Ce qui l'assure désormais est une règle CSS, inscrite en tête de `src/styles/base.css` :

> Aucun `:hover` en dehors de `@media (hover: hover)`. Le retour au toucher passe par `:active`.

C'est une garantie plus solide que la bibliothèque ne l'offrait, parce qu'elle est structurelle : le défaut
vient d'une règle `:hover` appliquée à un doigt, et cette média-requête rend le cas impossible quel que soit
le composant. La bibliothèque, elle, ne protégeait que les éléments qu'on lui confiait.

**Quand la réinstaller :** le jour où un écran a besoin d'un composant que HTML ne fournit pas — onglets,
liste déroulante personnalisée, boîte de dialogue. L'analyse ci-dessus reste valable telle quelle.

---

## Sujet 4 — Métier et modèle de données ✅

### Métier

**Efficiency Factor (EF) = puissance moyenne ÷ FC moyenne.** Indicateur central, une valeur par séance,
calculable dès l'étape 1. Progresser = produire plus de watts à FC égale.

**Découplage aérobie (Pw:HR)** = écart d'EF entre première et seconde moitié de séance.
`< 5%` endurance solide · `> 10%` base encore à construire.
⚠️ **Exige la série temporelle → métrique d'étape 2 uniquement.**

**Piège d'interprétation à gérer :** l'EF est très sensible à la dérive cardiaque (chaleur, déshydratation,
sommeil). D'où les 3 tags de contexte — pour écarter les séances aberrantes au lieu de croire à une régression.

**Calibrage des zones.** Le bon test **n'est pas** la FC max (les bornes de zone 2 dépendent du premier
seuil LT1, pas du plafond ; deux athlètes de même FC max peuvent avoir un LT1 séparé de 20 bpm).
Le bon test est le **LTHR**, réalisable sur le vélo de salle :

> Échauffement 15 min, puis **30 min à la plus haute intensité tenable régulièrement, seul**.
> **LTHR = FC moyenne des 20 dernières minutes.** Puis **zone 2 = 81 à 89% de la LTHR** (Friel).
> À refaire tous les 3-4 mois.

Plage provisoire en attendant la ceinture, remplacée après le test. Ne bloque pas le démarrage.

### Modèle

```
session                          hr_sample  (étape 2, pas de 5 s)
─────────────────────────        ──────────────────────────────
id            uuid  PK           session_id   uuid  FK ─┐
user_id       uuid  FK           t_offset_s   int       │ PK
started_at    timestamptz        bpm          smallint  │
duration_s    int      ●         power_w      smallint ─┘
avg_power_w   int
avg_hr_bpm    int                zone_config  (SCD type 2)
distance_m    int                ──────────────────────────────
rpe           smallint           id          uuid  PK
notes         text               user_id     uuid  FK
source        manual|live        valid_from  date
context       tags[]             method      lthr|maf|hrmax|manuel
created_at    timestamptz        lthr_bpm    smallint
updated_at    timestamptz        z2_min_bpm  smallint
deleted_at    timestamptz        z2_max_bpm  smallint

● = seul champ obligatoire
```

**Zones historisées en SCD type 2** : changer ses zones ne doit **jamais** réinterpréter rétroactivement
l'historique. Chaque séance est lue à travers les zones en vigueur ce jour-là.

**Aucun dérivé n'est stocké.** EF, découplage, moyennes glissantes = fonctions pures calculées à la lecture.
C'est le module testé qui sert de pièce vitrine, et ça élimine toute désynchronisation données/agrégats.

**Série FC : pas de 5 secondes, en lignes SQL** (~540 points/séance). Interrogeable en SQL, branchable sur
dbt/Metabase/notebook — c'est l'usage qui justifie d'avoir choisi Postgres.

### Vélo de salle

**Technogym — ne diffuse pas en FTMS.** Protocole BLE propriétaire intégré au cas par cas par Zwift ;
TrainerRoad et les autres ne s'y connectent pas. **Le rétro-ingéniérer est explicitement hors périmètre.**
→ La puissance reste en saisie manuelle.

*Vérification gratuite à faire une fois :* scanner avec **nRF Connect** à côté du vélo. Si `0x1826` apparaît, réviser.

---

## Sujet 7 — Direction visuelle ✅

Base **A1 · Instrument de précision** (sombre) + logo de A2 + typographie de A3.
Dosage retenu : **V2 — serif sur les héros**.

| Élément | Décision |
|---|---|
| Fond | Quasi-noir `#0C0C0E`, **grain SVG léger** (tue l'aspect « dégradé plat généré ») |
| Accent | **Braise `#E8663D`** — pas de néon |
| Structure | **Filets fins, pas de cartes arrondies** |
| Logo | **Trace ECG** en SVG |
| Police d'interface | **Space Grotesk** |
| Police d'étiquettes | **IBM Plex Mono** — petites, très espacées, en capitales |
| Police d'affichage | **Instrument Serif**, réservée **aux seuls chiffres héros** (volume du mois, valeur d'EF) |

**Motif du dosage V2 :** Space Grotesk seul est très employé par la vague d'apps actuelle — le serif,
placé uniquement sur les deux chiffres que l'œil attrape en premier, signe l'app sans l'alourdir.
Le serif n'apparaît **jamais** ailleurs (ni titres, ni listes, ni boutons).

**Principe directeur : la couleur ne décore jamais.** Elle ne sert qu'à porter une information
(dans la zone / hors zone / progression).

### Code de référence — à reprendre tel quel

> Extrait des maquettes validées. **Seule source de vérité** : les maquettes HTML sous `.superpowers/`
> sont un répertoire de travail jetable, ce bloc-ci est versionné.

**Polices** — *révisé le 2026-08-13 : les polices sont **embarquées**, pas chargées depuis un CDN.*

Le lien Google Fonts initialement prévu a été abandonné : il rend le premier affichage dépendant du réseau,
ce qui contredit le principe « local d'abord » — l'application doit s'afficher correctement en salle, hors ligne.
Les sept fichiers `.woff2` (sous-ensemble latin, 156 Ko au total) vivent dans `public/fonts/`, déclarés par
`src/styles/fonts.css`.

```
Instrument Serif 400 · Space Grotesk 400/500/600/700 · IBM Plex Mono 400/500
```

**Palette** — telle qu'employée dans la maquette V2

| Jeton | Valeur | Usage |
|---|---|---|
| `bg` | `#0C0C0E` | Fond |
| `fg-hero` | `#F5F1E8` | Chiffres héros |
| `fg` | `#EDE8DE` | Texte courant |
| `fg-2` | `#C9C4B8` | Valeurs de liste |
| `fg-3` | `#8A867C` | Texte atténué, unités |
| `fg-4` | `#5E5B54` | Étiquettes mono, dates |
| `fg-5` | `#46443F` | Onglet inactif |
| `rule` | `#232320` | Filets structurants |
| `rule-2` | `#1A1A18` | Filets de liste, grille |
| `accent` | `#E8663D` | **Information uniquement** |

**Logo — trace ECG**

```html
<svg width="30" height="11" viewBox="0 0 30 11">
  <path d="M0,5.5 L7,5.5 L9.5,1.5 L13,9.5 L16,5.5 L30,5.5"
        fill="none" stroke="#E8663D" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**Grain** — calque en superposition, `position:absolute; inset:0`

```css
.grain {
  position: absolute; inset: 0;
  pointer-events: none;
  opacity: .5;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E");
}
```

**Étiquettes mono** — le motif répété partout

```css
.label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: #5E5B54;
}
```

**Chiffres héros** — `Instrument Serif`, l'unité en petit et atténuée

```html
<div style="font-family:'Instrument Serif',Georgia,serif;font-size:76px;
            letter-spacing:-.02em;line-height:.94;color:#F5F1E8;">
  4<span style="font-size:36px;color:#8A867C;">h</span>20
</div>
```

**Courbe d'EF** — SVG nu, `viewBox="0 0 200 56"` : ligne de base `#232320`, repère médian
`#1A1A18` en `stroke-dasharray="2 4"`, tracé `#E8663D` en `stroke-width="1.6"`, point final `r="2.8"`.

---

### 🫀 Signature à implémenter — étape 2

**L'interface entière bat à la fréquence cardiaque réelle.**
Pas une animation décorative en boucle : une pulsation **pilotée par les données de la ceinture**,
à 131 bpm quand la FC est à 131. L'utilisateur sent s'il est dans sa zone avant d'avoir lu le chiffre.

- Coût d'implémentation : quelques lignes (durée d'animation CSS pilotée par une variable)
- Née du domaine, aucun template ne l'a
- **À ne pas perdre** — c'est l'élément de signature du produit

---

## Sujet 8 — Publication et posture de sécurité ✅ *(décidé le 2026-08-13)*

Le dépôt est **public**. Cela impose une règle simple : **rien d'identifiant n'entre dans le dépôt**, et ce qui
y est entré par erreur doit être purgé de l'historique, pas seulement du dernier commit — `.gitignore` n'a
aucun effet rétroactif.

**Purgé avant la première publication** *(historique réécrit, rien n'ayant encore été poussé)* :

| Élément | Motif |
|---|---|
| L'`applicationId` d'origine, qui contenait un patronyme → **`fr.zone2.app`** | Un `applicationId` est **définitif après publication sur le Play Store** et apparaît dans l'URL du Store, les journaux et les permissions. Le coût du changement était de quinze minutes avant publication, infini après. |
| Le brief initial, rédigé à la première personne | Objectifs de santé et traits personnels — sans valeur pour un lecteur, indexables à jamais. |
| Le chemin absolu du poste de travail | Révélait le nom de session de la machine. |

> Ce tableau nomme la **catégorie** de ce qui a été retiré, jamais la valeur. Documenter une purge en citant
> la donnée purgée la réintroduit — et aucun outil ne le signalera, puisqu'un patronyme n'est pas un secret
> au sens d'un scanner.

**Ce qui reste identifiant est volontaire** : le prénom comme auteur des commits et le pseudo dans l'adresse
masquée `@users.noreply.github.com`. C'est le lien avec le profil GitHub — c'est le but. L'adresse
personnelle, elle, n'apparaît nulle part.

### Deux garde-fous permanents, plutôt qu'un audit ponctuel

Un audit ne protège que du jour où il est mené. Le risque réel arrive plus tard, quand Supabase et ses clés
d'API entreront dans le projet.

| Garde-fou | Quand il agit |
|---|---|
| **Push protection** GitHub | **Avant** la fuite — le push est refusé, le secret ne touche jamais les serveurs |
| **gitleaks en CI** *(job `secrets`, version épinglée)* | **Après** le push — analyse l'**historique complet**, car un secret introduit puis « corrigé » au commit suivant reste exploitable |
| **Protection de `main`** | PR obligatoire, `secrets` et `build` doivent passer, aucun *force push*, **administrateurs inclus** |

Le job `build` **dépend** de `secrets` : aucun artefact n'est produit si l'analyse échoue.

**Enseignement de l'audit :** l'outil et la relecture manuelle ne trouvent pas les mêmes choses. gitleaks n'a
rien signalé — mais la relecture a rattrapé un **message de commit** citant l'ancien identifiant (les filtres
d'historique ne touchent pas aux messages) et un chemin absolu présent depuis le commit initial. **Les deux
sont nécessaires.**

### Distribution

L'APK est publié dans une release à étiquette fixe `latest`, donc à **adresse invariable** :
`releases/download/latest/zone2.apk`. Un artefact d'Actions ne convient pas — livré en ZIP et réservé aux
utilisateurs authentifiés, il est inutilisable depuis un téléphone, c'est-à-dire au seul endroit où l'on
souhaite installer l'application. La clé de signature reste celle de debug : une future version signée pour
publication exigera une désinstallation préalable.

---

## Sujet 9 — Cas d'usage et ordonnancement ✅ *(décidé le 2026-08-14)*

Les huit sujets précédents décrivent **ce que** l'application fait. Aucun ne disait **dans quelles
situations** on s'en sert. Le trou est apparu en réduisant le formulaire de saisie : impossible de
choisir les champs sans savoir qui les remplit, et quand.

### Deux modes, pas trois

| Mode | Situation | Saisi à la main |
|---|---|---|
| **Live** — la raison d'être | Ceinture en place, application lancée au début de la séance | La **puissance** seule, en fin de séance |
| **Manuel** — le filet | Ceinture oubliée, téléphone déchargé, plantage, autre salle | **Tout**, après coup |

L'utilisateur qui lit sa fréquence cardiaque sur une montre n'est pas un troisième mode : c'est le mode
manuel. Il renonce au retour en direct — savoir s'il est en zone 2 pendant l'effort — mais l'application
lui sert quand même d'historique. Aucun développement supplémentaire.

**Conséquence sur le formulaire de saisie manuelle : il n'est pas du travail jetable.** C'est le mode
manuel définitif. Le mode live viendra simplement pré-remplir deux de ses champs, la durée et la FC.

**Écarté explicitement :** l'import de fichiers `.fit` et les intégrations Garmin, Polar Flow ou Strava.
Chantier entier pour un bénéfice nul dans l'usage visé, déjà refusé au sujet 1.

### Séances factices pendant l'attente de la ceinture

Aucune source de fréquence cardiaque n'existe aujourd'hui : ni ceinture, ni montre, ni poignées sur le
vélo. Plutôt que d'attendre la livraison sans rien produire, on saisit des séances aux valeurs inventées
mais plausibles. L'efficience se calcule, les graphiques ont de quoi s'afficher et se valider.

**Purge : par réinstallation de l'APK, pas par du code.** Le jour où la ceinture arrive, désinstaller puis
réinstaller vide les données locales et repart sur une base propre. Pas de champ « séance de test », pas
de mode démo : ce serait de la complexité permanente pour un problème qui dure trois semaines. Le risque
réel n'est pas technique — c'est qu'une intention humaine de « ne pas en tenir compte » ne suffit pas :
l'application, elle, moyennerait le vrai et le faux sans faire la différence.

### Ordre des itérations

**2. Formulaire de saisie · 3. Graphiques · 4. Capture BLE**

Le BLE est le risque qui peut tuer le projet, et le programmer en dernier est contestable. Il l'est moins
ici pour une raison matérielle : **rien du BLE n'est testable sans ceinture** — pas de connexion GATT à
tenir, pas de reconnexion à éprouver, pas de service à faire survivre à One UI. Le chemin critique du
projet est le délai de livraison, pas le code. Les séances factices permettent d'avancer sur tout le reste
pendant ce temps.

---

## Sujet 10 — Règles UX de saisie ✅ *(décidé le 2026-08-14)*

**Ces règles valent pour tous les écrans de l'application, pas seulement pour la saisie d'une séance.**
Elles ont été établies par une revue des recommandations publiées (Nielsen Norman Group, Baymard
Institute, Luke Wroblewski) et des pratiques des applications de log d'entraînement de référence.
Un écran qui s'en écarte doit dire pourquoi.

### 1. Clavier numérique sans `<input type="number">`

Tout champ chiffré est un `type="text"` portant `inputmode="numeric"`.

Le type natif `number` a des flèches d'incrément trop petites pour le pouce et accepte des saisies
qu'il marque « invalides » selon sa propre logique, pas la nôtre. `inputmode` ne change pas le champ,
il change le clavier que le système remonte — c'est tout ce qu'on veut.

### 2. Le stepper se mérite

Un stepper (– / +) n'est justifié que si le champ a **une valeur habituelle** autour de laquelle
l'utilisateur fait de petits ajustements *(NN/G)*. Il échange de la précision contre de la vitesse :
le marché n'est bon que si l'écart au défaut reste petit.

| Champ | Valeur habituelle | Forme retenue |
|---|---|---|
| Durée | oui, ~45 min par pas de 5 | **stepper hybride** — valeur pré-remplie et tapable au clavier |
| Puissance | non | champ au clavier |
| FC | non | champ au clavier |

Sur mobile, les boutons – et + se placent **horizontalement** de part et d'autre de la valeur
(verticalement, le pouce se trompe de cible), avec une zone tactile d'au moins **48 dp**.

### 3. Hiérarchie visuelle plutôt que mention « optionnel »

**Écart assumé par rapport à la règle publiée.** Baymard et NN/G recommandent de marquer explicitement
les champs obligatoires *et* optionnels. Cette règle vient des tunnels de commande, où l'optionnel est
l'exception : marquer 3 champs sur 15 informe. Nos écrans sont inverses — 1 champ obligatoire, 3
optionnels — et le mot répété trois fois sur quatre lignes serait du bruit.

La forme porte donc le message : le champ obligatoire occupe le haut, seul et en grand ; les optionnels
sont visuellement en retrait dessous, séparés par un filet.

En revanche, la conclusion de fond de Baymard est retenue sans réserve : **le levier n'est pas le
marquage, c'est le nombre de champs.** Tout ajout de champ se justifie contre cette règle.

### 4. Valider à la sortie du champ — « reward early, punish late »

La validation se déclenche au `blur`, jamais pendant la frappe. Valider à chaque caractère revient à
afficher « FC trop basse » pendant que l'utilisateur tape le premier chiffre de 130.

**Exception, et c'est le cœur de la règle :** un champ **déjà en erreur** repasse en validation à la
frappe, pour que l'erreur disparaisse dès qu'elle est corrigée. L'erreur arrive tard, sa levée arrive tôt.

**Précision du 2026-08-21, après un défaut trouvé sur l'appareil.** « Repasser en validation à la frappe »
n'autorise qu'à **éteindre** une erreur, jamais à en allumer une. Les deux sens sont deux mécanismes
distincts, et les confondre suffit à retourner la règle contre elle-même :

| Événement | Peut allumer | Peut éteindre |
| --- | --- | --- |
| Sortie du champ (`blur`) | oui | oui |
| Frappe | **non** | oui |
| Tentative d'enregistrement | oui | oui |

Le piège concret, pour ne pas le refaire : le mode `onTouched` de React Hook Form *paraît* implémenter la
règle, mais il retient que le champ a déjà été quitté une fois et valide ensuite à **chaque** frappe.
Résultat, dès la deuxième visite dans le champ, « FC trop basse » s'affiche sur le `12` de `125` — la
sanction pendant la frappe, précisément ce que la règle interdit, avec en prime un comportement qui
dépend de l'historique de l'écran. La combinaison correcte est `mode: 'onBlur'` **et**
`reValidateMode: 'onBlur'` — le défaut du second rétablit le défaut dès la première tentative
d'enregistrement — l'extinction étant faite à la main, en vérifiant la seule borne du champ modifié.

Mesures de Luke Wroblewski, validation en ligne contre validation à la soumission : **−22 % d'erreurs,
−42 % de temps de saisie**, satisfaction en hausse.

### 5. Zone du pouce

L'action principale est en bas de l'écran, pleine largeur. Une main tenant un S22 atteint confortablement
le tiers inférieur ; le haut demande de repositionner l'appareil. L'information importante se **lit** en
haut, l'action s'**atteint** en bas.

**Corollaire clavier :** cette zone est la première que le clavier virtuel recouvre. La barre d'action
est donc `position: sticky; bottom: 0` et se relève de `env(keyboard-inset-height)`. La WebView
Capacitor se redimensionne avec le clavier (`adjustResize`), ce qui rend le procédé valide en natif —
**à vérifier sur l'APK**, une maquette en iframe ne peut pas le démontrer. Repli acceptable si l'écran
natif se comporte autrement : fermer le clavier avant d'enregistrer, soit un geste de plus, que seule
la séance complète paie — la séance minimale n'ouvre jamais le clavier *(règle 6)*.

### 6. Critère d'acceptance chiffré : le nombre de gestes

L'étalon n'est pas l'esthétique, c'est le nombre d'interactions. Hevy, référence du log de séance,
enregistre une série en deux taps, avec un principe directeur explicite : l'application doit être assez
rapide pour être remplie entre deux séries.

| Cas | Budget |
|---|---|
| Séance minimale (durée seule) | **≤ 3 gestes** |
| Séance complète (durée + watts + FC) | **≤ 10 gestes** |

Un écran qui dépasse son budget est refusé, quelle que soit son allure.

### 7. L'information est présentée au moment où elle est actionnable

Le motif d'abord, la règle ensuite.

**Motif :** l'erreur coûteuse n'est pas la saisie invalide — les bornes du schéma l'attrapent — c'est
la saisie **plausible mais fausse** (45 W au lieu de 145). Aucune validation ne peut la détecter. Seul
l'utilisateur le peut, et seulement s'il voit ce qu'il vient d'écrire, à un instant où il peut encore
le corriger.

**Règle :** l'écriture renvoie sur l'écran où la donnée créée est **visible**, avec une annulation à
portée de pouce. Après l'enregistrement d'une séance : retour à l'accueil, la séance en tête de
l'historique, bouton *Annuler*. C'est le motif du choix A contre un retour sur formulaire vide, qui
masquerait l'erreur au moment précis où elle est encore fraîche.

**Corollaire — on n'affiche pas ce sur quoi l'utilisateur ne peut pas agir.** Une première version de
cette règle imposait aussi d'annoncer *avant* l'action toute valeur décidée par l'application, d'où une
ligne `SERA HORODATÉE · AUJOURD'HUI 18:32` au-dessus du bouton d'enregistrement. Abandonnée : il n'y a
pas de champ date *(sujet 9)*, donc cette ligne signale un problème qu'elle ne donne aucun moyen de
corriger — et la date est de toute façon lisible sur l'écran d'après, là où *Annuler* la rend
actionnable. Une information non actionnable est du bruit, quelle que soit sa justesse.

L'annulation s'appuie sur le `deletedAt` du modèle *(sujet 4)* : rien n'est effacé, même annulé.

### 8. L'enchaînement des champs se pilote au clavier, l'automatisme se mérite

*(arbitré le 2026-08-21, après essai sur l'appareil)*

**La touche d'action du clavier avance d'un champ.** `enterKeyHint` ne change que le *dessin* de la touche
— « suivant », « OK » — jamais son comportement : dans un formulaire à bouton unique, Entrée soumet. Il faut
donc intercepter la touche et déplacer le focus soi-même, sans quoi la touche « suivant » enregistre la
séance. C'est le chemin d'avancement principal : il est explicite, il est déjà sous le pouce, il ne devine
rien.

**L'avancement automatique n'est permis que si la longueur maximale du champ est certaine.** Le test est
arithmétique, pas esthétique :

| Seuil de bascule | Puissance à 3 chiffres (145 W) | Puissance à 2 chiffres (95 W) |
|---|---|---|
| 2 chiffres | ✗ le troisième chiffre part dans le champ suivant | ✓ |
| **3 chiffres** | ✓ un geste économisé | ✓ un tap, comme avant — aucune régression |

La bascule à trois chiffres est donc retenue **pour la puissance seule**, et la borne du schéma est descendue
de 1000 à 999 W pour que le modèle décrive ce que la saisie permet réellement. Le cas fréquent gagne, le cas
rare ne perd rien : c'est cette asymétrie qui justifie l'automatisme, pas le gain moyen.

**Là où on ne l'applique pas :** la durée (souvent deux chiffres, et une bascule depuis le champ principal
surprend), et la FC (dernier champ — il n'y a rien après, et refermer le clavier sous les doigts est plus
intrusif qu'utile).

**Ce qui reste interdit :** l'avancement automatique sur un champ de longueur variable. Le geste économisé
serait repayé en corrections, et une correction coûte plus cher qu'un tap.

---

## Sujet 11 — Chemin des données live ✅ *(décidé le 2026-08-28)*

**Question :** pendant une séance avec la ceinture, les battements arrivent dans le service Kotlin.
Où atterrissent-ils, et comment l'écran affiche-t-il la fréquence cardiaque en direct ?

### Deux chemins distincts, jamais confondus

```
capteur → SDK Polar → service Kotlin
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
   AFFICHAGE                           CONSERVATION
   événement → React                   journal append-only
   quelques ms                         ne dépend jamais du JS
   écran allumé seulement              tourne écran verrouillé
        │                                   │
   écran live                          à la fin : import dans Dexie
```

**La base n'est jamais dans le chemin de l'affichage.** Écrire pour ensuite relire afin d'afficher
ajouterait un aller-retour disque à chaque battement, sans rien apporter. Le service pousse la valeur
vers React directement. La réactivité de l'écran live est donc **indépendante du choix de stockage**.

### Décision — le service écrit un journal, le JavaScript l'importe à la fin

Pendant la séance, l'écriture est **100 % native**. Ce n'est pas un choix : la WebView est gelée environ
5 min après le verrouillage de l'écran (sujet 2 bis), donc tout chemin d'écriture passant par le JS
perdrait la séance entière.

À la fin, le JavaScript importe le journal dans Dexie. Ce n'est pas un flux de 14 400 écritures qui
traverse le pont, c'est **une opération unique sur un fichier déjà complet et déjà sauvé**.

Pourquoi ce découpage :

- **Dexie reste la source de vérité unique** de l'application. La synchronisation Supabase future part
  d'un seul endroit, et tous les écrans lisent au même endroit.
- **Append-only** : une ligne déjà écrite ne peut pas être corrompue par ce qui suit. C'est ce que font
  les enregistreurs, et pour cette raison précise.
- **Vidage à chaque ligne** — un tampon non vidé emporte dans la tombe les dernières secondes.
- **Le mécanisme est déjà prouvé** : c'est exactement ce que fait `survie.log` dans le PoC de survie.

### Le seul point fragile — l'import doit être rejouable

Le transfert fichier → base est le seul moment où la donnée existe à deux endroits. Trois règles :

- le fichier n'est supprimé **qu'après** confirmation de l'écriture en base ;
- rejouer l'import deux fois ne crée pas de doublon (identifiant de séance déterministe) ;
- tant que le fichier existe, rien n'est perdu — même si l'application n'est rouverte que trois jours plus tard.

C'est plus sûr que d'écrire en base au fil de l'eau, où un arrêt brutal au mauvais moment laisse une
transaction ouverte.

### Options écartées

**B — une base SQLite partagée entre le natif et le JavaScript.** Écartée sur un fait technique :
SQLite n'accepte qu'une connexion, et deux connexions qui écrivent en concurrence ont une très forte
probabilité de corrompre la base. Contradiction frontale avec la règle « la donnée ne doit jamais être
perdue ». S'y ajoute le coût de migration de toute la couche Dexie existante.

**C — tout en natif (Room), le JavaScript ne faisant que lire via le pont.** Écartée : jette une couche
de données qui fonctionne, et fait passer chaque écran par le pont sans raison. La séance en cours est
le seul flux qui a besoin du natif ; le reste de l'application n'en a aucun besoin.

### Deux conséquences à instruire à l'étape 2

**Le modèle de données.** La série de battements (~14 400 points pour 4 h) n'existe pas dans le modèle du
sujet 4. Table séparée indexée par l'`id` de séance, ou champ de `Session` : non tranché ici.

**L'alerte de sortie de zone.** « Contrôler la FC en live » inclut l'alerte quand on sort de la zone 2.
Si elle doit fonctionner **téléphone en poche, écran verrouillé**, elle relève du service natif — le JS
ne tourne pas. Cela ne change rien au stockage, mais ajoute une responsabilité au service.

---


## Qualité « portfolio » — les 4 axes validés

1. **Moteur de métriques testé** — module TypeScript pur : EF, découplage, comparaisons glissantes.
   Tests sur séries réalistes. *L'axe le plus fort pour un profil data engineer.*
2. **CI GitHub Actions** — lint + typecheck + tests à chaque push, APK en artefact de release
3. **README + ADR + captures** — GIF de l'app, problème, arbitrages. ADR datés sur les décisions structurantes
4. **Qualité visuelle** — *seul axe à coût potentiellement infini, à borner explicitement*

---

## Anti-périmètre — décisions de refus assumées

- Pas de rétro-ingénierie du protocole Technogym
- Pas de CRDT ni de résolution de conflits sophistiquée
- Pas de backend multi-tenant, d'auth tierce ou de fonctions sociales
- Pas de base de connaissances métier séparée — le métier vit dans `docs/domain/zone2.md`, une page
- Pas de graphiques dérivés tant qu'ils ne disent rien statistiquement
