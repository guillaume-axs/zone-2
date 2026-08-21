import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sessionSchema, type SessionInput } from './sessionSchema'
import { createSession } from '../db/sessions'
import './SessionForm.css'

/** Étiquettes des contextes. Les valeurs sont celles du modèle, les mots ceux de l'utilisateur. */
const CONTEXTS = [
  { value: 'chaleur', label: 'Chaleur' },
  { value: 'fatigue', label: 'Fatigué' },
  { value: 'a-jeun', label: 'À jeun' },
  { value: 'maladie', label: 'Malade' },
] as const

const DUREE_PAR_DEFAUT = 45
const PAS = 5

type Numerique = 'durationMin' | 'avgPowerW' | 'avgHrBpm'

/**
 * Le champ, pris isolément, passe-t-il ses bornes ?
 *
 * Ne sert qu'à **effacer** une erreur pendant la frappe. On ne se sert jamais
 * du faux pour en allumer une : un nombre inachevé — « 12 » en route vers
 * « 125 » — est hors bornes sans être une faute.
 */
function borneOk(name: Numerique, brut: string) {
  const valeur = brut === '' ? undefined : Number(brut)
  return sessionSchema.shape[name].safeParse(valeur).success
}

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
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SessionInput>({
    resolver: zodResolver(sessionSchema),
    // Règle 4 — « récompenser tôt, punir tard ». Apparition et disparition
    // n'obéissent pas au même événement, et c'est tout l'objet de la règle :
    // une erreur ne s'allume qu'à la sortie du champ, elle s'éteint à la frappe
    // qui la corrige (voir `clearErrors` plus bas).
    //
    // `onTouched` avait l'air de faire les deux ; il fait autre chose. Il retient
    // que le champ a déjà été quitté une fois, et valide ensuite à *chaque*
    // frappe — donc il affiche « FC trop basse » sur le « 12 » de « 125 », dès la
    // deuxième visite dans le champ. C'est la sanction pendant la frappe que la
    // règle interdit, doublée d'un comportement qui dépend de l'historique.
    //
    // `reValidateMode` est explicite parce que son défaut (`onChange`) rétablit
    // exactement ce défaut dès la première tentative d'enregistrement.
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: initial ?? { durationMin: DUREE_PAR_DEFAUT, context: [] },
  })

  const context = watch('context') ?? []

  const dureeRef = useRef<HTMLInputElement | null>(null)
  const puissanceRef = useRef<HTMLInputElement | null>(null)
  const fcRef = useRef<HTMLInputElement | null>(null)

  /**
   * Champ numérique. Cinq comportements, tous là pour économiser un geste
   * ou éviter une correction :
   *  - `setValueAs` traduit la chaîne du DOM en nombre, et le vide en `undefined`
   *    (un champ optionnel laissé vide ne doit pas devenir `NaN`) ;
   *  - la frappe est filtrée aux chiffres, pour qu'aucune lettre n'atteigne zod
   *    et n'y déclenche un message technique ;
   *  - la touche « suivant » du clavier passe au champ suivant. Sans cela elle
   *    soumettrait le formulaire : `enterKeyHint` ne change que le dessin de la
   *    touche, jamais son comportement ;
   *  - une valeur redevenue correcte efface l'erreur affichée, sans attendre
   *    un nouveau blur ;
   *  - `avanceA` fait basculer au champ suivant dès que le nombre de chiffres
   *    attendu est atteint. Réservé aux champs dont la longueur maximale est
   *    certaine — voir le commentaire de l'appel.
   */
  function numeric(
    name: Numerique,
    opts: {
      champ: React.RefObject<HTMLInputElement | null>
      suivant?: React.RefObject<HTMLInputElement | null>
      avanceA?: number
    },
  ) {
    const field = register(name, {
      setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
    })
    return {
      ...field,
      ref(el: HTMLInputElement | null) {
        field.ref(el)
        opts.champ.current = el
      },
      onChange(e: React.ChangeEvent<HTMLInputElement>) {
        e.target.value = e.target.value.replace(/\D/g, '')
        const r = field.onChange(e)
        // Le seul effet de la frappe sur les erreurs : en éteindre une. Jamais
        // en allumer une — c'est le `blur` qui en a le droit, lui seul.
        if (borneOk(name, e.target.value)) clearErrors(name)
        if (opts.avanceA && e.target.value.length >= opts.avanceA) {
          opts.suivant?.current?.focus()
        }
        return r
      },
      onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (opts.suivant?.current) opts.suivant.current.focus()
        else e.currentTarget.blur()
      },
      // Règle 6 — corriger une durée doit coûter un geste, pas trois :
      // le champ se sélectionne entier, la frappe remplace.
      onFocus(e: React.FocusEvent<HTMLInputElement>) {
        e.target.select()
        // Le clavier met environ 200 ms à s'ouvrir. Sans ce délai, le champ est
        // recentré dans une fenêtre qui n'a pas encore rétréci, donc au mauvais
        // endroit — et il se retrouve caché sous le clavier.
        const el = e.target
        window.setTimeout(
          () => el.scrollIntoView({ block: 'center', behavior: 'smooth' }),
          250,
        )
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
            {...numeric('durationMin', { champ: dureeRef, suivant: puissanceRef })}
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
              {...numeric('avgPowerW', {
                champ: puissanceRef,
                suivant: fcRef,
                // Trois chiffres suffisent : la borne du schéma est 999 W, et
                // aucune moyenne humaine sur une séance ne les dépasse. Une
                // puissance à deux chiffres demande encore un tap — le cas rare
                // ne coûte rien de plus qu'avant, le cas fréquent gagne un geste.
                avanceA: 3,
              })}
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
              {...numeric('avgHrBpm', { champ: fcRef })}
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
