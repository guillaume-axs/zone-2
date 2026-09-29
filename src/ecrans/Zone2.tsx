import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-aria-components'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { bornesSchema, type BornesInput } from '../forms/bornesSchema'
import { bornesEnVigueur, enregistrerBornes } from '../db/zones'
import { bornesZone2 } from '../metrics/zone'
import Marque from './Marque'
import { DUREE_TOAST_MS, annonces } from './toast'
import '../forms/SessionForm.css'

/** Nombre de chiffres d'un âge plausible (15 à 99 ans, sujet 13). */
const CHIFFRES_AGE = 2

/**
 * Le champ, pris isolément, passe-t-il ses bornes ? Ne sert qu'à **effacer** une
 * erreur pendant la frappe, jamais à en allumer une : « 13 » en route vers
 * « 133 » est hors bornes sans être une faute (sujet 10, règle 4).
 */
function borneOk(name: keyof BornesInput, brut: string) {
  const valeur = brut === '' ? undefined : Number(brut)
  return bornesSchema.shape[name].safeParse(valeur).success
}

/**
 * Réglage de la zone 2 — sujet 13.
 *
 * Trois lignes, un nombre par ligne : l'âge remplit les deux bornes, qui
 * restent modifiables à la main. Aucun titre géant, aucune phrase
 * d'explication — aucun écran de réglage du marché n'en porte.
 *
 * **L'âge n'entre jamais en base.** Il est un état local de cet écran, absent du
 * schéma de saisie comme du modèle : le dépôt est public et l'âge est une donnée
 * identifiante (sujets 8 et 13). Le champ est donc vide à chaque ouverture, même
 * quand les bornes sont déjà réglées.
 *
 * L'écran occupe tout l'affichage, hors du gabarit des onglets : le bouton
 * flottant y occuperait le bas, où se trouve « Enregistrer ».
 */
export default function Zone2() {
  const navigate = useNavigate()
  const [age, setAge] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BornesInput>({
    // Règle 4 du sujet 10 — « récompenser tôt, punir tard » : une erreur ne
    // s'allume qu'à la sortie du champ, elle s'éteint à la frappe qui la
    // corrige. Le détail du piège `onTouched` est commenté dans SessionForm.
    resolver: zodResolver(bornesSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  })

  const debut = watch('z2MinBpm')
  const fin = watch('z2MaxBpm')

  const ageRef = useRef<HTMLInputElement | null>(null)
  const debutRef = useRef<HTMLInputElement | null>(null)
  const finRef = useRef<HTMLInputElement | null>(null)

  // Les bornes déjà en vigueur remplissent les deux champs ; l'âge reste vide.
  useEffect(() => {
    bornesEnVigueur().then((b) => {
      if (b) reset({ z2MinBpm: b.z2MinBpm, z2MaxBpm: b.z2MaxBpm })
    })
  }, [reset])

  /**
   * Champ numérique. Version réduite de celle de SessionForm : ici les deux
   * bornes sont jumelles et alimentées par un troisième champ qui n'est pas dans
   * le formulaire, là-bas trois champs distincts avec avance automatique et
   * incrémenteur. Rendre l'outil commun demanderait de le rendre générique sur
   * le type du formulaire et sur le contrôle de validité — plus de complexité
   * partagée que de code économisé.
   */
  function numerique(
    name: keyof BornesInput,
    champ: React.RefObject<HTMLInputElement | null>,
    suivant?: React.RefObject<HTMLInputElement | null>,
  ) {
    const field = register(name, {
      setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
    })
    return {
      ...field,
      ref(el: HTMLInputElement | null) {
        field.ref(el)
        champ.current = el
      },
      onChange(e: React.ChangeEvent<HTMLInputElement>) {
        e.target.value = e.target.value.replace(/\D/g, '')
        const r = field.onChange(e)
        if (borneOk(name, e.target.value)) clearErrors(name)
        return r
      },
      onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key !== 'Enter') return
        e.preventDefault()
        if (suivant?.current) suivant.current.focus()
        else e.currentTarget.blur()
      },
      onFocus(e: React.FocusEvent<HTMLInputElement>) {
        e.target.select()
        // Le clavier met environ 200 ms à s'ouvrir : sans ce délai, le champ est
        // recentré dans une fenêtre qui n'a pas encore rétréci, donc sous le clavier.
        const el = e.target
        window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250)
      },
    }
  }

  /**
   * L'âge recalcule les deux bornes dès qu'il est plausible — deux chiffres, de
   * 15 à 99 ans. Pas à chaque touche : à un seul chiffre, les bornes d'un enfant
   * de 4 ans s'afficheraient une seconde avant de sauter.
   *
   * Aucune avance automatique vers le champ suivant, contrairement à la
   * puissance du formulaire de séance : le champ suivant vient d'être rempli par
   * le calcul, s'y poser le sélectionnerait entier et la frappe l'effacerait.
   */
  function onAge(e: React.ChangeEvent<HTMLInputElement>) {
    const brut = e.target.value.replace(/\D/g, '').slice(0, CHIFFRES_AGE)
    setAge(brut)
    if (brut.length < CHIFFRES_AGE) return
    const bornes = bornesZone2(Number(brut))
    if (!bornes) return
    setValue('z2MinBpm', bornes.minBpm)
    setValue('z2MaxBpm', bornes.maxBpm)
    // Le calcul ne peut pas produire de valeur hors bornes : ce qui était
    // affiché comme une faute ne l'est plus.
    clearErrors()
  }

  /**
   * Retaper l'âge écrase une correction manuelle — c'est la seule manière de
   * revenir au calcul automatique, et la raison pour laquelle il n'y a pas de
   * lien « recalculer » sur cet écran (sujet 13).
   *
   * L'écriture ajoute une ligne, elle n'en corrige aucune : l'historique garde
   * ses bornes d'époque. Retour aux Réglages, où la ligne « Zone 2 » affiche la
   * nouvelle plage — et un toast dit ce qui vient d'être écrit, parce que deux
   * chiffres qui changent sur place se remarquent moins qu'une séance qui
   * apparaît dans l'historique.
   */
  async function onSubmit({ z2MinBpm, z2MaxBpm }: BornesInput) {
    await enregistrerBornes(z2MinBpm, z2MaxBpm)
    annonces.add(
      { genre: 'reglage', texte: `Zone 2 · ${z2MinBpm} – ${z2MaxBpm} bpm` },
      { timeout: DUREE_TOAST_MS },
    )
    navigate('/reglages')
  }

  return (
    <form className="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <header className="form__head">
        {/* Sortie sans enregistrer : la croix à gauche du titre, convention
            Material du plein écran. Le bouton retour d'Android fait la même chose. */}
        <Link href="/reglages" className="form__fermer" aria-label="Fermer sans enregistrer">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>
        <Marque />
        <span className="label">Zone 2</span>
      </header>

      <section className="form__rest">
        <div className="field">
          <span className="label">Âge</span>
          <span className="field__in">
            <input
              ref={ageRef}
              value={age}
              onChange={onAge}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                debutRef.current?.focus()
              }}
              onFocus={(e) => e.target.select()}
              className="field__num"
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              placeholder="—"
              aria-label="Âge"
            />
            <span className="unit">ans</span>
          </span>
        </div>

        <div className={`field${errors.z2MinBpm ? ' field--bad' : ''}`}>
          <span className="label">Début de zone</span>
          <span className="field__in">
            <input
              {...numerique('z2MinBpm', debutRef, finRef)}
              className="field__num"
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              placeholder="—"
              aria-label="Début de zone en battements par minute"
              aria-invalid={errors.z2MinBpm ? true : undefined}
            />
            <span className="unit">bpm</span>
          </span>
          {errors.z2MinBpm && (
            <p className="field__err" role="alert">
              {errors.z2MinBpm.message}
            </p>
          )}
        </div>

        <div className={`field${errors.z2MaxBpm ? ' field--bad' : ''}`}>
          <span className="label">Fin de zone</span>
          <span className="field__in">
            <input
              {...numerique('z2MaxBpm', finRef)}
              className="field__num"
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              placeholder="—"
              aria-label="Fin de zone en battements par minute"
              aria-invalid={errors.z2MaxBpm ? true : undefined}
            />
            <span className="unit">bpm</span>
          </span>
          {errors.z2MaxBpm && (
            <p className="field__err" role="alert">
              {errors.z2MaxBpm.message}
            </p>
          )}
        </div>
      </section>

      {/* Règle 5 du sujet 10 — l'action est en bas, pleine largeur, et se relève
          au-dessus du clavier. Éteinte tant que les deux bornes ne sont pas
          remplies : il n'y a rien à enregistrer. */}
      <div className="form__bottom">
        <button
          type="submit"
          className="save"
          disabled={isSubmitting || debut === undefined || fin === undefined}
        >
          Enregistrer
        </button>
      </div>
    </form>
  )
}
