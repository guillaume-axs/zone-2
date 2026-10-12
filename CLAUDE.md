# Zone 2

Application d'entraînement en zone 2 sur vélo de salle. Capacitor + React + TypeScript + Vite,
livrée en APK Android. Local-first : elle fonctionne intégralement hors ligne.

**Étape 1** — saisie manuelle des séances et suivi de progression.
**Étape 2** — capture de la fréquence cardiaque en direct via ceinture BLE (Polar H10).

---

## `DECISIONS.md` fait foi

Toutes les décisions de cadrage y sont écrites, datées et motivées. **Un sujet tranché ne se
re-débat pas.** Avant toute proposition d'architecture, de bibliothèque ou d'écran : ouvrir le
sujet concerné et vérifier ce qui est déjà décidé.

Un écart à une décision écrite est un arbitrage — il se soumet **avant**, jamais après coup.

### Verrous à connaître sans ouvrir le fichier

| Sujet | Ce qui est verrouillé |
|---|---|
| 2 | Capacitor + React + Vite · build par GitHub Actions · Supabase pour la pérennité · pas de CRDT |
| 2 bis | Le code natif Android est en **Kotlin** — plus une ligne de Java. Service de premier plan pour le BLE |
| 3 | Onglets en bas : Accueil / Historique / Réglages + bouton flottant central |
| 3 bis | **React Aria Components** (headless). Aucune bibliothèque de composants stylés |
| 4 | **Aucune valeur dérivée n'est stockée** — l'efficience se calcule à la lecture. `durationS` est le seul champ obligatoire |
| 7 | Fond quasi-noir, accent braise `#E8663D`, filets fins et **pas de cartes arrondies**, Space Grotesk + IBM Plex Mono |
| 7 bis | **Le mono nomme, le Grotesk donne la valeur, la braise agit** — six rôles typographiques ; le gris pâle `fg-4` sur un intitulé veut dire inactif ; un élément inactif garde sa place et son icône, jamais retiré |
| 8 | Dépôt **public** — rien d'identifiant n'y entre |
| 9 | Ordre : saisie → graphiques → BLE. Séances factices en attendant la ceinture, purgées par réinstallation |
| 11 | Données live : le service natif écrit un journal, le JS l'importe en base à la fin. L'affichage live ne passe **jamais** par la base |
| 18 | **Cap** : J0 saisir chaque séance · J1 capture live de la série FC · J2 synchro durable · J3 vitrine. **Gel jusqu'à J1** du banc, du polish et des règles. Le produit est un test conditionnel, pas un chantier |

---

## Où sont les choses

```
src/db/        Dexie — source de vérité locale (schema.ts, db.ts, sessions.ts)
src/metrics/   calculs purs et testés (efficience, bilan par fenêtre)
src/forms/     saisie de séance + validation
src/capteur/   la ligne Capteur cardio : signaux du greffon natif, état affiché (sujet 16)
src/ecrans/    écrans et gabarit des onglets — un fichier par route (App.tsx tient les routes)
src/styles/    tokens.css porte la charte du sujet 7
android/       code natif Kotlin (service de survie, greffon Capacitor)
DECISIONS.md   les décisions de cadrage
```

## Commandes

```
npm run dev      npm run lint      npm run test
npm run build    (tsc -b && vite build)
```

Le build de l'APK se fait **en CI uniquement** — pas d'Android Studio, pas de câble.
Une release `latest` est republiée à chaque push sur `main`.

---

## Contraintes absolues

- **La donnée ne doit jamais être perdue.** Toute suppression est logique (`deletedAt`), jamais physique.
- **Rien d'identifiant dans le dépôt** — il est public. Ni patronyme, ni chemin absolu, ni objectif
  personnel, ni capture d'écran contenant des données réelles. `.gitignore` n'a aucun effet rétroactif.
- **Zéro friction à l'usage.** L'application sert pendant l'effort, sur un vélo, avec les mains moites.

## Méthode de travail

- **Annoncer chaque étape avant de l'exécuter** sur une tâche longue. Ne jamais enchaîner en silence.
- **Étude UX avant toute maquette d'écran** : chercher en ligne les pratiques du marché, puis expliquer
  les règles retenues. Vaut pour chaque écran, sans exception. **Un écran à la fois** — benchmark,
  usage, maquette, validation. Jamais deux écrans dans la même passe.
- **Deux écrans du marché regardés avant de dessiner.** Regardés veut dire : l'image téléchargée et
  ouverte. Une page d'aide de l'éditeur est du texte, elle ne montre pas l'écran — elle ne compte pas.
  Où chercher, dans cet ordre : la fiche Play Store ou App Store de l'app (5 à 8 captures officielles),
  les bancs d'essai (DC Rainmaker, the5krunner, Tom's Guide), la version web de l'app via Claude dans
  Chrome. La maquette porte en tête un bloc `SOURCES` qui nomme, pour chaque écran, l'app, l'écran, le
  fichier de la capture, ce qu'on lui **garde** et ce qu'on lui **jette** avec le motif, et elle
  **affiche chaque capture en bas de planche** — une source qu'on ne voit pas oblige le PO à croire
  sur parole. Le hook `.claude/hooks/maquette-charte.py` refuse la publication sans ce bloc : la consigne écrite seule
  n'a pas suffi le 2026-09-26, la maquette de Zone cible a été inventée alors que la règle existait.
  Un écran sans équivalent sur le marché est un arbitrage à soumettre, pas une case à cocher.
- **Une maquette charge le CSS réel de l'application**, elle ne le recopie pas : `src/styles/tokens.css`
  et la feuille de l'écran existant le plus proche, publiés à côté de la page. `DECISIONS.md` donne les
  jetons, le CSS donne les **composants** — `.save` (carré, fond `--fg-hero`), `.field`, `.tag`,
  `.stepper`, `.label`. Une maquette bâtie sur les seuls jetons invente ses composants sans le voir :
  c'est arrivé le 2026-09-21, d'où le hook `.claude/hooks/maquette-charte.py` qui refuse une page
  écrivant la palette en dur. Un composant réellement nouveau se soumet comme arbitrage, jamais en douce.
- **Le vocabulaire visuel est relu, jamais deviné.** `.claude/hooks/inventaire.py` reconstruit à
  chaque démarrage de session et après chaque `/compact` la liste des classes CSS et des dessins
  SVG de `src/`, et l'injecte dans le contexte. Rien n'est écrit sur le disque : l'inventaire ne
  peut donc pas diverger du code. Il existe parce que la discipline n'a pas suffi — le 2026-09-26,
  le toast d'une maquette a été rebâti sans son anneau, et la marque ECG de l'application a été
  déclarée inexistante alors qu'elle vit dans `SessionForm.tsx`. **Reprendre un composant veut dire
  le reprendre entier**, sous-classes comprises.

- **Le banc d'essai passe avant le S22** (sujet 17). Un écran modifié ne part pas au PO tant que
  `npm run e2e` et l'émulateur CI ne sont pas verts. Le PO fait une seule passe, sur la liste des
  angles morts que la PR lui donne.
- **Un test qui échoue sans changement de code est un bug**, jamais une PR à relancer. On en cherche
  la cause dans ses traces, et la correction reçoit sa preuve : le même test, dix fois de suite. Le
  2026-10-11, un échec Maestro mis sur le dos de l'émulateur et relancé cachait un appui perdu par l'app.
  **Comparer d'abord un passage vert et un passage rouge**, trace contre trace : le même jour, des
  passages « verts » appuyaient déjà au mauvais endroit, et trois preuves ont été lancées pour rien.
  Après deux correctifs ratés, proposer un sous-agent de debug à contexte vide, nourri des faits bruts.

- **Chaque feature naît avec sa liste de critères** (sujet 17). Avant de coder : un tableau
  « Critère | Vérifié par » dans `## Critères` du plan de la branche, bâti depuis la demande,
  `DECISIONS.md` et les états fixes (vide, chargement, erreur, texte long, clavier, retour, hors
  ligne), **soumis au PO avec l'approche**. Chaque ligne reçoit un test, ou « angle mort — S22 ».
  Le tableau est recopié dans la PR ; le PO ne teste sur le S22 que les angles morts. Deux murs :
  `.claude/hooks/criteres.py` refuse d'éditer un écran sans ce tableau, le job `couverture`
  refuse une PR dont l'écran change sans parcours ou dont le tableau est vide. Un bug trouvé sur le
  S22 devient un critère et son test.
- **Chercher en ligne plutôt que dans sa mémoire** dès qu'il s'agit d'un standard, d'une version ou
  d'une pratique. L'état actuel du projet ne décide jamais d'une question d'architecture à sa place.
- **Un « go » couvre la chaîne mécanique** jusqu'à la livraison : commit, PR, CI, merge, publication.
  Mais **tout arbitrage l'interrompt** — deux options défendables, un écart à `DECISIONS.md`,
  un changement de périmètre.
- **Une session, un dossier.** Deux sessions travaillent souvent en parallèle : chacune crée son
  worktree (`git worktree add ../zone-2-<nom> -b <branche> origin/main`) et n'écrit jamais dans le
  dossier d'une autre. Le dossier `zone-2` principal appartient à la session qui l'occupe. Le
  2026-10-11, le banc et l'export-import ont avancé en même temps sans heurt grâce à ça — par
  chance, rien ne l'imposait.
  Le banc tourne alors sur un autre port : `PORT_BANC=5299 npm run e2e`. CI verte, la session range
  son dossier : `git worktree remove` **sans `--force`** (si git refuse, il reste du travail non
  commité : s'arrêter et demander), puis `gh pr merge --squash --delete-branch` merge et efface la branche.
- **Un changement de documentation seul ne se livre pas.** Il se commite localement tout de suite,
  et sa PR part groupée avec la feature suivante.
