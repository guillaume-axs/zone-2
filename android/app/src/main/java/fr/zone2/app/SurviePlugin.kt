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
    permissions = [Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications")],
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
        lancer(call)
    }

    @PermissionCallback
    private fun apresNotifications(call: PluginCall) = lancer(call)

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
     * Dépouille le journal. Le résultat est le verdict du PoC :
     * `trouMax` et `trous` disent si One UI nous a laissés vivre.
     */
    @PluginMethod
    fun etat(call: PluginCall) {
        var debut = 0L
        var fin = 0L
        var precedent = 0L
        var ticks = 0L
        var trouMax = 0L
        var trous = 0L
        var redemarrages = 0L
        var batterieDebut = -1
        var arretPropre = false

        val f = File(context.filesDir, SurvieService.FICHIER)
        if (f.exists()) {
            try {
                f.forEachLine { ligne ->
                    val c = ligne.split(",")
                    val t = c.getOrNull(1)?.toLongOrNull()
                    if (t != null) {
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
                            "T" -> {
                                ticks++
                                if (precedent > 0) {
                                    val ecart = t - precedent
                                    if (ecart > trouMax) trouMax = ecart
                                    if (ecart > SEUIL_TROU_MS) trous++
                                }
                                precedent = t
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                call.reject("Journal illisible : ${e.message}")
                return
            }
        }

        val pm = context.getSystemService(PowerManager::class.java)
        val bm = context.getSystemService(BatteryManager::class.java)

        call.resolve(
            JSObject()
                .put("actif", SurvieService.actif)
                .put("debut", debut)
                .put("fin", fin)
                .put("dureeMs", if (debut > 0) fin - debut else 0L)
                .put("ticks", ticks)
                // Une seconde par tick : l'écart entre l'attendu et le reçu est la perte.
                .put("attendus", if (debut > 0) (fin - debut) / 1000 else 0L)
                .put("trouMax", trouMax)
                .put("trous", trous)
                .put("redemarrages", redemarrages)
                .put("arretPropre", arretPropre)
                .put("batterieDebut", batterieDebut)
                .put("batterie", bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1)
                .put("exempteBatterie", pm?.isIgnoringBatteryOptimizations(context.packageName) == true),
        )
    }

    companion object {
        private const val SEUIL_TROU_MS = 5000L
    }
}
