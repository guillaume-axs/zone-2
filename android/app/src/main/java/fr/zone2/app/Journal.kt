package fr.zone2.app

/**
 * Temps passé dans la zone, cumulé trame après trame.
 *
 * L'intervalle entre deux trames est crédité si la **trame précédente** était
 * dans la zone et si l'écart ne dépasse pas [Journal.SILENCE_MS] : au-delà, la
 * ceinture s'est tue et on ne sait pas ce qui s'est passé.
 */
class Compteurs(
    var enZoneMs: Long = 0,
    var derniereMs: Long? = null,
    var dernierBpm: Int? = null,
) {
    fun compter(ms: Long, bpm: Int, min: Int?, max: Int?) {
        val avant = derniereMs
        val bpmAvant = dernierBpm
        if (avant != null && bpmAvant != null && min != null && max != null &&
            ms - avant <= Journal.SILENCE_MS && bpmAvant in min..max
        ) {
            enZoneMs += ms - avant
        }
        derniereMs = ms
        dernierBpm = bpm
    }
}

/**
 * Format du journal de séance, une ligne par événement, toujours terminée par
 * `\n` :
 *
 * ```
 * D,<debutMs>,<uuid>,<min|->,<max|->     première ligne, toujours
 * B,<ms>,<bpm>,<contact 1|0|->,<rr;rr>   une trame (rr vide permis)
 * C,<ms>,<ETAT>                          événement de liaison
 * R,<ms>                                 service relancé par Android
 * S,<ms>                                 fin demandée
 * ```
 *
 * `<ms>` est l'heure absolue (`System.currentTimeMillis()`).
 */
object Journal {
    const val SILENCE_MS = 5_000L

    fun depart(id: String, debutMs: Long, min: Int?, max: Int?): String =
        "D,$debutMs,$id,${min ?: "-"},${max ?: "-"}\n"

    fun trame(ms: Long, b: Battement): String {
        val contact = when (b.contact) {
            true -> "1"
            false -> "0"
            null -> "-"
        }
        return "B,$ms,${b.bpm},$contact,${b.rr.joinToString(";")}\n"
    }

    fun liaison(ms: Long, etat: String): String = "C,$ms,$etat\n"

    fun relance(ms: Long): String = "R,$ms\n"

    fun fin(ms: Long): String = "S,$ms\n"

    /**
     * Rejoue le journal (son texte entier) pour retrouver les compteurs.
     * Tout ce qui suit le dernier `\n` est un reste coupé par un arrêt brutal :
     * il est ignoré même s'il se lit encore. Seules les lignes `B` bien formées
     * comptent.
     */
    fun rejouer(texte: String, min: Int?, max: Int?): Compteurs {
        val c = Compteurs()
        val complet = texte.substring(0, texte.lastIndexOf('\n') + 1)
        for (ligne in complet.split('\n')) {
            val p = ligne.split(",")
            if (p.size != 5 || p[0] != "B") continue
            val ms = p[1].toLongOrNull() ?: continue
            val bpm = p[2].toIntOrNull() ?: continue
            c.compter(ms, bpm, min, max)
        }
        return c
    }
}
