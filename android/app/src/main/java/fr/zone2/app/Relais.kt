package fr.zone2.app

import fr.zone2.app.Ceinture.Etat
import fr.zone2.app.Relais.Detenteur.REGLAGES
import fr.zone2.app.Relais.Detenteur.SEANCE
import fr.zone2.app.Relais.Ordre.Arreter
import fr.zone2.app.Relais.Ordre.ArmerSilence
import fr.zone2.app.Relais.Ordre.DesarmerSilence
import fr.zone2.app.Relais.Ordre.Lancer
import fr.zone2.app.Relais.Ordre.Signaler

/**
 * Qui tient l'unique liaison avec la ceinture, et ce que chaque événement en fait selon lui.
 *
 * Les Réglages (`R`) testent la ceinture : au premier silence, à la radio coupée ou à l'app
 * quittée, ils la lâchent (sujet 16). La séance (`S`) la garde jusqu'au bout : silence = `MUETTE`,
 * radio coupée = attente de son retour. La séance reprend la liaison des Réglages telle quelle,
 * sans la couper ni relancer de recherche.
 *
 * Pur et sans Android : il rend des [Ordre] que [Liaison] exécute, comme `ligne.ts` côté JS.
 */
class Relais {

    enum class Detenteur { REGLAGES, SEANCE }

    sealed interface Ordre {
        /** Nouvelle ceinture, qui se met à chercher. */
        data object Lancer : Ordre
        data object Arreter : Ordre
        /** (Ré)arme le délai de [Journal.SILENCE_MS]. */
        data object ArmerSilence : Ordre
        data object DesarmerSilence : Ordre
        data class Signaler(val pour: Detenteur, val etat: Etat) : Ordre
    }

    var detenteur: Detenteur? = null
        private set

    /** Dernier état connu de la liaison, celui qu'on signale à qui la reprend. */
    var etat: Etat? = null
        private set

    /** La ceinture se reconnecte seule quand la séance la tient, jamais pour les Réglages. */
    val reconnecte: Boolean get() = detenteur == SEANCE

    /** La radio a arrêté la ceinture de la séance : elle la relancera à son retour. */
    private var arreteeParRadio = false

    /** Liste vide et détenteur inchangé : refus. */
    fun prendre(par: Detenteur): List<Ordre> = when (detenteur) {
        null -> lancer(par)
        REGLAGES -> if (par == REGLAGES) couper() + lancer(par) else {
            detenteur = SEANCE
            listOfNotNull(etat?.let { Signaler(SEANCE, it) })
        }
        SEANCE -> if (par == SEANCE) listOfNotNull(etat?.let { Signaler(SEANCE, it) }) else emptyList()
    }

    /** Démarrer quitté sans démarrer : une ceinture connectée retourne aux Réglages, sinon elle est coupée. */
    fun rendre(): List<Ordre> {
        if (detenteur != SEANCE) return emptyList()
        if (etat == Etat.CONNECTEE) {
            detenteur = REGLAGES
            return listOf(Signaler(REGLAGES, Etat.CONNECTEE))
        }
        return couper() + Signaler(REGLAGES, Etat.DECROCHEE)
    }

    fun fermer(par: Detenteur): List<Ordre> = if (detenteur == par) couper() else emptyList()

    fun etatCeinture(e: Etat): List<Ordre> {
        val d = detenteur ?: return emptyList()
        etat = e
        return when {
            e == Etat.CONNECTEE -> listOf(Signaler(d, e), ArmerSilence)
            d == REGLAGES && e in FINS -> couper() + Signaler(d, e)
            else -> listOf(Signaler(d, e), DesarmerSilence)
        }
    }

    fun battementPorte(): List<Ordre> {
        val d = detenteur ?: return emptyList()
        if (etat != Etat.MUETTE) return listOf(ArmerSilence)
        etat = Etat.CONNECTEE
        return listOf(Signaler(d, Etat.CONNECTEE), ArmerSilence)
    }

    /** Le délai vient d'expirer : il n'y a plus rien à désarmer. */
    fun silence(): List<Ordre> = when (detenteur) {
        null -> emptyList()
        REGLAGES -> {
            liberer()
            listOf(Arreter, Signaler(REGLAGES, Etat.DECROCHEE))
        }
        SEANCE -> {
            etat = Etat.MUETTE
            listOf(Signaler(SEANCE, Etat.MUETTE))
        }
    }

    fun radio(allumee: Boolean): List<Ordre> = when {
        detenteur == null -> emptyList()
        allumee -> if (arreteeParRadio) lancer(SEANCE) else emptyList()
        detenteur == REGLAGES -> couper() + Signaler(REGLAGES, Etat.DECROCHEE)
        arreteeParRadio -> emptyList()
        else -> {
            etat = Etat.DECROCHEE
            arreteeParRadio = true
            listOf(DesarmerSilence, Arreter, Signaler(SEANCE, Etat.DECROCHEE))
        }
    }

    /** Sujet 16 : quitter l'app décroche les Réglages ; la séance, elle, continue en arrière-plan. */
    fun appQuittee(): List<Ordre> =
        if (detenteur == REGLAGES) couper() + Signaler(REGLAGES, Etat.DECROCHEE) else emptyList()

    private fun lancer(par: Detenteur): List<Ordre> {
        detenteur = par
        etat = null
        arreteeParRadio = false
        return listOf(Lancer)
    }

    private fun couper(): List<Ordre> {
        liberer()
        return listOf(DesarmerSilence, Arreter)
    }

    private fun liberer() {
        detenteur = null
        etat = null
        arreteeParRadio = false
    }

    private companion object {
        /** Sous les Réglages, la ceinture ne se reconnecte pas : ces états closent la liaison. */
        val FINS = setOf(Etat.DECROCHEE, Etat.INTROUVABLE, Etat.ECHEC)
    }
}
