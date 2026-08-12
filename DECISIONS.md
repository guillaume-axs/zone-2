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

**Champs du formulaire** — un seul obligatoire :

| Champ | Statut |
|---|---|
| Date & heure | pré-rempli « maintenant », modifiable |
| Durée (min) | **obligatoire** |
| Puissance moyenne (W) | optionnel — lue sur la console du vélo |
| FC moyenne (bpm) | optionnel |
| Distance (km) | optionnel |
| RPE 1–10 | optionnel |
| Contexte (3 tags) | optionnel — salle chaude / fatigué / jambes lourdes |
| Note | optionnel |

Une séance sans FC ni watts s'enregistre quand même : elle compte dans le volume, elle n'apparaît pas dans la courbe d'EF.

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
   └─ l'écrit directement en base
       └─ le JavaScript ne tourne PAS pendant la séance
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
enregistre de son côté. *À vérifier avant achat : la relecture de cette mémoire par une app tierce.*

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

**Polices**

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
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
