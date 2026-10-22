# Liaison unique — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une seule liaison avec la ceinture dans toute l'app : les Réglages s'en servent sans
notification, le service de séance la reprend telle quelle et la garde jusqu'à la fin de la séance.

**Architecture :** `Relais` (Kotlin pur, sans Android) décide : qui tient la liaison, ce que fait
chaque événement selon le détenteur, et rend une liste d'`Ordre`. `Liaison` (objet Kotlin, un par
processus) exécute ces ordres : une seule `Ceinture`, un seul fil, un seul guet du silence et de la
radio. `CapteurPlugin` et `SeanceService` ne créent plus de `Ceinture` ; ils prennent, rendent ou
ferment la liaison. Même découpe qu'en JS, où `ligne.ts` (pur) décide et `useCapteur.ts` exécute.

**Tech Stack :** Kotlin, JUnit 4 sur la JVM, Capacitor 8.

**Spec :** `DECISIONS.md`, amendement du 2026-10-22 (« Une seule liaison avec la ceinture dans
toute l'app ») ; `docs/superpowers/specs/2026-10-19-j1-capture-live-design.md` (A2, Q1, critères
1 à 3) ; sujet 16 et son complément du 2026-10-10 (silence et Bluetooth coupé).

## Global Constraints

- **Aucun écran ne change**, aucun fichier de `src/` non plus. Banc (`PORT_BANC=5299 npm run e2e`)
  et Maestro CI verts **sans y toucher**.
- Format du journal inchangé : `JournalTest` vert sans modification ; `MUETTE` s'y écrit toujours
  sous ce nom.
- Signaux JS du greffon `Capteur` inchangés : `etat` (nom d'état + `nom`) et `fc` (`bpm`). Il
  n'émet jamais `MUETTE` (le zod de `ligne.ts` ne le connaît pas).
- Pas de notification hors séance (sujet 16) : la liaison des Réglages ne passe jamais par le service.
- Tout l'état de `Liaison` et de `Relais` ne se lit et ne s'écrit que sur `Liaison.fil`.
- Seuil du silence : `Journal.SILENCE_MS` (5 000 ms), seule définition ; celle de `CapteurPlugin`
  disparaît.
- Tests natifs : `cd android && ./gradlew testProdDebugUnitTest --no-daemon` (le SDK est installé en local).

## Le relais, règle par règle

La table que `Relais` applique. `R` = Réglages, `S` = service de séance, `—` = personne.

| Événement | Détenteur `R` | Détenteur `S` | Détenteur `—` |
|---|---|---|---|
| `prendre(R)` | relance une recherche (comme aujourd'hui) | **refusé** : la séance garde la liaison | lance une recherche |
| `prendre(S)` | **reprise telle quelle** : ni arrêt, ni recherche ; l'état courant est signalé à `S` | rien ne repart ; l'état courant est re-signalé | lance une recherche |
| `rendre()` (Démarrer quitté sans démarrer) | — | connectée : rendue à `R`, qui reçoit `CONNECTEE` ; sinon coupée, `R` reçoit `DECROCHEE` | — |
| `fermer(par)` | coupée si `par == R` | coupée si `par == S` | rien |
| silence 5 s | coupée, `DECROCHEE` | `MUETTE`, **liaison gardée** | — |
| battement porté | relance le guet | relance le guet ; `MUETTE` → `CONNECTEE` | — |
| `DECROCHEE`, `INTROUVABLE`, `ECHEC` de la ceinture | coupée, signalé | signalé ; la ceinture se reconnecte seule | — |
| radio coupée | coupée, `DECROCHEE` | arrêtée, `DECROCHEE`, détenteur gardé | — |
| radio revenue | — | relance si la radio l'avait arrêtée | — |
| app quittée | coupée, `DECROCHEE`, adresse gardée | rien | — |

Seule ligne nouvelle sur le fond : `rendre()`. Les autres reprennent ce que faisaient déjà les deux
copies, chacune dans son rôle.

## Review Focus

1. **Activité recréée** (rotation, retour du fond) pendant que `S` tient la liaison : le nouveau
   `CapteurPlugin` s'inscrit, son `handleOnStop` ne doit rien couper. → test `appQuittee sous S ne coupe rien`.
2. **Service tué par Android puis relancé** : processus neuf, `Liaison` vide ; `reprendre` doit
   relancer une recherche. → test `prendre S sans détenteur lance`.
3. **Radio coupée puis rallumée avant la fin du `DECROCHEE`** sous `S` : une seule relance, pas
   deux ceintures. → test `radio revenue deux fois ne relance qu'une fois`.
4. **Bascule de la reconnexion en cours de route** : la `Ceinture` lit `reconnecter()` à chaque
   décision, jamais une valeur figée à sa création. → test `reconnecte suit le détenteur`.
5. **Battement arrivé après une coupure** : ignoré, aucun ordre. → test `battement sans détenteur ne fait rien`.

---

## Standard Android

Aucun écran ne change. Le standard touché est celui des permissions et de la radio.

| Ce que le standard impose | Source | Appliqué ici |
|---|---|---|
| `BLUETOOTH_SCAN` et `BLUETOOTH_CONNECT` sont des permissions d'exécution depuis Android 12 | skill `android-permissions-security`, `references/android/training/permissions/requesting.md` | les deux greffons les demandent avant toute recherche (déjà vrai) |
| Refus définitif : renvoyer vers `Settings.ACTION_APPLICATION_DETAILS_SETTINGS` | même skill, SKILL.md l. 69 et 582 | `SeancePlugin.ecouter` fait désormais comme `CapteurPlugin.connecter` |
| Bluetooth éteint : la demande système `BluetoothAdapter.ACTION_REQUEST_ENABLE`, pas `enable()` (déprécié depuis l'API 33) | developer.android.com, `BluetoothAdapter#enable` | `SeancePlugin.ecouter` la pose, comme `CapteurPlugin` |
| Un récepteur interne à l'app est `RECEIVER_NOT_EXPORTED` | même skill, section IPC | le seul récepteur de radio, dans `Liaison` |
| Un service de premier plan qui tient un appareil est du type `connectedDevice` | déjà en place (PoC étages 1 et 2) | inchangé |

## Critères

| # | Critère | Vérifié par |
|---|---|---|
| 1 | Réglages : Connecter trouve la ceinture et affiche la FC | banc `e2e/` existant + Maestro `reglages.yaml` (inchangés) ; S22 (le fil a changé) |
| 2 | Réglages : ceinture muette 5 s → la ligne revient à « Connecter » | JUnit `silence sous R coupe et annonce DECROCHEE` ; S22 |
| 3 | Réglages : Bluetooth coupé → « Connecter » | JUnit `radio coupée sous R coupe` ; S22 |
| 4 | Réglages : quitter l'app coupe la liaison, l'adresse reste | JUnit `appQuittee sous R coupe` ; S22 (reconnexion au même capteur) |
| 5 | Démarrer reprend une ceinture déjà connectée, sans recherche ni seconde liaison | JUnit `prendre S depuis R ne lance ni n'arrête` ; sur le téléphone : avec la PR Démarrer |
| 6 | Séance : muette 5 s → `MUETTE`, liaison gardée ; un battement la rend `CONNECTEE` | JUnit `silence sous S signale MUETTE`, `battement après MUETTE` |
| 7 | Séance : Bluetooth coupé puis rallumé → la recherche repart seule | JUnit `radio coupée puis revenue sous S relance` |
| 8 | Séance : quitter l'app ne coupe rien | JUnit `appQuittee sous S ne coupe rien` |
| 9 | Démarrer quitté sans démarrer : connectée → rendue aux Réglages ; sinon coupée | JUnit `rendre connectée`, `rendre muette coupe` |
| 10 | Les Réglages ne touchent pas une liaison tenue par la séance | JUnit `prendre R sous S refusé`, `fermer R sous S ne fait rien` |
| 11 | Côté séance, l'état part avec le nom du capteur | revue ; sur le téléphone : avec la PR Démarrer |
| 12 | `ecouter` : refus définitif → page de l'app dans les paramètres ; Bluetooth éteint → demande d'allumer | revue ; sur le téléphone : avec la PR Démarrer (aucun écran n'appelle encore `ecouter`) |
| 13 | Journal et signaux JS inchangés | `JournalTest`, `BattementTest`, `npm test`, banc, Maestro CI |

**Angle mort de cette PR, à dire au PO :** la moitié « séance » (5 à 12) n'a aucun écran pour la
déclencher avant la PR Démarrer. Elle n'est prouvée ici que par JUnit et par la compilation ; sa
preuve sur le téléphone arrive avec Démarrer. La passe S22 de cette PR ne porte que sur 1 à 4.

---

### Task 1 : `Relais`, la décision pure

**Files :**
- Create : `android/app/src/main/java/fr/zone2/app/Relais.kt`
- Modify : `android/app/src/main/java/fr/zone2/app/Ceinture.kt` (enum `Etat` : ajout de `MUETTE`)
- Test : `android/app/src/test/java/fr/zone2/app/RelaisTest.kt`

**Interfaces :**
- Produces :
  ```kotlin
  class Relais {
      enum class Detenteur { REGLAGES, SEANCE }
      sealed interface Ordre {
          data object Lancer : Ordre            // nouvelle Ceinture, demarrer()
          data object Arreter : Ordre           // ceinture.arreter(), sans rappel
          data object ArmerSilence : Ordre      // (ré)arme le délai de Journal.SILENCE_MS
          data object DesarmerSilence : Ordre
          data class Signaler(val pour: Detenteur, val etat: Ceinture.Etat) : Ordre
      }
      var detenteur: Detenteur?            // private set
      var etat: Ceinture.Etat?             // private set — dernier état connu de la liaison
      val reconnecte: Boolean              // detenteur == SEANCE
      fun prendre(par: Detenteur): List<Ordre>   // liste vide + detenteur inchangé = refus
      fun rendre(): List<Ordre>
      fun fermer(par: Detenteur): List<Ordre>
      fun etatCeinture(e: Ceinture.Etat): List<Ordre>
      fun battementPorte(): List<Ordre>
      fun silence(): List<Ordre>
      fun radio(allumee: Boolean): List<Ordre>
      fun appQuittee(): List<Ordre>
  }
  ```
  `Ceinture.Etat.MUETTE` : documenté « émis par `Liaison`, jamais par `Ceinture` ».

- [ ] **Step 1 : écrire `RelaisTest`** — un test par ligne de la table « Le relais » et du Review
  Focus, assertions sur la liste exacte d'ordres et sur `detenteur`. Les cas qui portent le fond :

```kotlin
@Test fun `prendre S depuis R ne lance ni n'arrête`() {
    val r = Relais(); r.prendre(R); r.etatCeinture(CONNECTEE)
    assertEquals(listOf(Signaler(S, CONNECTEE)), r.prendre(S))
    assertEquals(S, r.detenteur); assertTrue(r.reconnecte)
}
@Test fun `prendre R sous S refusé`() {
    val r = Relais(); r.prendre(S)
    assertEquals(emptyList<Ordre>(), r.prendre(R)); assertEquals(S, r.detenteur)
}
@Test fun `silence sous R coupe et annonce DECROCHEE`() {
    val r = Relais(); r.prendre(R); r.etatCeinture(CONNECTEE)
    assertEquals(listOf(Arreter, Signaler(R, DECROCHEE)), r.silence()); assertNull(r.detenteur)
}
@Test fun `silence sous S signale MUETTE`() {
    val r = Relais(); r.prendre(S); r.etatCeinture(CONNECTEE)
    assertEquals(listOf(Signaler(S, MUETTE)), r.silence()); assertEquals(S, r.detenteur)
}
@Test fun `battement après MUETTE`() {   // → [Signaler(S, CONNECTEE), ArmerSilence]
@Test fun `rendre connectée`() {          // S, CONNECTEE → [Signaler(R, CONNECTEE)], detenteur R, reconnecte false
@Test fun `rendre muette coupe`() {       // S, MUETTE → [DesarmerSilence, Arreter, Signaler(R, DECROCHEE)], detenteur null
@Test fun `radio coupée puis revenue sous S relance`()  // false → [DesarmerSilence, Arreter, Signaler(S, DECROCHEE)] ; true → [Lancer]
@Test fun `radio revenue deux fois ne relance qu'une fois`()
@Test fun `appQuittee sous S ne coupe rien`()          // → []
@Test fun `appQuittee sous R coupe`()                  // → [DesarmerSilence, Arreter, Signaler(R, DECROCHEE)]
@Test fun `battement sans détenteur ne fait rien`()    // → []
@Test fun `reconnecte suit le détenteur`()             // R false → prendre(S) true → rendre() false
```

- [ ] **Step 2 :** `cd android && ./gradlew testProdDebugUnitTest --tests fr.zone2.app.RelaisTest --no-daemon` → FAIL (classe absente).
- [ ] **Step 3 : écrire `Relais`** selon la table. Sous `R`, `DECROCHEE`/`INTROUVABLE`/`ECHEC`
  libèrent le détenteur (la ceinture des Réglages ne se reconnecte pas) ; sous `S`, ils sont
  seulement signalés. `CONNECTEE` arme le silence, `RECHERCHE`/`TROUVEE` le désarment. Aucun import
  `android.*`.
- [ ] **Step 4 :** même commande → PASS ; `JournalTest` et `BattementTest` toujours verts.
- [ ] **Step 5 : commit** `feat(liaison): relais pur, une liaison et son détenteur`

### Task 2 : `Liaison` et la ligne des Réglages

**Files :**
- Create : `android/app/src/main/java/fr/zone2/app/Liaison.kt`
- Modify : `Ceinture.kt` (`reconnecter: () -> Boolean` au lieu d'un `Boolean`), `CapteurPlugin.kt`

**Interfaces :**
- Consumes : `Relais` (Task 1).
- Produces :
  ```kotlin
  object Liaison {
      val fil: Handler                           // HandlerThread "liaison", démarré une fois, vit avec le processus
      val nom: String?                           // le nom de la ceinture courante
      fun ecouteur(pour: Relais.Detenteur, e: Ecouteur?)   // null désinscrit
      fun prendre(context: Context, par: Relais.Detenteur, rappel: (Boolean) -> Unit)
      fun rendre()
      fun fermer(par: Relais.Detenteur)
      fun oublier(par: Relais.Detenteur)         // efface l'adresse, seulement si `par` détient
      fun appQuittee()
      fun radioAllumee(context: Context): Boolean
      fun ouvrirParametres(activity: Activity)   // ACTION_APPLICATION_DETAILS_SETTINGS
  }
  interface Ecouteur {
      fun etat(e: Ceinture.Etat, nom: String?)
      fun battement(b: Battement)               // tous, portés ou non : le service journalise tout
  }
  ```
  Chaque méthode publique poste sur `fil`. Le récepteur de radio (`ACTION_STATE_CHANGED`,
  `RECEIVER_NOT_EXPORTED`) est inscrit une fois, sur `applicationContext`, au premier `prendre`.

- [ ] **Step 1 : écrire `Liaison`** : un `Relais`, une `Ceinture?`, un `Runnable` de silence posté
  sur `fil` avec `Journal.SILENCE_MS`. Une seule fonction `executer(ordres)` traduit les ordres ;
  `Signaler` appelle `ecouteurs[pour]?.etat(e, nom)`. Un battement va à `ecouteurs[detenteur]`, et
  passe par `relais.battementPorte()` s'il est porté.
- [ ] **Step 2 : rebrancher `CapteurPlugin`.** Il s'inscrit comme écouteur `REGLAGES` dans `load()`
  et se désinscrit dans `handleOnDestroy()` (seulement si c'est encore lui) ; `lancer` →
  `Liaison.prendre(REGLAGES)`, `lance` = la réponse ; `annuler` → `fermer(REGLAGES)` ;
  `deconnecter` → `oublier` puis `fermer` ; `handleOnStop` → `appQuittee()`. Il filtre les
  battements non portés, comme aujourd'hui. **Supprimer** son `silence`, son récepteur `radio`,
  `decrocher`, `couper`, `guetter`, `SILENCE_MS`. `adaptateur()` et l'ouverture des paramètres
  passent par `Liaison`.
- [ ] **Step 3 :** `./gradlew testProdDebugUnitTest assembleProdDebug --no-daemon` → vert ; `npm run lint && npm test` → vert.
- [ ] **Step 4 :** `PORT_BANC=5299 npm run e2e` → vert, sans fichier `e2e/` modifié.
- [ ] **Step 5 : commit** `refactor(capteur): la ligne des Réglages passe par Liaison`

### Task 3 : le service et son greffon passent par `Liaison`

**Files :**
- Modify : `SeanceService.kt`, `SeancePlugin.kt`

**Interfaces :**
- Consumes : `Liaison` (Task 2).

- [ ] **Step 1 : `SeanceService`.** `handler` devient `Liaison.fil` : plus de `HandlerThread` propre,
  et `onDestroy` ne quitte plus aucun fil. Le service s'inscrit écouteur `SEANCE` dans `onCreate`,
  se désinscrit dans `onDestroy`, après `Liaison.fermer(SEANCE)`. `demarrerCeinture()` →
  `Liaison.prendre(this, SEANCE)` ; `ACTION_LACHER` sans séance → `Liaison.rendre()` puis
  `stopSelf()` ; `terminer` → `Liaison.fermer(SEANCE)`. **Supprimer** `ceinture`, `silence`,
  `guetter`, `couperCeinture`, le récepteur `radio`. `etat` devient un `Ceinture.Etat` (plus de
  chaînes, `MUETTE` en fait partie) ; `Journal.liaison` reçoit `e.name`. Le signal JS `etat`
  porte désormais `nom` (`Liaison.nom`).
- [ ] **Step 2 : `SeancePlugin.ecouter`**, même parcours que `CapteurPlugin.connecter` après la
  permission des notifications : Bluetooth `DENIED` → `Liaison.ouvrirParametres`, `lance:false` ;
  radio éteinte → `ACTION_REQUEST_ENABLE` (`@ActivityCallback`), refus → `lance:false` ; sinon
  `lancer`.
- [ ] **Step 3 :** `./gradlew testProdDebugUnitTest assembleProdDebug --no-daemon`, `npm run lint && npm test`,
  `PORT_BANC=5299 npm run e2e` → verts.
- [ ] **Step 4 : commit** `refactor(seance): le service reprend la liaison des Réglages`

### Task 4 : documentation et PR

**Files :**
- Modify : `docs/superpowers/specs/2026-10-19-j1-capture-live-design.md` — ligne « Qui tient la
  ceinture pendant la séance » (→ « Une seule liaison, prise par le service à l'ouverture de
  Démarrer, gardée jusqu'à la fin ») et « Livraison — trois PR » (→ quatre : la refonte, Démarrer,
  effort ; Démarrer et effort mergées ensemble).
- Modify : en-têtes KDoc de `CapteurPlugin`, `SeanceService`, `Ceinture` (« seul détenteur de la
  ceinture », « la liaison vit ici ») pour dire la nouvelle répartition.

- [ ] **Step 1 :** éditer, puis relecture finale de la branche par un sous-agent Opus.
- [ ] **Step 2 : commit** `docs(j1): une liaison, quatre PR`
- [ ] **Step 3 :** PR avec le tableau `## Critères` et l'angle mort ci-dessus ; CI verte ; merge.
  La passe S22 du PO : critères 1 à 4.
