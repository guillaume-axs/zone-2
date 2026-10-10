# Banc d'essai — Claude teste seul avant le S22

> **Pour un exécutant automatisé :** ce plan se déroule tâche par tâche, chaque étape cochée après
> vérification. Les étapes utilisent la syntaxe `- [ ]` pour le suivi. Annoncer chaque tâche avant
> de l'exécuter.

**Date :** 2026-10-10
**Objectif :** sortir le PO de la boucle de découverte. Aujourd'hui, chaque feature coûte 2 à 3 PR
« retours terrain » (#15→#17, #23→#24, #26) : le PO installe l'APK, teste, note, revient. Demain,
Claude détecte et corrige seul le mécanique ; le PO ne fait plus **qu'une** passe de validation sur
le S22, quand Claude annonce « prêt ».

**Gain visé, honnête :** de 2–3 boucles par feature à 1. Le goût (formulations, ordre logique,
ressenti sur le vélo) et la vraie ceinture BLE restent la passe du PO — ils ne s'automatisent pas.

**Pile :** `@playwright/test` (navigateurs déjà installés localement) · Maestro CLI (open source) ·
`ReactiveCircus/android-emulator-runner` · GitHub Actions *(dépôt public : minutes gratuites, KVM
disponible sur `ubuntu-latest`)*

**Premier écran équipé :** Réglages / Capteur cardio et réglage de zone — il attend sa validation S22,
le banc est donc jugé tout de suite sur un cas réel.

## Architecture — deux étages

| Étage | Où | Durée | Voit | Ne voit pas |
|---|---|---|---|---|
| 1. Playwright | PC local + CI | secondes | sauts, chevauchements, zones tactiles, débordements, logique des parcours | clavier virtuel, gestes réels, bouton retour, natif |
| 2. Maestro sur émulateur Android | CI uniquement | ~5–10 min, sans personne | la vraie app : clavier virtuel, retour, gestes, WebView réel | la vraie ceinture, le ressenti en main |

- L'étage 1 est la boucle d'itération de Claude : 90 % des corrections s'y font.
- L'étage 2 tourne à chaque push de la branche. Défaut trouvé → la PR reste rouge, Claude corrige et
  repousse. Rien n'est mergé ni annoncé au PO tant que tout n'est pas vert.
- Pas d'émulateur local : la machine (6 Go, i5 de 2017, pas de KVM sous WSL) ne le tient pas.

## Décisions prises en session (2026-10-10)

- Le banc **bloque la PR en CI** — une règle seulement écrite ne tient pas, les hooks l'ont prouvé.
- Les sauts se mesurent par **géométrie avant/après chaque action**, pas par le CLS : la mesure
  standard exclut les décalages dans les 500 ms qui suivent une action utilisateur — exactement les
  nôtres (une erreur apparaît après une frappe et pousse les champs).
- **Pas de comparaison pixel à pixel** : trop de fausses alertes sur mobile. On vérifie des faits
  (visible, non coupé, non recouvert) ; les captures servent à la relecture.
- Zones tactiles : **48 dp minimum, 8 dp entre deux cibles** (règle d'accessibilité Android).
- Chaque maquette porte désormais la **liste des états** de l'écran (*UI stack* : vide, chargement,
  partiel, erreur, nominal, plus transitoires — toast, clavier ouvert, texte long), et pour chacun
  les actions possibles. Les parcours doivent traverser tous les états listés.
- Écartés : Appium, Applitools/Percy, Storybook ou studio sur mesure, Maestro Cloud, émulateur local.
- Maestro **sur le S22 par USB** reste une piste pour plus tard (câble USB-C, pas de Wi-Fi), pas ici :
  il remet le PO dans la boucle.
- La **skill** qui codifie la méthode s'écrit **après** ce premier usage, pas avant.

## Arbitrages encore ouverts — à soumettre au PO quand on y arrive

1. **Point d'injection du faux greffon capteur** (tâche 4) : si le seul moyen propre touche le code
   de production (`useCapteur.ts`), c'est un arbitrage.
2. **Check obligatoire sur `main`** (tâche 7) : réglage de protection de branche via `gh api` —
   à annoncer avant.
3. **Maestro voit-il le contenu du WebView Capacitor ?** (tâche 8) — aucun retour d'expérience trouvé
   en ligne. Si l'essai échoue, arbitrage : autre pilote ou étage 2 abandonné.

## Tâches

### 0. Acter la méthode
- [ ] Nouveau sujet dans `DECISIONS.md` : banc d'essai, deux étages, critères, passe S22 unique
- [ ] `CLAUDE.md`, section *Méthode de travail* : 3 lignes max, renvoi au sujet
- [ ] Commit `docs(decisions): ...` — part dans la PR du banc

### 1. Playwright en local
- [ ] Vérifier en ligne la version courante de `@playwright/test` ; l'aligner sur les navigateurs
      déjà installés ou les mettre à jour
- [ ] `playwright.config.ts` : projet `s22` (360×780, `deviceScaleFactor` 3, `isMobile`, `hasTouch`,
      Chromium), `webServer` sur `npm run dev`, trace et capture à chaque étape
- [ ] Script `npm run e2e` ; un test fumée qui ouvre l'Accueil passe sous WSL

### 2. Mettre l'app dans un état
- [ ] Jeux de données : `vide`, `une séance`, `plein`, `zone non définie`, `zone définie`
- [ ] Injection dans Dexie avant le chargement de la page, sans code de test dans le bundle de prod

### 3. Contrôles génériques — appliqués à chaque étape de chaque parcours
- [ ] **Sauts** : position de chaque élément visible avant/après l'action ; tout déplacement non
      déclaré comme attendu fait échouer le test et nomme l'élément
- [ ] **Chevauchements** : aucun élément interactif recouvert (bouton `+`, toast, barre du bas, pied)
- [ ] **Zones tactiles** : ≥ 48 px CSS et ≥ 8 px d'écart
- [ ] **Débordements** : pas de défilement horizontal, pas de texte coupé
- [ ] **Premier affichage** : pas de saut quand `useLiveQuery` passe de `undefined` aux données
- [ ] Les contrôles se testent eux-mêmes : une page volontairement fautive doit les faire échouer

### 4. Faux greffon capteur
- [ ] Le script de test émet les signaux du Kotlin (`etat`, `fc`) par le même chemin que le natif
- [ ] Atteindre en test les états : recherche, connecté, FC en direct, perdu, coupé
- [ ] Si l'injection exige de toucher `useCapteur.ts` → **arbitrage 1**

### 5. Parcours de l'écran Réglages
- [ ] Liste des états de l'écran (tâche bloquante : sans elle, on ne sait pas quoi couvrir)
- [ ] Capteur : connecter → recherche → connecté → FC → perte → reconnexion ; annuler ; déconnecter
- [ ] Zone : premier réglage, saisie invalide (message), enchaînement « Suivant », correction,
      enregistrement, retour à l'onglet
- [ ] Navigation : aller-retour entre onglets, la ligne capteur retrouvée telle quelle

### 6. La planche de relecture
- [ ] Rapport HTML Playwright : une capture nommée par étape (`test.step`), trace rejouable
- [ ] Claude relit les captures avec la grille des conventions Android avant d'annoncer « prêt »

### 7. Étage 1 en CI
- [ ] Job `e2e` sur `pull_request`, rapport publié en artefact
- [ ] Check obligatoire pour merger sur `main` → **arbitrage 2**

### 8. Étage 2 — Maestro sur émulateur
- [ ] **Essai d'abord, limité à une session** : un flow Maestro ouvre l'APK sur l'émulateur CI et
      lit un libellé de l'écran Réglages. Échec → **arbitrage 3**, on s'arrête
- [ ] Job `emulateur` : `android-emulator-runner` avec cache de l'AVD démarré, installation de
      l'APK construit par le job existant, flows `.maestro/`, captures en artefact
- [ ] Flows : clavier virtuel sur la saisie de zone (champ masqué ? touche « Suivant »), bouton retour
      Android depuis chaque état, balayage du toast
- [ ] Claude récupère les captures (`gh run download`) et les relit
- [ ] Mesurer la durée réelle du job ; viser ≤ 5 min avec le cache

### 9. Passe S22 du PO
- [ ] La PR porte la **liste des angles morts** à vérifier en main : ressenti, formulations, vraie
      ceinture, marges système — rien de ce que le banc a déjà couvert

## Critère de fin, vérifiable par le PO

- `npm run e2e` passe en local ; les deux jobs passent en CI et bloquent une PR rouge
- Une page volontairement fautive (bouton recouvert, élément qui saute) fait échouer le banc
- Le PO reçoit l'écran Réglages avec la planche et la liste des angles morts, et fait **une seule**
  passe S22
- **Mesure de succès, à la feature suivante (export + import) :** au plus une PR de retours terrain

## Hors périmètre

- Les parcours des autres écrans — ajoutés au fil de leurs prochaines modifications
- Le sous-agent « testeur » — seulement si l'auto-relecture de Claude s'avère trop indulgente
- Maestro sur le S22 par USB
