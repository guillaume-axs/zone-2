# Itération 2 — Saisie manuelle et moteur de métriques

> **Pour un exécutant automatisé :** ce plan se déroule tâche par tâche, chaque étape cochée après
> vérification. Les étapes utilisent la syntaxe `- [ ]` pour le suivi.

**Date :** 2026-08-13
**Objectif :** enregistrer une vraie séance depuis un formulaire, et calculer son efficience avec un
module pur couvert par des tests.

**Architecture :** deux blocs indépendants qui ne se connaissent presque pas. Un **module de métriques**
en TypeScript pur — des nombres entrent, un nombre ou `null` sort, aucune dépendance à React ni à Dexie,
donc testable en isolation totale. Et un **formulaire** en feuille modale qui valide sa saisie avant
de l'écrire dans Dexie. Le seul point de contact est l'interface `Session` déjà en place.

**Pile :** Vitest · zod · React Aria Components · Dexie *(tout déjà installé sauf les deux premiers)*

**Spécification :** `DECISIONS.md`, sujets 1 (périmètre et champs) et 4 (métier et modèle)

## Contraintes globales

- **Aucune valeur dérivée n'est stockée** — l'efficience est recalculée à chaque lecture *(sujet 4)*
- **`durationS` est le seul champ obligatoire** — une séance sans puissance ni FC s'enregistre quand même *(sujet 1)*
- **La couleur ne décore jamais** — `--accent` porte une information, jamais un ornement *(sujet 7)*
- **Filets fins, pas de cartes arrondies** *(sujet 7)*
- `Instrument Serif` est réservée **aux seuls chiffres héros**
- Commits en *Conventional Commits*, ≤ 72 caractères, une tâche = un commit
- Travail sur une branche, fusion par PR — `main` est protégée

## Critère de fin, vérifiable par le PO

1. `npm test` passe au vert et la CI échoue si un test casse
2. Sur le S22 : le bouton ouvre une feuille de saisie
3. Une séance avec durée seule s'enregistre
4. Une FC à `0` est refusée à la saisie, avec un message lisible
5. La séance survit à la fermeture complète de l'application

## Hors périmètre — explicitement

Écran d'historique · tableau de bord · graphique d'efficience · édition · suppression · onglets de
navigation · Supabase · découplage aérobie *(exige la série temporelle, donc étape 2)*.

---

## ⚠️ Deux points à trancher avant de commencer

**A — Les tags de contexte ✅ *(tranché par le PO le 2026-08-13)***

Le sujet 1 en annonçait trois (*salle chaude*, *fatigué*, *jambes lourdes*), `src/db/schema.ts` en
déclarait quatre. **Décision : les quatre du code** — « à jeun » et « malade » expliquent une chute
d'efficience que « jambes lourdes » ne dit pas.

**Avec une correction :** l'identifiant `jeune` devient **`a-jeun`**. `jeune` ne veut pas dire « à
jeun », il veut dire *young* — un identifiant qui ment sur son contenu, écrit à l'itération 1 pour
éviter l'espace et l'accent. `context` n'étant pas un champ indexé et aucune séance ne portant
encore de tag, le changement ne coûte aucune migration.

**B — Le champ date et heure ✅ *(tranché par le PO le 2026-08-13)***

**Décision : il n'y en a pas.** La séance est horodatée à l'instant de l'enregistrement.

*Motif :* le champ n'existe dans Strava ou Garmin que pour la saisie après coup. À l'étape 2 le
chrono fournira l'horodatage, et le champ deviendrait mort. Le construire aujourd'hui, c'est bâtir
ce qu'on supprimera. Le seul cas gênant — saisir une séance le lendemain — produit une date fausse
d'un jour, cosmétique et corrigeable : **la correction de date relève de l'écran d'édition**, prévu
en itération 3, pas du formulaire de création.

*Effet de bord bienvenu :* la maquette a montré que le sélecteur natif d'Android jure avec la charte.
Le problème disparaît au lieu d'être contourné.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/metrics/efficiency.ts` | **Créé.** L'efficience et rien d'autre. Aucune dépendance. |
| `src/metrics/efficiency.test.ts` | **Créé.** Les cas nominaux et tous les cas dégradés. |
| `src/forms/sessionSchema.ts` | **Créé.** Le schéma zod de la saisie, bornes comprises. |
| `src/db/schema.ts` | **Modifié.** L'identifiant `jeune` devient `a-jeun`. |
| `src/forms/SessionForm.tsx` | **Créé.** La feuille modale et ses champs. |
| `src/forms/SessionForm.css` | **Créé.** Le style de la feuille. |
| `src/App.tsx` | **Modifié.** Le bouton factice cède la place au formulaire. |
| `vite.config.ts` | **Modifié.** Configuration Vitest. |
| `package.json` | **Modifié.** Script `test`, dépendances `vitest` et `zod`. |
| `.github/workflows/build-apk.yml` | **Modifié.** `npm test` avant le build. |

---

## Tâche 1 — Module d'efficience et outillage de test

Première tâche parce que c'est la pièce vitrine, et parce qu'elle ne dépend de rien.

**Fichiers :**
- Créer : `src/metrics/efficiency.ts`, `src/metrics/efficiency.test.ts`
- Modifier : `package.json`, `vite.config.ts`, `.github/workflows/build-apk.yml`

**Interfaces produites :**
```ts
efficiency(session: Pick<Session, 'avgPowerW' | 'avgHrBpm'>): number | null
```

- [ ] **Étape 1 — Créer la branche de travail et installer Vitest**

`main` est protégée : tout le travail de l'itération vit sur cette branche jusqu'à la tâche 5.

```bash
git switch -c feat/saisie-seance
npm install -D vitest
```

- [ ] **Étape 2 — Configurer Vitest dans `vite.config.ts`**

Remplacer l'import de `vite` par celui de `vitest/config`, qui étend `defineConfig` du champ `test` :

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Le module de métriques est du TypeScript pur : il n'a besoin
  // d'aucun DOM, et `node` démarre bien plus vite que `jsdom`.
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Étape 3 — Ajouter le script de test**

Dans `package.json`, section `scripts` :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Étape 4 — Écrire les tests, avant l'implémentation**

Créer `src/metrics/efficiency.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { efficiency } from './efficiency'

describe('efficiency', () => {
  it('divise la puissance par la fréquence cardiaque', () => {
    expect(efficiency({ avgPowerW: 150, avgHrBpm: 130 })).toBeCloseTo(1.1538, 4)
  })

  it('vaut null sans puissance', () => {
    expect(efficiency({ avgHrBpm: 130 })).toBeNull()
  })

  it('vaut null sans fréquence cardiaque', () => {
    expect(efficiency({ avgPowerW: 150 })).toBeNull()
  })

  it('vaut null quand les deux manquent', () => {
    expect(efficiency({})).toBeNull()
  })

  // Le cas qui justifie la garde : sans elle, la division renvoie `Infinity`,
  // une valeur qui traverse tout le code sans jamais déclencher d'erreur et
  // qui fait exploser l'échelle du graphique.
  it('vaut null pour une fréquence cardiaque nulle', () => {
    expect(efficiency({ avgPowerW: 150, avgHrBpm: 0 })).toBeNull()
  })

  it('vaut null pour une fréquence cardiaque négative', () => {
    expect(efficiency({ avgPowerW: 150, avgHrBpm: -5 })).toBeNull()
  })

  // Une puissance à zéro est une mesure valide, pas une absence de mesure.
  it('vaut 0 pour une puissance nulle', () => {
    expect(efficiency({ avgPowerW: 0, avgHrBpm: 130 })).toBe(0)
  })
})
```

- [ ] **Étape 5 — Lancer les tests et vérifier qu'ils échouent**

```bash
npm test
```
Attendu : échec, `Failed to resolve import "./efficiency"`.

- [ ] **Étape 6 — Écrire l'implémentation minimale**

Créer `src/metrics/efficiency.ts` :

```ts
import type { Session } from '../db/schema'

/**
 * Efficience — puissance moyenne ÷ fréquence cardiaque moyenne (sujet 4).
 *
 * Progresser, c'est produire plus de watts à fréquence cardiaque égale.
 *
 * Renvoie `null` dès que la valeur n'a pas de sens : une des deux mesures
 * manque, ou la fréquence cardiaque est nulle ou négative. La fonction ne
 * fait pas confiance à son appelant — la validation de saisie écarte déjà
 * ces cas, mais une donnée peut aussi venir d'un enregistrement ancien.
 *
 * Aucune valeur n'est stockée : le calcul se refait à chaque lecture.
 */
export function efficiency(
  session: Pick<Session, 'avgPowerW' | 'avgHrBpm'>,
): number | null {
  const { avgPowerW, avgHrBpm } = session
  if (avgPowerW === undefined || avgHrBpm === undefined) return null
  if (avgHrBpm <= 0) return null
  return avgPowerW / avgHrBpm
}
```

- [ ] **Étape 7 — Relancer les tests**

```bash
npm test
```
Attendu : **7 tests au vert**.

- [ ] **Étape 8 — Brancher les tests sur la CI**

Un test qui ne tourne pas en intégration continue n'est qu'une décoration. Dans
`.github/workflows/build-apk.yml`, job `build`, **entre** `npm ci` et `npm run build` :

```yaml
      # Avant le build : un calcul faux ne se voit jamais à l'écran,
      # contrairement à un bouton mal placé.
      - run: npm test
```

- [ ] **Étape 9 — Commit**

```bash
git add package.json package-lock.json vite.config.ts src/metrics .github/workflows/build-apk.yml
git commit -m "feat(metrics): ajoute le calcul d'efficience et son harnais de test"
```

**Vérification :** `npm test` affiche 7 tests au vert, et la CI exécute désormais l'étape.

---

## Tâche 2 — Validation de la saisie

Le formulaire ne doit jamais pouvoir écrire une donnée absurde en base. La validation vit dans son
propre module, séparée de l'affichage, pour rester lisible.

**Fichiers :**
- Créer : `src/forms/sessionSchema.ts`
- Modifier : `src/db/schema.ts`

**Interfaces produites :**
```ts
sessionSchema           // schéma zod
type SessionInput       // type inféré du schéma
```

- [ ] **Étape 1 — Installer zod**

```bash
npm install zod
```

- [ ] **Étape 2 — Corriger l'identifiant trompeur dans `src/db/schema.ts`**

```ts
export type SessionContext = 'chaleur' | 'fatigue' | 'a-jeun' | 'maladie'
```

- [ ] **Étape 3 — Écrire le schéma**

Créer `src/forms/sessionSchema.ts` :

```ts
import { z } from 'zod'

/**
 * Bornes de saisie. Pas de champ de date : la séance est horodatée à
 * l'enregistrement (voir le point B du plan).
 *
 * Bornes Elles ne cherchent pas à juger la performance mais à
 * écarter la faute de frappe : une FC à 0 ou une durée de 40 heures.
 *
 * Les unités sont celles du formulaire (minutes, kilomètres), pas celles
 * du modèle (secondes, mètres) — la conversion se fait à l'enregistrement.
 */
export const sessionSchema = z.object({
  durationMin: z
    .number({ message: 'Durée requise' })
    .int('Nombre entier de minutes')
    .min(1, 'Au moins 1 minute')
    .max(600, 'Au plus 10 heures'),

  avgPowerW: z.number().int().min(0).max(1000).optional(),
  avgHrBpm: z.number().int().min(30, 'FC trop basse').max(230, 'FC trop haute').optional(),
  distanceKm: z.number().min(0).max(500).optional(),
  rpe: z.number().int().min(1).max(10).optional(),

  context: z.array(z.enum(['chaleur', 'fatigue', 'a-jeun', 'maladie'])).optional(),
  notes: z.string().max(500).optional(),
})

export type SessionInput = z.infer<typeof sessionSchema>
```

- [ ] **Étape 4 — Vérifier que le projet compile**

```bash
npm run build
```
Attendu : succès.

- [ ] **Étape 5 — Commit**

```bash
git add package.json package-lock.json src/forms/sessionSchema.ts src/db/schema.ts
git commit -m "feat(forms): ajoute la validation de saisie d'une seance"
```

**Vérification :** `npm run build` passe, le type `SessionInput` est exporté.

---

## Tâche 3 — La feuille de saisie

**Fichiers :**
- Créer : `src/forms/SessionForm.tsx`, `src/forms/SessionForm.css`

**Interfaces consommées :** `sessionSchema`, `SessionInput` *(tâche 2)*
**Interfaces produites :**
```ts
SessionForm(props: { onSave: (input: SessionInput) => Promise<void> }): JSX.Element
```

Le composant ne connaît pas Dexie. Il valide, puis appelle `onSave`. C'est ce qui permet de le
déplacer plus tard sans rien casser.

### ⚠️ Prérequis bloquant — étude UX avant toute maquette

**Aucune ligne d'interface n'est écrite avant cette étude, et elle vaudra pour tous les écrans
suivants, pas seulement celui-ci.**

- [ ] Chercher d'abord un skill ou un plugin UX existant *(règle sourcing-first : local, puis
      communauté, puis sur mesure en dernier recours)*
- [ ] À défaut, rechercher réellement les pratiques 2026 des éditeurs mobiles de référence :
      saisie numérique au pouce, choix du clavier, traitement des champs optionnels, moment et
      forme du retour de validation, zone d'atteinte du pouce, hauteur des cibles tactiles
- [ ] Restituer au PO les règles retenues **avec leur justification et leur source**, avant de coder
- [ ] Montrer une prévisualisation fidèle sur le S22 plutôt que décrire le rendu

**Critère d'acceptance :** le PO doit pouvoir citer les règles appliquées et dire pourquoi.
Il découvre l'UX sur ce projet — la restitution pédagogique fait partie du livrable, au même
titre que le code.

**Borne, pour éviter la dérive :** l'étude produit des décisions appliquées à cet écran, pas un
mémoire. Elle est justifiée parce que ses conclusions serviront aux six écrans suivants.

> Le code des étapes ci-dessous a été écrit **avant** la réduction du formulaire à quatre champs
> (`durée · puissance · FC · contexte`, voir sujet 9 de `DECISIONS.md`). Il sera réécrit à l'issue
> de l'étude UX. Le conserver ici sert de point de comparaison, pas de spécification.

- [ ] **Étape 1 — Écrire le composant**

Créer `src/forms/SessionForm.tsx` :

```tsx
import { useState, type Key } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Input,
  Label,
  Modal,
  NumberField,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components'
import { sessionSchema, type SessionInput } from './sessionSchema'
import './SessionForm.css'

const TAGS = [
  { id: 'chaleur', libelle: 'Salle chaude' },
  { id: 'fatigue', libelle: 'Fatigué' },
  { id: 'a-jeun', libelle: 'À jeun' },
  { id: 'maladie', libelle: 'Malade' },
] as const

export function SessionForm({
  onSave,
}: {
  onSave: (input: SessionInput) => Promise<void>
}) {
  const [durationMin, setDurationMin] = useState<number>(Number.NaN)
  const [avgPowerW, setAvgPowerW] = useState<number>(Number.NaN)
  const [avgHrBpm, setAvgHrBpm] = useState<number>(Number.NaN)
  const [distanceKm, setDistanceKm] = useState<number>(Number.NaN)
  const [rpe, setRpe] = useState<number>(Number.NaN)
  const [context, setContext] = useState<Set<Key>>(new Set())
  const [notes, setNotes] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  /** `NaN` est l'état « champ vide » de NumberField : on ne le transmet pas. */
  const nombreOuRien = (n: number) => (Number.isNaN(n) ? undefined : n)

  function reinitialiser() {
    setDurationMin(Number.NaN)
    setAvgPowerW(Number.NaN)
    setAvgHrBpm(Number.NaN)
    setDistanceKm(Number.NaN)
    setRpe(Number.NaN)
    setContext(new Set())
    setNotes('')
    setErreurs({})
  }

  async function soumettre(fermer: () => void) {
    const resultat = sessionSchema.safeParse({
      durationMin: nombreOuRien(durationMin),
      avgPowerW: nombreOuRien(avgPowerW),
      avgHrBpm: nombreOuRien(avgHrBpm),
      distanceKm: nombreOuRien(distanceKm),
      rpe: nombreOuRien(rpe),
      context: context.size ? [...context] as SessionInput['context'] : undefined,
      notes: notes.trim() || undefined,
    })

    if (!resultat.success) {
      const trouvees: Record<string, string> = {}
      for (const p of resultat.error.issues) trouvees[String(p.path[0])] = p.message
      setErreurs(trouvees)
      return
    }

    await onSave(resultat.data)
    reinitialiser()
    fermer()
  }

  return (
    <DialogTrigger>
      <Button className="btn">Enregistrer une séance</Button>

      <Modal className="sheet" isDismissable>
        <Dialog className="sheet__body">
          {({ close }) => (
            <>
              <p className="label">Nouvelle séance</p>

              <NumberField
                className="field"
                value={durationMin}
                onChange={setDurationMin}
                minValue={1}
                isRequired
              >
                <Label className="label">Durée (min)</Label>
                <Input className="field__input" inputMode="numeric" />
                {erreurs.durationMin && (
                  <p className="field__error">{erreurs.durationMin}</p>
                )}
              </NumberField>

              <NumberField
                className="field"
                value={avgPowerW}
                onChange={setAvgPowerW}
                minValue={0}
              >
                <Label className="label">Puissance moyenne (W)</Label>
                <Input className="field__input" inputMode="numeric" />
                {erreurs.avgPowerW && (
                  <p className="field__error">{erreurs.avgPowerW}</p>
                )}
              </NumberField>

              <NumberField
                className="field"
                value={avgHrBpm}
                onChange={setAvgHrBpm}
                minValue={0}
              >
                <Label className="label">FC moyenne (bpm)</Label>
                <Input className="field__input" inputMode="numeric" />
                {erreurs.avgHrBpm && (
                  <p className="field__error">{erreurs.avgHrBpm}</p>
                )}
              </NumberField>

              <NumberField
                className="field"
                value={distanceKm}
                onChange={setDistanceKm}
                minValue={0}
                formatOptions={{ maximumFractionDigits: 1 }}
              >
                <Label className="label">Distance (km)</Label>
                <Input className="field__input" inputMode="decimal" />
                {erreurs.distanceKm && (
                  <p className="field__error">{erreurs.distanceKm}</p>
                )}
              </NumberField>

              <NumberField
                className="field"
                value={rpe}
                onChange={setRpe}
                minValue={1}
                maxValue={10}
              >
                <Label className="label">Effort perçu (1–10)</Label>
                <Input className="field__input" inputMode="numeric" />
                {erreurs.rpe && <p className="field__error">{erreurs.rpe}</p>}
              </NumberField>

              <div className="field">
                <p className="label">Contexte</p>
                <ToggleButtonGroup
                  className="tags"
                  selectionMode="multiple"
                  selectedKeys={context}
                  onSelectionChange={setContext}
                >
                  {TAGS.map((t) => (
                    <ToggleButton key={t.id} id={t.id} className="tag">
                      {t.libelle}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>

              <TextField className="field" value={notes} onChange={setNotes}>
                <Label className="label">Note</Label>
                <TextArea className="field__input" rows={2} />
              </TextField>

              <div className="sheet__actions">
                <Button className="btn btn--ghost" onPress={close}>
                  Annuler
                </Button>
                <Button className="btn" onPress={() => soumettre(close)}>
                  Enregistrer
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  )
}
```

- [ ] **Étape 2 — Écrire le style**

Créer `src/forms/SessionForm.css`. Filets fins, aucun coin arrondi, l'accent réservé au champ actif :

```css
.sheet {
  position: fixed;
  inset: auto 0 0 0;
  max-height: 92dvh;
  overflow-y: auto;
  background: var(--bg);
  border-top: 1px solid var(--rule);
}

.sheet__body {
  padding: 1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom));
  outline: none;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field__input {
  width: 100%;
  padding: 0.5rem 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--rule);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: 1.125rem;
  outline: none;
}

.field__input:focus {
  border-bottom-color: var(--accent);
}

.field__error {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--fg-3);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tag[data-selected] {
  border-color: var(--fg-2);
  color: var(--fg);
}

.sheet__actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.sheet__actions .btn {
  flex: 1;
}

.btn--ghost {
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--fg-3);
}
```

- [ ] **Étape 3 — Commit**

```bash
git add src/forms/SessionForm.tsx src/forms/SessionForm.css
git commit -m "feat(forms): ajoute la feuille de saisie d'une seance"
```

**Vérification :** le projet compile. Le formulaire n'est pas encore branché, donc rien à voir à l'écran.

---

## Tâche 4 — Brancher le formulaire à la base

**Fichiers :**
- Modifier : `src/App.tsx`

**Interfaces consommées :** `SessionForm`, `SessionInput` *(tâches 2 et 3)*, `efficiency` *(tâche 1)*

- [ ] **Étape 1 — Remplacer le contenu de `src/App.tsx`**

```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { efficiency } from './metrics/efficiency'
import { SessionForm } from './forms/SessionForm'
import type { SessionInput } from './forms/sessionSchema'
import './App.css'

/**
 * Écran d'accueil — itération 2.
 *
 * Encore minimal : il ne montre que le nombre de séances et l'efficience de la
 * dernière. Le tableau de bord complet arrive à l'itération 3, une fois qu'il y
 * aura assez d'historique pour qu'il raconte quelque chose.
 */
export default function App() {
  // `sortBy` renvoie un tableau trié par ordre croissant : la dernière séance
  // est donc en fin de tableau. Ne pas chaîner `.reverse()` avant `sortBy`,
  // qui applique son propre tri et rendrait l'appel sans effet.
  const sessions = useLiveQuery(() =>
    db.sessions.filter((s) => !s.deletedAt).sortBy('startedAt'),
  )

  const derniere = sessions?.at(-1)
  const ef = derniere ? efficiency(derniere) : null

  /** La conversion vers les unités du modèle se fait ici, à la frontière. */
  async function enregistrer(input: SessionInput) {
    const now = new Date().toISOString()
    await db.sessions.add({
      id: crypto.randomUUID(),
      // Horodatée à l'enregistrement : pas de champ de date (point B).
      startedAt: now,
      durationS: input.durationMin * 60,
      avgPowerW: input.avgPowerW,
      avgHrBpm: input.avgHrBpm,
      distanceM:
        input.distanceKm === undefined
          ? undefined
          : Math.round(input.distanceKm * 1000),
      rpe: input.rpe,
      notes: input.notes,
      context: input.context,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    })
  }

  return (
    <main className="screen">
      <header className="screen__head">
        <p className="label">Zone 2</p>
      </header>

      <section className="stat">
        <p className="label">Séances enregistrées</p>
        <p className="stat__value">
          {sessions?.length ?? '—'}
          <span className="stat__unit">
            {sessions?.length === 1 ? 'séance' : 'séances'}
          </span>
        </p>
      </section>

      <section className="stat">
        <p className="label">Efficience, dernière séance</p>
        <p className="stat__value">
          {ef === null ? '—' : ef.toFixed(2)}
          <span className="stat__unit">W/bpm</span>
        </p>
      </section>

      <SessionForm onSave={enregistrer} />
    </main>
  )
}
```

- [ ] **Étape 2 — Vérifier au navigateur**

```bash
npm run dev
```

Saisir une séance de 60 min, 150 W, 130 bpm. Attendu : compteur à 1, efficience **1.15**.

- [ ] **Étape 3 — Vérifier les cas dégradés**

| Saisie | Attendu |
|---|---|
| Durée seule, 45 min | S'enregistre. Efficience `—` |
| FC à 0 | **Refusée**, message « FC trop basse » |
| Durée vide | **Refusée**, message « Durée requise » |
| Puissance sans FC | S'enregistre. Efficience `—` |

- [ ] **Étape 4 — Vérifier la persistance**

Recharger complètement la page. Attendu : le compteur et l'efficience sont conservés.

- [ ] **Étape 5 — Lancer le linter et les tests**

```bash
npm run lint && npm test && npm run build
```

- [ ] **Étape 6 — Commit**

```bash
git add src/App.tsx
git commit -m "feat: branche la saisie de seance sur la base locale"
```

---

## Tâche 5 — Vérification sur l'appareil et fusion

- [ ] **Étape 1 — Pousser la branche**

```bash
git push -u origin feat/saisie-seance
```

- [ ] **Étape 2 — Ouvrir la PR et attendre les checks**

```bash
gh pr create --base main --fill
gh pr checks --watch
```

- [ ] **Étape 3 — Fusionner, ce qui republie l'APK**

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Étape 4 — Installer depuis le lien et vérifier sur le S22**

https://github.com/guillaume-axs/zone-2/releases/download/latest/zone2.apk

**Vérification — le jalon de l'itération :**
- la feuille de saisie s'ouvre et se ferme sans état visuel collé
- le clavier numérique s'affiche pour les champs chiffrés
- une séance saisie au doigt s'enregistre
- fermer complètement l'application, la rouvrir : **la séance et son efficience sont là**

---

## Ce qui restera à décider pour l'itération 3

- L'écran d'historique : liste, édition, suppression logique
- Le tableau de bord : stats du mois et delta avec le mois précédent
- La courbe d'efficience en SVG *(spécifiée au sujet 7, `viewBox="0 0 200 56"`)*
- La configuration des zones et son historisation en SCD type 2
