# Itération 1 — Squelette jusqu'au téléphone

**Date :** 2026-08-11
**Objectif :** faire exister la chaîne complète *code → commit → APK → téléphone*, avec la charte graphique
et la persistance locale validées sur le vrai appareil.

## Pourquoi cette itération d'abord

Rien n'est utilisable tant que la chaîne de livraison n'existe pas. Les surprises se cachent dans le build
Android, pas dans le formulaire de saisie. On les affronte maintenant, sur un périmètre où le moindre échec
est facile à diagnostiquer.

## Critère de fin, vérifiable par le PO

1. Un `git push` produit un APK téléchargeable depuis GitHub Actions
2. L'APK s'installe sur le Galaxy S22
3. L'écran s'affiche avec les bonnes polices et les bonnes couleurs
4. Un appui sur le bouton n'y laisse **aucun état visuel collé** une fois le doigt retiré
5. Une séance factice écrite dans la base **survit à la fermeture complète de l'app**

## Hors périmètre (explicitement)

Formulaire de saisie réel · Supabase · synchronisation · outbox · BLE · graphiques · navigation par onglets ·
authentification · APK signé pour publication.

## Note sur les tests

Cette itération est du câblage d'infrastructure. Écrire des tests unitaires sur de la configuration de build
n'apporte rien — **le test, c'est l'APK qui s'installe et fonctionne**. Chaque étape porte donc un critère de
vérification manuel explicite. Les tests automatisés arrivent à l'itération 2, sur la logique métier (le module
de calcul EF), qui est là où ils ont de la valeur.

## Note de sécurité

Aucun secret n'est nécessaire à cette itération : pas de Supabase, pas d'API, pas de clé de signature de
release. Le `.gitignore` est néanmoins mis en place dès l'étape 1 pour que `.env.local` ne puisse jamais
être commité par la suite.

---

## Étape 0 — Prérequis de la machine

Constaté le 2026-08-11 : Node v24.14.0 présent, **Java absent**, **SDK Android absent**, `ANDROID_HOME`
non défini. Sans eux, l'étape 7 est impossible.

Android Studio n'est **pas** nécessaire — les outils en ligne de commande suffisent et pèsent bien moins lourd.

**Fait sans `sudo`** — tout est installé dans le home de l'utilisateur, rien n'a été touché au système.

- [x] JDK 21 Temurin depuis l'API Adoptium → `~/.jdks/jdk-21.0.12+8` *(197 Mo)*
- [x] *Command-line tools* Android (`15859902`) → `~/Android/Sdk/cmdline-tools/latest` *(182 Mo)*
      — extraits avec `python3 -m zipfile`, `unzip` étant absent
- [x] Bloc délimité ajouté à `~/.bashrc` : `JAVA_HOME`, `ANDROID_HOME`, `PATH`
- [x] `sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;36.0.0"`
- [x] Licences acceptées

**Vérifié le 2026-08-11 :** `java` 21.0.12 LTS · `build-tools/36.0.0` · `platforms/android-36` · `adb` 1.0.41

*Note : `sdkmanager` est annoncé comme déprécié au profit de la nouvelle Android CLI. Il fonctionne
toujours ; à surveiller si une mise à jour du SDK casse un jour.*

**Note WSL2 :** l'installation de l'APK sur le téléphone se fera par **transfert de fichier** (câble ou cloud),
pas par `adb` en USB — le passage d'un périphérique USB à WSL2 demande une configuration `usbipd` qui n'apporte
rien ici.

---

## Étape 1 — Dépôt et hygiène de base

- [x] `git init` à la racine du projet
- [x] Créer `.gitignore` :
  ```
  node_modules/
  dist/
  .env
  .env.local
  .DS_Store

  # Capacitor / Android
  android/app/build/
  android/build/
  android/.gradle/
  android/local.properties
  android/app/src/main/assets/public/
  android/app/src/main/res/xml/config.xml
  *.apk
  *.keystore
  ```
- [x] Créer `README.md` : titre, une phrase d'objectif, la pile technique, un renvoi vers `DECISIONS.md`
- [x] Créer la branche `main`, puis travailler sur `feat/squelette-android`
- [x] Commit : `chore: initialise le dépôt et le gitignore`

**Vérification :** `git status` ne liste aucun fichier indésirable.

---

## Étape 2 — Base Vite + React + TypeScript

- [x] `npm create vite@latest . -- --template react-ts` (dans le dossier existant)
- [x] `npm install`
- [x] Supprimer les fichiers de démonstration : `src/App.css`, `src/assets/react.svg`, `public/vite.svg`
- [x] Vider `src/index.css` de son contenu par défaut
- [x] Commit : `feat: initialise la base vite react typescript`

**Vérification :** `npm run dev` sert une page sans erreur en console.

---

## Étape 3 — Charte graphique

Reprendre le code de référence de `DECISIONS.md`, section « Code de référence — à reprendre tel quel ».

- [x] Dans `index.html`, ajouter dans le `<head>` le lien Google Fonts
      (Instrument Serif, Space Grotesk, IBM Plex Mono)
- [x] Créer `src/styles/tokens.css` avec les 10 jetons de couleur en variables CSS
      (`--bg`, `--fg-hero`, `--fg`, `--fg-2`, `--fg-3`, `--fg-4`, `--fg-5`, `--rule`, `--rule-2`, `--accent`)
- [x] Créer `src/styles/base.css` : reset minimal, `body` en `--bg`, familles de polices, la classe `.label`
- [x] Importer les deux feuilles dans `src/main.tsx`
- [x] Commit : `feat: applique la charte graphique`

**Vérification :** au navigateur, fond `#0C0C0E`, un titre en Instrument Serif, un label en IBM Plex Mono.

---

## Étape 4 — Persistance locale avec Dexie

On installe directement le **vrai** schéma du sujet 4 plutôt qu'une table jetable.

- [x] `npm install dexie dexie-react-hooks`
- [x] Créer `src/db/schema.ts` : le type TypeScript `Session` conforme au modèle
      (`id`, `startedAt`, `durationS` — seul champ obligatoire —, `avgPowerW`, `avgHrBpm`, `distanceM`,
      `rpe`, `notes`, `source`, `context`, `createdAt`, `updatedAt`, `deletedAt`)
- [x] Créer `src/db/db.ts` : la classe Dexie, base `zone2`, version 1, table `sessions` indexée sur
      `id, startedAt, deletedAt`
- [x] Commit : `feat: ajoute la base locale dexie`

**Vérification :** dans les outils de développement, onglet Application, la base `zone2` existe avec sa table.

---

## Étape 5 — Écran de preuve de vie

- [x] `npm install react-aria-components`
- [x] Remplacer `src/App.tsx` par un écran unique affichant :
  - un titre en Instrument Serif
  - le **nombre de séances en base**, lu en direct via `useLiveQuery`
  - un `<Button>` **de React Aria Components** libellé « Ajouter une séance factice », qui insère une
    `Session` avec `durationS: 3600` et les horodatages
- [x] Commit : `feat: ajoute l'ecran de preuve de vie`

**Vérification :** le compteur s'incrémente à chaque appui ; après un rechargement complet de la page,
le compteur conserve sa valeur.

---

## Étape 6 — Capacitor et plateforme Android

- [x] `npm install @capacitor/core @capacitor/cli`
- [x] `npx cap init "Zone 2" "fr.zone2.app" --web-dir dist`
      *(identifiant validé par le PO le 2026-08-11 — définitif après publication)*
- [x] `npm install @capacitor/android`
- [x] `npx cap add android`
- [x] Dans `android/variables.gradle`, vérifier `minSdkVersion = 24`, `compileSdkVersion = 36`,
      `targetSdkVersion = 36`
- [x] `npm run build && npx cap sync android`
- [x] Commit : `feat: ajoute capacitor et la plateforme android`

**Vérification :** le dossier `android/` existe et `dist/` a bien été copié dans les ressources Android.

---

## Étape 7 — Premier APK, construit localement

On valide le build **à la main avant** de l'automatiser : un échec en CI est bien plus pénible à diagnostiquer.

- [x] Vérifier le JDK : `java -version` doit annoncer 21
- [x] `cd android && ./gradlew assembleDebug`
- [x] Récupérer `android/app/build/outputs/apk/debug/app-debug.apk`
- [x] Le transférer sur le Galaxy S22 et l'installer (autoriser les sources inconnues)

**Vérification — c'est le premier vrai jalon :**
- l'app se lance
- les polices et couleurs sont correctes **sur l'écran du téléphone**
- l'appui sur le bouton ne laisse **aucun état visuel collé** (le critère React Aria)
- fermer l'app entièrement, la rouvrir : **le compteur a conservé sa valeur**

⚠️ Si l'un de ces points échoue, on s'arrête et on corrige ici. Pas de CI par-dessus une base cassée.

---

## Étape 8 — Build automatique en intégration continue

- [x] Créer `.github/workflows/build-apk.yml` :
  - déclencheur : `push` sur toute branche, et `workflow_dispatch`
  - `runs-on: ubuntu-latest`
  - `actions/checkout@v4`
  - `actions/setup-node@v4` avec `node-version: 24` et `cache: npm` *(aligné sur la machine locale)*
  - `actions/setup-java@v4` avec `distribution: temurin`, `java-version: 21`
  - `android-actions/setup-android@v3`
  - `npm ci` → `npm run build` → `npx cap sync android`
  - `cd android && ./gradlew assembleDebug`
  - `actions/upload-artifact@v4` sur le chemin de l'APK, rétention 30 jours
- [x] Commit : `ci: construit l'apk a chaque push`

**Vérification :** le workflow passe au vert et l'APK est téléchargeable depuis l'onglet Actions.

---

## Étape 9 — Publication sur GitHub

⚠️ **Action externe et irréversible — nécessite la validation explicite du PO.**

Validé par le PO le 2026-08-13, précédé d'un audit de sécurité complet (voir `DECISIONS.md`, sujet 8).

- [x] Créer le dépôt public `zone-2` sur GitHub → https://github.com/guillaume-axs/zone-2
- [x] `git remote add origin` puis pousser `main`
- [x] Vérifier que le workflow s'exécute — **vert au premier essai**, `secrets` 7 s puis `build` 1 min 54
- [x] Récupérer l'APK produit par la CI et vérifier son identifiant de paquet (`fr.zone2.app`)

*La PR depuis `feat/squelette-android` n'a pas eu lieu : le travail a été mené directement sur `main` avant
l'existence du dépôt distant, il n'y avait donc rien à fusionner. Le passage par branche + PR s'applique à
partir de l'itération 2.*

**Vérification :** l'APK produit par GitHub Actions, téléchargé depuis le dépôt distant, s'installe et
fonctionne sur le S22.

---

## Ce qui restera à décider pour l'itération 2

- Bibliothèque de graphiques (reportée à l'itération 4 — SVG écrit à la main recommandé)
- Rédaction de `docs/domain/zone2.md`
- Stratégie de synchronisation Supabase et file d'attente d'envoi
