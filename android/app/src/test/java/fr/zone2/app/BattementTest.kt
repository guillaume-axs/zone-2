package fr.zone2.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Le décodeur est la seule pièce de l'étage 2 vérifiable sans ceinture en face.
 * C'est aussi la plus facile à rater : un octet signé, un champ optionnel sauté
 * de travers, et la séance entière est fausse sans que rien ne le signale.
 */
class BattementTest {

    private fun trame(vararg o: Int) = ByteArray(o.size) { o[it].toByte() }

    @Test
    fun `fréquence sur un octet, sans rien d'autre`() {
        val b = lireBattement(trame(0x00, 60))!!
        assertEquals(60, b.bpm)
        assertNull(b.contact)
        assertTrue(b.rr.isEmpty())
    }

    @Test
    fun `un octet non signé va jusqu'à 255`() {
        assertEquals(255, lireBattement(trame(0x00, 0xFF))!!.bpm)
    }

    @Test
    fun `fréquence sur deux octets, petit-boutien`() {
        // 0x012C = 300
        assertEquals(300, lireBattement(trame(0x01, 0x2C, 0x01))!!.bpm)
    }

    @Test
    fun `contact peau géré et détecté`() {
        assertEquals(true, lireBattement(trame(0x06, 60))!!.contact)
    }

    @Test
    fun `contact peau géré mais absent — électrode sèche`() {
        assertEquals(false, lireBattement(trame(0x04, 60))!!.contact)
    }

    @Test
    fun `contact peau non géré — on ne conclut pas`() {
        // Le bit « détecté » est levé alors que le bit « géré » ne l'est pas :
        // il ne veut rien dire, et le lire vaudrait inventer une information.
        assertNull(lireBattement(trame(0x02, 60))!!.contact)
    }

    @Test
    fun `un intervalle RR, converti en millisecondes`() {
        // 1024 en 1/1024e de seconde = exactement une seconde.
        val b = lireBattement(trame(0x10, 60, 0x00, 0x04))!!
        assertEquals(listOf(1000), b.rr)
    }

    @Test
    fun `plusieurs intervalles RR, du plus ancien au plus récent`() {
        val b = lireBattement(trame(0x10, 60, 0x00, 0x04, 0x00, 0x02))!!
        assertEquals(listOf(1000, 500), b.rr)
    }

    @Test
    fun `le champ énergie dépensée est sauté avant les RR`() {
        // Drapeaux 0x18 : énergie présente (deux octets) puis RR.
        val b = lireBattement(trame(0x18, 60, 0xFF, 0xFF, 0x00, 0x04))!!
        assertEquals(60, b.bpm)
        assertEquals(listOf(1000), b.rr)
    }

    @Test
    fun `tout est combinable dans la même trame`() {
        // Deux octets de fréquence, contact géré et détecté, énergie, deux RR.
        val b = lireBattement(trame(0x1F, 0x2C, 0x01, 0xFF, 0xFF, 0x00, 0x04, 0x00, 0x02))!!
        assertEquals(300, b.bpm)
        assertEquals(true, b.contact)
        assertEquals(listOf(1000, 500), b.rr)
    }

    // --- trames abîmées : aucune ne doit lever d'exception -------------------

    @Test
    fun `trame vide`() = assertNull(lireBattement(trame()))

    @Test
    fun `drapeaux seuls, sans fréquence`() = assertNull(lireBattement(trame(0x00)))

    @Test
    fun `fréquence sur deux octets annoncée mais tronquée`() =
        assertNull(lireBattement(trame(0x01, 0x2C)))

    @Test
    fun `un demi intervalle RR en fin de trame est abandonné`() {
        val b = lireBattement(trame(0x10, 60, 0x00, 0x04, 0x37))!!
        assertEquals(listOf(1000), b.rr)
    }

    @Test
    fun `RR annoncés mais absents`() {
        assertTrue(lireBattement(trame(0x10, 60))!!.rr.isEmpty())
    }
}
