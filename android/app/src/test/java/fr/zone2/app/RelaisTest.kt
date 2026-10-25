package fr.zone2.app

import fr.zone2.app.Ceinture.Etat.CONNECTEE
import fr.zone2.app.Ceinture.Etat.DECROCHEE
import fr.zone2.app.Ceinture.Etat.ECHEC
import fr.zone2.app.Ceinture.Etat.INTROUVABLE
import fr.zone2.app.Ceinture.Etat.MUETTE
import fr.zone2.app.Ceinture.Etat.RECHERCHE
import fr.zone2.app.Relais.Detenteur.REGLAGES as R
import fr.zone2.app.Relais.Detenteur.SEANCE as S
import fr.zone2.app.Relais.Ordre
import fr.zone2.app.Relais.Ordre.Arreter
import fr.zone2.app.Relais.Ordre.ArmerSilence
import fr.zone2.app.Relais.Ordre.DesarmerSilence
import fr.zone2.app.Relais.Ordre.Lancer
import fr.zone2.app.Relais.Ordre.Signaler
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Une ligne de test par ligne de la table « Le relais » du plan liaison-unique.
 * Les deux copies de la liaison faisaient chacune leur moitié de cette table ;
 * réunies, c'est ici seulement qu'on voit si une moitié a mangé l'autre.
 */
class RelaisTest {

    private val coupe = listOf(DesarmerSilence, Arreter)

    private fun sous(d: Relais.Detenteur, e: Ceinture.Etat = CONNECTEE) =
        Relais().also { it.prendre(d); it.etatCeinture(e) }

    private fun aucun() = emptyList<Ordre>()

    @Test
    fun `prendre R sans détenteur lance`() {
        val r = Relais()
        assertEquals(listOf(Lancer), r.prendre(R))
        assertEquals(R, r.detenteur)
    }

    @Test
    fun `prendre R sous R relance une recherche`() {
        assertEquals(coupe + Lancer, sous(R).prendre(R))
    }

    @Test
    fun `prendre R sous S refusé`() {
        val r = Relais(); r.prendre(S)
        assertEquals(aucun(), r.prendre(R)); assertEquals(S, r.detenteur)
    }

    @Test
    fun `prendre S sans détenteur lance`() {
        val r = Relais()
        assertEquals(listOf(Lancer), r.prendre(S))
        assertEquals(S, r.detenteur)
    }

    @Test
    fun `prendre S depuis R ne lance ni n'arrête`() {
        val r = sous(R)
        assertEquals(listOf(Signaler(R, DECROCHEE), Signaler(S, CONNECTEE)), r.prendre(S))
        assertEquals(S, r.detenteur); assertTrue(r.reconnecte)
    }

    @Test
    fun `prendre S sous S re-signale l'état`() {
        assertEquals(listOf(Signaler(S, CONNECTEE)), sous(S).prendre(S))
    }

    @Test
    fun `rendre connectée`() {
        val r = sous(S)
        assertEquals(listOf(Signaler(R, CONNECTEE)), r.rendre())
        assertEquals(R, r.detenteur); assertFalse(r.reconnecte)
    }

    @Test
    fun `rendre muette coupe`() {
        val r = sous(S); r.silence()
        assertEquals(coupe + Signaler(R, DECROCHEE), r.rendre()); assertNull(r.detenteur)
    }

    @Test
    fun `rendre en recherche coupe`() {
        val r = sous(S, RECHERCHE)
        assertEquals(coupe + Signaler(R, DECROCHEE), r.rendre()); assertNull(r.detenteur)
    }

    @Test
    fun `rendre sous R ne fait rien`() {
        val r = sous(R)
        assertEquals(aucun(), r.rendre()); assertEquals(R, r.detenteur)
    }

    @Test
    fun `fermer par le détenteur coupe`() {
        val r = sous(S)
        assertEquals(coupe, r.fermer(S)); assertNull(r.detenteur)
    }

    @Test
    fun `fermer R sous S ne fait rien`() {
        val r = sous(S)
        assertEquals(aucun(), r.fermer(R)); assertEquals(S, r.detenteur)
    }

    @Test
    fun `silence sous R coupe et annonce DECROCHEE`() {
        val r = sous(R)
        assertEquals(listOf(Arreter, Signaler(R, DECROCHEE)), r.silence()); assertNull(r.detenteur)
    }

    @Test
    fun `silence sous S signale MUETTE`() {
        val r = sous(S)
        assertEquals(listOf(Signaler(S, MUETTE)), r.silence()); assertEquals(S, r.detenteur)
    }

    @Test
    fun `battement après MUETTE`() {
        val r = sous(S); r.silence()
        assertEquals(listOf(Signaler(S, CONNECTEE), ArmerSilence), r.battementPorte())
        assertEquals(CONNECTEE, r.etat)
    }

    @Test
    fun `battement connecté relance le guet`() {
        assertEquals(listOf(ArmerSilence), sous(R).battementPorte())
    }

    @Test
    fun `battement sans détenteur ne fait rien`() {
        val r = sous(R); r.silence()
        assertEquals(aucun(), r.battementPorte())
    }

    @Test
    fun `connectée arme le silence, la recherche le désarme`() {
        val r = Relais(); r.prendre(S)
        assertEquals(listOf(Signaler(S, CONNECTEE), ArmerSilence), r.etatCeinture(CONNECTEE))
        assertEquals(listOf(Signaler(S, RECHERCHE), DesarmerSilence), r.etatCeinture(RECHERCHE))
    }

    @Test
    fun `décrochée sous R coupe et libère`() {
        for (e in listOf(DECROCHEE, INTROUVABLE, ECHEC)) {
            val r = sous(R)
            assertEquals(coupe + Signaler(R, e), r.etatCeinture(e)); assertNull(r.detenteur)
        }
    }

    @Test
    fun `décrochée sous S signalée, détenteur gardé`() {
        val r = sous(S)
        assertEquals(listOf(Signaler(S, DECROCHEE), DesarmerSilence), r.etatCeinture(DECROCHEE))
        assertEquals(S, r.detenteur)
    }

    @Test
    fun `état sans détenteur ignoré`() {
        assertEquals(aucun(), Relais().etatCeinture(CONNECTEE))
    }

    @Test
    fun `radio coupée sous R coupe`() {
        val r = sous(R)
        assertEquals(coupe + Signaler(R, DECROCHEE), r.radio(false)); assertNull(r.detenteur)
    }

    @Test
    fun `radio coupée puis revenue sous S relance`() {
        val r = sous(S)
        assertEquals(coupe + Signaler(S, DECROCHEE), r.radio(false)); assertEquals(S, r.detenteur)
        assertEquals(listOf(Lancer), r.radio(true))
    }

    @Test
    fun `radio revenue deux fois ne relance qu'une fois`() {
        val r = sous(S); r.radio(false); r.radio(false)
        assertEquals(listOf(Lancer), r.radio(true))
        assertEquals(aucun(), r.radio(true))
    }

    @Test
    fun `radio revenue après un échec sous S relance`() {
        assertEquals(coupe + Lancer, sous(S, ECHEC).radio(true))
    }

    @Test
    fun `radio revenue sans coupure ne relance rien`() {
        assertEquals(aucun(), sous(S).radio(true))
    }

    @Test
    fun `appQuittee sous S ne coupe rien`() {
        val r = sous(S)
        assertEquals(aucun(), r.appQuittee()); assertEquals(S, r.detenteur)
    }

    @Test
    fun `appQuittee sous R coupe`() {
        val r = sous(R)
        assertEquals(coupe + Signaler(R, DECROCHEE), r.appQuittee()); assertNull(r.detenteur)
    }

    @Test
    fun `reconnecte suit le détenteur`() {
        val r = sous(R); assertFalse(r.reconnecte)
        r.prendre(S); assertTrue(r.reconnecte)
        r.rendre(); assertFalse(r.reconnecte)
    }
}
