package fr.zone2.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Pont vers [SurvieService], le service de séance. L'écran de diagnostic du
 * PoC et son dépouillement du journal sont partis : le verdict est rendu
 * (sujet 15), la séance en direct importera le journal elle-même (sujet 11).
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
}
