# Zone 2

Application Android de suivi d'entraînement cycliste en **zone 2**, conçue pour un usage sur vélo
stationnaire. Objectifs de l'athlète : perte de masse grasse et préparation de triathlon longue distance.

> **État : en construction.** Itération 1 — mise en place de la chaîne de livraison.
> Rien n'est encore utilisable au quotidien.

## Installer

**[⬇ Télécharger le dernier APK](https://github.com/guillaume-axs/zone-2/releases/download/latest/zone2.apk)**
— reconstruit à chaque modification de `main`, adresse invariable.

Signé avec la clé de debug : Android demandera d'autoriser l'installation depuis une source inconnue.

## Le problème

L'entraînement en zone 2 se pilote à l'**efficience** (le rapport entre la puissance produite et le coût
cardiaque), pas au volume. Les applications existantes sont soit des journaux de bord sans lecture
physiologique, soit des plateformes lourdes conçues pour le vélo de route et le GPS — inutilisables sur
un vélo de salle.

## Deux étapes

| Étape | Contenu |
|---|---|
| **1** | Saisie manuelle des séances + tableau de bord de progression |
| **2** | Capture de la fréquence cardiaque en direct via ceinture Bluetooth, avec indicateur de zone temps réel |

## Pile technique

| Domaine | Choix |
|---|---|
| Application | Capacitor 8 · React · TypeScript · Vite |
| Composants | React Aria Components *(headless — le style reste maison)* |
| Stockage local | IndexedDB via Dexie |
| Stockage distant | Supabase (Postgres, UE, RLS) — *étape 1, à venir* |
| Livraison | GitHub Actions → APK |

## Principes de conception

- **Local d'abord.** L'application fonctionne intégralement hors ligne ; la synchronisation est un confort,
  jamais une dépendance. Une séance ne doit jamais être perdue.
- **Aucune valeur dérivée n'est stockée.** Efficience, découplage et moyennes sont des fonctions pures
  calculées à la lecture — ce qui élimine toute désynchronisation entre données et agrégats.
- **Zones historisées.** Modifier ses zones cibles ne réinterprète jamais l'historique : chaque séance est
  lue à travers les zones en vigueur ce jour-là.

## Documentation

- [`DECISIONS.md`](DECISIONS.md) — les arbitrages techniques et métier, avec leurs motifs et les options écartées
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — les plans d'itération
