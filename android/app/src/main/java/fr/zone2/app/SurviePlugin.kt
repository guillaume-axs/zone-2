package fr.zone2.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File

/**
 * Pont entre l'écran de diagnostic et [SurvieService].
 *
 * L'analyse du journal est faite ici, en natif, et pas côté JavaScript : quatre
 * heures de test font environ 14 400 lignes, qu'il n'y a aucune raison de faire
 * traverser au pont pour les recompter de l'autre côté.
 */
@CapacitorPlugin(
    name = "Survie",
    permissions = [
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
        Permission(
            strings = [
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
            ],
            alias = "bluetooth",
        ),
    ],
)
class SurviePlugin : Plugin() {

    @PluginMethod
    fun demarrer(call: PluginCall) {
        // Sans cette permission le service tourne quand même, mais sa notification
        // reste invisible — et une notification qu'on ne voit pas est un test
        // qu'on ne peut pas surveiller.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "apresNotifications")
            return
        }
        apresNotifications(call)
    }

    @PermissionCallback
    private fun apresNotifications(call: PluginCall) {
        // Avant Android 12, la recherche et la connexion Bluetooth n'étaient pas
        // des permissions d'exécution : les demander échouerait.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetooth") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("bluetooth", call, "apresBluetooth")
            return
        }
        lancer(call)
    }

    @PermissionCallback
    private fun apresBluetooth(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetooth") != PermissionState.GRANTED
        ) {
            // Refus explicite : démarrer quand même donnerait quatre heures de
            // silence et un verdict qu'on croirait technique.
            call.reject("Sans accès au Bluetooth, la ceinture est introuvable.")
            return
        }
        lancer(call)
    }

    private fun lancer(call: PluginCall) {
        context.startForegroundService(
            Intent(context, SurvieService::class.java).setAction(SurvieService.ACTION_DEMARRER),
        )
        call.resolve()
    }

    @PluginMethod
    fun arreter(call: PluginCall) {
        context.startService(
            Intent(context, SurvieService::class.java).setAction(SurvieService.ACTION_ARRETER),
        )
        call.resolve()
    }

    /** Ouvre le réglage système d'exemption d'optimisation batterie. */
    @PluginMethod
    fun exemptionBatterie(call: PluginCall) {
        context.startActivity(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                .setData(Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        call.resolve()
    }

    /**
     * Dépouille le journal.
     *
     * Le verdict de l'étage 1 comptait des trous dans une série régulière. Celui
     * de l'étage 2 répond à une autre question : **sur la durée du test, combien
     * de temps a-t-on passé sans donnée, et quelle part de ce temps la liaison
     * se croyait-elle vivante ?** Cette part est la panne silencieuse — la seule
     * qu'aucune alarme ne signale, et la seule qui fausserait une séance sans
     * que personne ne s'en aperçoive.
     */
    @PluginMethod
    fun etat(call: PluginCall) {
        var debut = 0L
        var fin = 0L
        var precedent = 0L
        var battements = 0L
        var sansContact = 0L
        var tramesGroupees = 0L
        var trouMax = 0L
        var ecartsMs = 0L
        var deconnecteMs = 0L
        var delaiConnexionMs = 0L
        var depuisDecrochage = 0L
        var decrochages = 0L
        var retours = 0L
        var redemarrages = 0L
        var batterieDebut = -1
        var arretPropre = false

        val f = File(context.filesDir, SurvieService.FICHIER)
        if (f.exists()) {
            try {
                f.forEachLine { ligne ->
                    val c = ligne.split(",")
                    val t = c.getOrNull(1)?.toLongOrNull() ?: return@forEachLine
                    fin = t
                    when (c[0]) {
                        "D" -> {
                            debut = t
                            batterieDebut = c.getOrNull(2)?.toIntOrNull() ?: -1
                        }
                        // Une relance par Android referme le trou : le suivant
                        // se mesure à partir d'ici, pas depuis le dernier tick.
                        "R" -> {
                            redemarrages++
                            precedent = t
                        }
                        "S" -> arretPropre = true

                        "B" -> {
                            battements++
                            if (c.getOrNull(3) == "0") sansContact++
                            // Plus d'un intervalle dans une seule trame : la
                            // ceinture les avait mis en file, donc nous n'étions
                            // pas là pour les recevoir au moment de leur émission.
                            if ((c.getOrNull(4)?.count { it == ';' } ?: 0) > 0) tramesGroupees++
                            if (precedent > 0) {
                                val ecart = t - precedent
                                if (ecart > trouMax) trouMax = ecart
                                if (ecart > SEUIL_TROU_MS) ecartsMs += ecart
                            } else if (debut > 0) {
                                // Premier battement du test : l'écart depuis le
                                // démarrage est le temps de recherche et de
                                // connexion. Il ne doit pas grossir le plus long
                                // trou — ce n'est pas une panne — mais il ne doit
                                // pas non plus disparaître du compte : pendant ce
                                // temps-là, aucune donnée n'arrivait.
                                delaiConnexionMs = t - debut
                            }
                            precedent = t
                        }

                        "C" -> when (c.getOrNull(2)) {
                            "DECROCHEE", "ECHEC" -> if (depuisDecrochage == 0L) {
                                decrochages++
                                depuisDecrochage = t
                            }
                            "CONNECTEE" -> if (depuisDecrochage > 0L) {
                                retours++
                                deconnecteMs += t - depuisDecrochage
                                depuisDecrochage = 0L
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                call.reject("Journal illisible : ${e.message}")
                return
            }
        }

        // Une liaison encore tombée à la fin du test : le décrochage court
        // toujours, il compte jusqu'à la dernière ligne écrite.
        if (depuisDecrochage > 0L) deconnecteMs += fin - depuisDecrochage

        val pm = context.getSystemService(PowerManager::class.java)
        val bm = context.getSystemService(BatteryManager::class.java)

        call.resolve(
            JSObject()
                .put("actif", SurvieService.actif)
                .put("etatLiaison", SurvieService.etat)
                .put("bpm", SurvieService.dernierBpm)
                .put("debut", debut)
                .put("fin", fin)
                .put("dureeMs", if (debut > 0) fin - debut else 0L)
                .put("battements", battements)
                .put("sansContact", sansContact)
                .put("tramesGroupees", tramesGroupees)
                // Ces quatre valeurs s'additionnent exactement : le temps sans
                // donnée se décompose en connexion initiale, décrochages
                // détectés, et le reste — le silence pendant lequel la liaison
                // se croyait vivante. C'est ce reste qui compte vraiment.
                .put("sansBattementMs", delaiConnexionMs + ecartsMs)
                .put("delaiConnexionMs", delaiConnexionMs)
                .put("deconnecteMs", deconnecteMs)
                .put("silencieuxMs", (ecartsMs - deconnecteMs).coerceAtLeast(0L))
                .put("trouMax", trouMax)
                .put("decrochages", decrochages)
                .put("retours", retours)
                .put("definitifs", if (depuisDecrochage > 0L) 1 else 0)
                .put("redemarrages", redemarrages)
                .put("arretPropre", arretPropre)
                .put("batterieDebut", batterieDebut)
                .put("batterie", bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1)
                .put("exempteBatterie", pm?.isIgnoringBatteryOptimizations(context.packageName) == true),
        )
    }

    companion object {
        /**
         * Deux battements attendus manqués. En deçà, c'est la gigue normale
         * d'un capteur qui cadence à une seconde, pas un trou.
         */
        private const val SEUIL_TROU_MS = 2000L
    }
}
