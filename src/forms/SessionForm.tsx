import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sessionSchema, type SessionInput } from './sessionSchema'
import { createSession } from '../db/sessions'
import './SessionForm.css'

/** Étiquettes des contextes. Les valeurs sont celles du modèle, les mots ceux de l'utilisateur. */
const CONTEXTS = [
  { value: 'chaleur', label: 'Salle chaude' },
  { value: 'fatigue', label: 'Fatigué' },
  { value: 'a-jeun', label: 'À jeun' },
  { value: 'maladie', label: 'Malade' },
] as const

const DUREE_PAR_DEFAUT = 45
const PAS = 5

/** Retour haptique. Absent sur bureau, silencieux si l'utilisateur l'a coupé. */
function tick() {
  navigator.vibrate?.(8)
}

type Props = {
  /**
   * Appelé une fois l'écriture confirmée. L'appelant reçoit aussi la saisie :
   * si l'utilisateur annule, on lui rend son formulaire tel qu'il l'avait
   * rempli, sans le lui faire retaper (règle 7).
   */
  onSaved: (id: string, input: SessionInput) => void
  /** Valeurs de départ, quand on revient d'une annulation. */
  initial?: SessionInput
}

/**
 * Saisie d'une séance — les sept règles du sujet 10 sont appliquées ici.
 * Chaque écart au CSS de la maquette est délibéré et commenté.
 */
export default function SessionForm({ onSaved, initial }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SessionInput>({
    resolver: zodResolver(sessionSchema),
    // Règle 4 — « récompenser tôt, punir tard » : `onTouched` valide à la première
    // sortie du champ, puis à chaque frappe. L'erreur disparaît donc sur la touche
    // qui la corrige, sans attendre un nouveau blur.
    mode: 'onTouched',
    defaultValues: initial ?? { durationMin: DUREE_PAR_DEFAUT, context: [] },
  })

  const context = watch('context') ?? []

  /**
   * Champ numérique. Deux précautions :
   *  - `setValueAs` traduit la chaîne du DOM en nombre, et le vide en `undefined`
   *    (un champ optionnel laissé vide ne doit pas devenir `NaN`) ;
   *  - la frappe est filtrée aux chiffres, pour qu'aucune lettre n'atteigne zod
   *    et n'y déclenche un message technique.
   */
  function numeric(name: 'durationMin' | 'avgPowerW' | 'avgHrBpm') {
    const field = register(name, {
      setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
    })
    return {
      ...field,
      onChange(e: React.ChangeEvent<HTMLInputElement>) {
        e.target.value = e.target.value.replace(/\D/g, '')
        return field.onChange(e)
      },
      // Règle 6 — corriger une durée doit coûter un geste, pas trois :
      // le champ se sélectionne entier, la frappe remplace.
      onFocus(e: React.FocusEvent<HTMLInputElement>) {
        e.target.select()
      },
    }
  }

  function pas(delta: number) {
    tick()
    const actuelle = getValues('durationMin') || DUREE_PAR_DEFAUT
    // On borne au lieu de réinitialiser : une valeur hors bornes reste la
    // valeur de l'utilisateur, on ne la lui reprend pas.
    const suivante = Math.min(600, Math.max(1, actuelle + delta))
    setValue('durationMin', suivante, { shouldValidate: true })
  }

  function toggleContext(value: (typeof CONTEXTS)[number]['value']) {
    tick()
    const suivant = context.includes(value)
      ? context.filter((c) => c !== value)
      : [...context, value]
    setValue('context', suivant)
  }

  async function onSubmit(input: SessionInput) {
    const id = await createSession(input)
    onSaved(id, input)
  }

  return (
    <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <header className="form__head">
        <svg width="30" height="11" viewBox="0 0 30 11" aria-hidden="true">
          <path
            d="M0,5.5 L7,5.5 L9.5,1.5 L13,9.5 L16,5.5 L30,5.5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="label">Nouvelle séance</span>
      </header>

      {/* Règle 3 — la durée est seule en haut, en grand : la hiérarchie dit
          « obligatoire » mieux que le mot ne le dirait. */}
      <section className="form__hero">
        <div className="stepper">
          <button
            type="button"
            className="stepper__btn"
            aria-label="Cinq minutes de moins"
            onClick={() => pas(-PAS)}
          >
            –
          </button>
          <input
            {...numeric('durationMin')}
            className="stepper__value"
            type="text"
            inputMode="numeric"
            enterKeyHint="next"
            aria-label="Durée en minutes"
            aria-invalid={errors.durationMin ? true : undefined}
          />
          <button
            type="button"
            className="stepper__btn"
            aria-label="Cinq minutes de plus"
            onClick={() => pas(PAS)}
          >
            +
          </button>
        </div>
        <span className="hero-unit">Minutes</span>
        {errors.durationMin && (
          <p className="field__err" role="alert">
            {errors.durationMin.message}
          </p>
        )}
      </section>

      <section className="form__rest">
        <div className={`field${errors.avgPowerW ? ' field--bad' : ''}`}>
          <span className="label">Puissance moy.</span>
          <span className="field__in">
            <input
              {...numeric('avgPowerW')}
              className="field__num"
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              placeholder="—"
              aria-label="Puissance moyenne en watts"
              aria-invalid={errors.avgPowerW ? true : undefined}
            />
            <span className="unit">W</span>
          </span>
          {errors.avgPowerW && (
            <p className="field__err" role="alert">
              {errors.avgPowerW.message}
            </p>
          )}
        </div>

        <div className={`field${errors.avgHrBpm ? ' field--bad' : ''}`}>
          <span className="label">FC moyenne</span>
          <span className="field__in">
            <input
              {...numeric('avgHrBpm')}
              className="field__num"
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              placeholder="—"
              aria-label="Fréquence cardiaque moyenne"
              aria-invalid={errors.avgHrBpm ? true : undefined}
            />
            <span className="unit">bpm</span>
          </span>
          {errors.avgHrBpm && (
            <p className="field__err" role="alert">
              {errors.avgHrBpm.message}
            </p>
          )}
        </div>

        <div className="tags">
          {CONTEXTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="tag"
              aria-pressed={context.includes(value)}
              onClick={() => toggleContext(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Règle 5 — l'action est en bas, pleine largeur, et se relève au-dessus
          du clavier au lieu d'être recouverte par lui. */}
      <div className="form__bottom">
        <button type="submit" className="save" disabled={isSubmitting}>
          Enregistrer
        </button>
      </div>
    </form>
  )
}
