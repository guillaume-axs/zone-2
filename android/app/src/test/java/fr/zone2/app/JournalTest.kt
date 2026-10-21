package fr.zone2.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

class JournalTest {

    @Test
    fun `depart sans bornes`() {
        assertEquals("D,1000,abc,-,-\n", Journal.depart("abc", 1000, null, null))
    }

    @Test
    fun `depart avec bornes`() {
        assertEquals("D,1000,abc,120,135\n", Journal.depart("abc", 1000, 120, 135))
    }

    @Test
    fun `trame avec contact et rr`() {
        val b = Battement(128, true, listOf(800, 812))
        assertEquals("B,2000,128,1,800;812\n", Journal.trame(2000, b))
    }

    @Test
    fun `trame sans contact connu`() {
        val b = Battement(128, null, listOf(800))
        assertEquals("B,2000,128,-,800\n", Journal.trame(2000, b))
    }

    @Test
    fun `trame sans rr`() {
        val b = Battement(128, true, emptyList())
        assertEquals("B,2000,128,1,\n", Journal.trame(2000, b))
    }

    @Test
    fun `liaison, relance et fin`() {
        assertEquals("C,5,CONNECTE\n", Journal.liaison(5, "CONNECTE"))
        assertEquals("R,6\n", Journal.relance(6))
        assertEquals("S,7\n", Journal.fin(7))
    }

    @Test
    fun `compter credite l'intervalle quand la trame de debut est dans la zone`() {
        val c = Compteurs()
        c.compter(1000, 130, 120, 135)
        c.compter(2000, 130, 120, 135)
        c.compter(3000, 150, 120, 135)
        c.compter(4000, 130, 120, 135)
        assertEquals(2000L, c.enZoneMs)
        assertEquals(4000L, c.derniereMs)
        assertEquals(130, c.dernierBpm)
    }

    @Test
    fun `compter ne credite pas un silence de plus de 5 s`() {
        val c = Compteurs()
        c.compter(1000, 130, 120, 135)
        c.compter(7000, 130, 120, 135)
        assertEquals(0L, c.enZoneMs)
    }

    @Test
    fun `compter sans bornes ne credite rien`() {
        val c = Compteurs()
        c.compter(1000, 130, null, null)
        c.compter(2000, 130, null, null)
        assertEquals(0L, c.enZoneMs)
    }

    private fun journal() =
        Journal.depart("abc", 500, 120, 135) +
            Journal.trame(1000, Battement(130, true, emptyList())) +
            Journal.trame(2000, Battement(130, true, emptyList())) +
            Journal.trame(3000, Battement(150, true, emptyList())) +
            Journal.relance(3500)

    @Test
    fun `rejouer ignore la ligne coupee`() {
        val attendu = Journal.rejouer(journal(), 120, 135)
        val avecCoupe = Journal.rejouer(journal() + "B,40", 120, 135)
        assertEquals(2000L, attendu.enZoneMs)
        assertEquals(attendu.enZoneMs, avecCoupe.enZoneMs)
        assertEquals(attendu.derniereMs, avecCoupe.derniereMs)
        assertEquals(attendu.dernierBpm, avecCoupe.dernierBpm)
    }

    @Test
    fun `rejouer ignore un dernier fragment sans retour a la ligne meme lisible`() {
        val texte = Journal.trame(1000, Battement(130, true, emptyList())) +
            Journal.trame(2000, Battement(130, true, emptyList())) +
            "B,3000,130,1,"
        val c = Journal.rejouer(texte, 120, 135)
        assertEquals(1000L, c.enZoneMs)
        assertEquals(2000L, c.derniereMs)
    }

    @Test
    fun `rejouer ignore une ligne complete mal formee`() {
        val texte = Journal.trame(1000, Battement(130, true, emptyList())) +
            "B,abc,130,1,\n" + "B,2000,xx,1,\n" + "B,2000,130\n" +
            Journal.trame(2000, Battement(130, true, emptyList()))
        assertEquals(1000L, Journal.rejouer(texte, 120, 135).enZoneMs)
    }

    @Test
    fun `rejouer sur un texte vide ou sans retour a la ligne`() {
        assertNull(Journal.rejouer("", 120, 135).derniereMs)
        assertNull(Journal.rejouer("B,1000,130,1,", 120, 135).derniereMs)
    }

    @Test
    fun `rejouer sur un journal sans trame`() {
        val c = Journal.rejouer(Journal.depart("abc", 500, null, null), null, null)
        assertEquals(0L, c.enZoneMs)
        assertNull(c.derniereMs)
    }

    @Test
    fun `bornes inclusives et ecart de 5 s exactement credites`() {
        val c = Compteurs()
        c.compter(0, 120, 120, 135)
        c.compter(5000, 135, 120, 135)
        c.compter(10000, 135, 120, 135)
        assertEquals(10000L, c.enZoneMs)
    }

    private fun fichier(texte: String) = File.createTempFile("journal", ".log").apply {
        deleteOnExit()
        writeText(texte)
    }

    @Test
    fun `couperReste retire le fragment final`() {
        val f = fichier("D,1000,abc,-,-\nB,2000,130,1,800\nB,30")
        Journal.couperReste(f)
        assertEquals("D,1000,abc,-,-\nB,2000,130,1,800\n", f.readText())
    }

    @Test
    fun `couperReste laisse un journal complet intact`() {
        val f = fichier("D,1000,abc,-,-\nS,2000\n")
        Journal.couperReste(f)
        assertEquals("D,1000,abc,-,-\nS,2000\n", f.readText())
    }

    @Test
    fun `couperReste vide un fichier sans aucune ligne complete`() {
        val f = fichier("D,1000,ab")
        Journal.couperReste(f)
        assertEquals("", f.readText())
        val vide = fichier("")
        Journal.couperReste(vide)
        assertEquals("", vide.readText())
    }

    @Test
    fun `compte ecarte le contact perdu et les valeurs hors bornes`() {
        assertEquals(true, Journal.compte(0, 130, true, listOf(800)))
        assertEquals(true, Journal.compte(0, 130, null, emptyList()))
        assertEquals(false, Journal.compte(0, 130, false, listOf(800)))
        assertEquals(false, Journal.compte(-1, 130, true, emptyList()))
        assertEquals(false, Journal.compte(0, 256, true, emptyList()))
        assertEquals(false, Journal.compte(0, 130, true, listOf(0)))
    }

    @Test
    fun `rejouer saute le contact perdu comme un trou`() {
        // 130 dans la zone de 1000 à 2000, puis 3 s sans contact : la trame de
        // 5000 est à 3 s de la dernière qui compte, rien n'est crédité de plus.
        val texte = Journal.depart("abc", 500, 120, 135) +
            Journal.trame(1000, Battement(150, true, emptyList())) +
            Journal.trame(2000, Battement(130, true, emptyList())) +
            Journal.trame(3000, Battement(130, false, emptyList())) +
            Journal.trame(4000, Battement(130, false, emptyList())) +
            Journal.trame(8000, Battement(130, null, emptyList()))
        val c = Journal.rejouer(texte, 120, 135)
        assertEquals(0L, c.enZoneMs)
        assertEquals(8000L, c.derniereMs)
    }

    @Test
    fun `rejouer saute une trame hors bornes et lit la suite`() {
        val texte = Journal.depart("abc", 500, 120, 135) +
            Journal.trame(1000, Battement(130, true, emptyList())) +
            "B,1500,300,1,\n" + "B,1600,130,1,0\n" + "B,100,130,1,800\n" +
            Journal.trame(2000, Battement(130, true, emptyList()))
        val c = Journal.rejouer(texte, 120, 135)
        assertEquals(1000L, c.enZoneMs)
        assertEquals(2000L, c.derniereMs)
    }
}
