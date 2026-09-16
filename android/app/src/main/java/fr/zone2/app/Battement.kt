package fr.zone2.app

/**
 * Un battement tel que la ceinture l'a envoyé.
 *
 * @property bpm       fréquence cardiaque instantanée, en battements par minute.
 * @property contact   la ceinture touche-t-elle la peau ? `null` si elle ne sait
 *                     pas le dire — une électrode sèche et une liaison morte se
 *                     ressemblent beaucoup dans un journal, il faut pouvoir les
 *                     distinguer après coup.
 * @property rr        intervalles entre deux ondes R, en millisecondes, **du plus
 *                     ancien au plus récent**. Leur nombre est instructif à lui
 *                     seul : plus d'un par trame signifie que la ceinture a mis
 *                     des battements en file, donc que nous n'étions pas là pour
 *                     les recevoir au moment où ils sont nés.
 */
data class Battement(
    val bpm: Int,
    val contact: Boolean?,
    val rr: List<Int>,
)

/**
 * Décode la caractéristique « Heart Rate Measurement » (`0x2A37`) du service
 * standard `0x180D`, tel que le Bluetooth SIG le définit.
 *
 * Le premier octet est un jeu de drapeaux qui décide de la forme de tout le
 * reste — la trame est de longueur variable, et deux trames successives de la
 * même ceinture peuvent ne pas avoir la même taille :
 *
 * ```
 * bit 0  largeur de la fréquence : 0 → un octet, 1 → deux octets (petit-boutien)
 * bit 1  contact peau détecté          ┐ n'a de sens que si le bit 2 vaut 1
 * bit 2  contact peau géré par le capteur ┘
 * bit 3  champ « énergie dépensée » présent (deux octets, sans intérêt ici)
 * bit 4  intervalles RR présents
 * ```
 *
 * Les RR sont des entiers de deux octets en petit-boutien, exprimés en 1/1024ᵉ
 * de seconde. On les convertit en millisecondes : c'est l'unité dans laquelle
 * toute la littérature sur la variabilité cardiaque raisonne, et l'arrondi
 * inférieur au millième coûte moins de 0,1 % sur des valeurs autour de 1000.
 *
 * @return `null` si la trame est trop courte pour être lue. **Ce cas ne doit
 *   jamais interrompre l'enregistrement** : une trame illisible est un battement
 *   perdu, pas une séance perdue.
 */
fun lireBattement(octets: ByteArray): Battement? {
    // Un octet de drapeaux et au moins un octet de fréquence.
    if (octets.size < 2) return null

    val drapeaux = octets.octet(0)
    var i = 1

    val bpm: Int
    if (drapeaux and 0x01 != 0) {
        if (octets.size < 3) return null
        bpm = octets.octet(1) or (octets.octet(2) shl 8)
        i = 3
    } else {
        bpm = octets.octet(1)
        i = 2
    }

    val contact = if (drapeaux and 0x04 != 0) drapeaux and 0x02 != 0 else null

    if (drapeaux and 0x08 != 0) i += 2

    val rr = mutableListOf<Int>()
    if (drapeaux and 0x10 != 0) {
        // `i + 1` : un octet solitaire en fin de trame est une demi-valeur, on
        // l'abandonne plutôt que d'inventer sa moitié manquante.
        while (i + 1 < octets.size) {
            val brut = octets.octet(i) or (octets.octet(i + 1) shl 8)
            rr += brut * 1000 / 1024
            i += 2
        }
    }

    return Battement(bpm, contact, rr)
}

/** Un `Byte` est signé en Kotlin : sans ce masque, 0xFF vaudrait -1. */
private fun ByteArray.octet(i: Int) = this[i].toInt() and 0xFF
