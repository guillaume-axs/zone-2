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
| 8 | Dépôt **public** — rien d'identifiant n'y entre |
| 9 | Ordre : saisie → graphiques → BLE. Séances factices en attendant la ceinture, purgées par réinstallation |
| 11 | Données live : le service natif écrit un journal, le JS l'importe en base à la fin. L'affichage live ne passe **jamais** par la base |

---

## Où sont les choses

```
src/db/        Dexie — source de vérité locale (schema.ts, db.ts, sessions.ts)
src/metrics/   calculs purs et testés (efficience, bilan par fenêtre)
src/forms/     saisie de séance + validation
src/ecrans/    écrans et gabarit des onglets — un fichier par route (App.tsx tient les routes)
src/poc/       écran de diagnostic du PoC de survie — temporaire, partira avec le PoC
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
- **Une maquette charge le CSS réel de l'application**, elle ne le recopie pas : `src/styles/tokens.css`
  et la feuille de l'écran existant le plus proche, publiés à côté de la page. `DECISIONS.md` donne les
  jetons, le CSS donne les **composants** — `.save` (carré, fond `--fg-hero`), `.field`, `.tag`,
  `.stepper`, `.label`. Une maquette bâtie sur les seuls jetons invente ses composants sans le voir :
  c'est arrivé le 2026-09-21, d'où le hook `.claude/hooks/maquette-charte.py` qui refuse une page
  écrivant la palette en dur. Un composant réellement nouveau se soumet comme arbitrage, jamais en douce.
- **Chercher en ligne plutôt que dans sa mémoire** dès qu'il s'agit d'un standard, d'une version ou
  d'une pratique. L'état actuel du projet ne décide jamais d'une question d'architecture à sa place.
- **Un « go » couvre la chaîne mécanique** jusqu'à la livraison : commit, PR, CI, merge, publication.
  Mais **tout arbitrage l'interrompt** — deux options défendables, un écart à `DECISIONS.md`,
  un changement de périmètre.
- **Un changement de documentation seul ne se livre pas.** Il se commite localement tout de suite,
  et sa PR part groupée avec la feature suivante.
