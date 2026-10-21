package fr.zone2.app

import java.io.File
import java.io.RandomAccessFile

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

    /**
     * La trame compte-t-elle ? Sans contact (`0`), le H10 ôté de la sangle
     * émet encore une FC figée : c'est un trou, pas une mesure (sujet 11).
     * Hors des bornes de `trameSchema` (journal.ts), elle est perdue seule,
     * pas la séance. Ces trames restent écrites ; le compteur en direct,
     * [rejouer] et `lireJournal` les sautent tous trois.
     *
     * @param tMs instant de la trame depuis le début de la séance.
     */
    fun compte(tMs: Long, bpm: Int, contact: Boolean?, rr: List<Int>): Boolean =
        contact != false && tMs >= 0 && bpm in 0..255 && rr.all { it > 0 }

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
     * Retire du fichier le reste de ligne qui suit le dernier `\n` (arrêt
     * brutal, écriture coupée). Sans ça, la ligne suivante s'y collerait et
     * ferait une ligne illisible au milieu, donc un journal illisible. Ce
     * reste n'a jamais été lisible. Crée le fichier s'il manque.
     */
    fun couperReste(f: File) {
        RandomAccessFile(f, "rw").use { r ->
            var n = r.length()
            while (n > 0) {
                r.seek(n - 1)
                if (r.read() == '\n'.code) break
                n--
            }
            r.setLength(n)
        }
    }

    /**
     * Rejoue le journal (son texte entier) pour retrouver les compteurs.
     * Tout ce qui suit le dernier `\n` est un reste coupé par un arrêt brutal :
     * il est ignoré même s'il se lit encore. Seules les lignes `B` bien formées
     * et qui [compte]nt sont comptées.
     */
    fun rejouer(texte: String, min: Int?, max: Int?): Compteurs {
        val c = Compteurs()
        val complet = texte.substring(0, texte.lastIndexOf('\n') + 1)
        val d = complet.substringBefore('\n').split(",")
        val debutMs = if (d.size == 5 && d[0] == "D") d[1].toLongOrNull() ?: 0L else 0L
        for (ligne in complet.split('\n')) {
            val p = ligne.split(",")
            if (p.size != 5 || p[0] != "B") continue
            val ms = p[1].toLongOrNull() ?: continue
            val bpm = p[2].toIntOrNull() ?: continue
            val contact = when (p[3]) {
                "1" -> true
                "0" -> false
                "-" -> null
                else -> continue
            }
            val rr = if (p[4].isEmpty()) emptyList() else p[4].split(";").map { it.toIntOrNull() ?: -1 }
            if (rr.any { it < 0 }) continue
            if (compte(ms - debutMs, bpm, contact, rr)) c.compter(ms, bpm, min, max)
        }
        return c
    }
}
