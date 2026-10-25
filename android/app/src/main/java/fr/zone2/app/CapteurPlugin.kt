package fr.zone2.app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.content.Intent
import android.os.Build
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * La ligne « Capteur cardio » des Réglages (sujet 16).
 *
 * Sans service : quitter l'app coupe la liaison et garde l'adresse — c'est un
 * décrochage. Une notification permanente pour de l'appairage ne vaudrait pas
 * son prix.
 *
 * Deux signaux vers le JavaScript : `etat` (le nom d'un [Ceinture.Etat], plus
 * le nom de l'appareil) et `fc` (les bpm). La FC n'est écrite nulle part
 * (sujet 11) : elle s'affiche, rien de plus.
 *
 * Chaque méthode répond tout de suite ; c'est `etat` qui dit ce qui se passe.
 * `connecter` répond `{ lance: false }` quand l'utilisateur a refusé le
 * Bluetooth : rien n'a démarré, la ligne reste à « Connecter ».
 *
 * La liaison elle-même est celle de [Liaison], que la séance reprend telle
 * quelle. Tant que la séance la tient, les Réglages n'y touchent pas. Les deux
 * pertes qu'Android ne signale pas — Bluetooth coupé, capteur muet plus de
 * 5 s — sont guettées là-bas et arrivent ici en `DECROCHEE` (sujet 16,
 * complément du 2026-10-10).
 */
@CapacitorPlugin(
    name = "Capteur",
    permissions = [
        Permission(
            strings = [Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT],
            alias = "bluetooth",
        ),
    ],
)
class CapteurPlugin : Plugin() {

    private val ecouteur = object : Liaison.Ecouteur {
        override fun etat(e: Ceinture.Etat, nom: String?) {
            notifyListeners("etat", JSObject().put("etat", e.name).put("nom", nom))
        }

        override fun battement(b: Battement) {
            if (b.porte) notifyListeners("fc", JSObject().put("bpm", b.bpm))
        }
    }

    override fun load() {
        Liaison.ecouteur(Relais.Detenteur.REGLAGES, ecouteur)
    }

    override fun handleOnDestroy() {
        Liaison.lacher(Relais.Detenteur.REGLAGES, ecouteur)
        super.handleOnDestroy()
    }

    @PluginMethod
    fun connecter(call: PluginCall) {
        // Avant Android 12, chercher et se connecter n'étaient pas des
        // permissions d'exécution : il n'y a rien à demander.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return activer(call)
        when (getPermissionState("bluetooth")) {
            PermissionState.GRANTED -> activer(call)
            // Refus définitif : Android ne reposera plus la question, seule
            // la page de l'application dans ses paramètres peut la rouvrir.
            PermissionState.DENIED -> {
                Liaison.ouvrirParametres(activity)
                refuse(call)
            }
            else -> requestPermissionForAlias("bluetooth", call, "apresPermission")
        }
    }

    @PermissionCallback
    private fun apresPermission(call: PluginCall) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) activer(call) else refuse(call)
    }

    /** Bluetooth coupé : la demande d'Android, un appui pour le rallumer. */
    private fun activer(call: PluginCall) {
        if (Liaison.radioAllumee(context)) return lancer(call)
        startActivityForResult(call, Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "apresActivation")
    }

    @ActivityCallback
    private fun apresActivation(call: PluginCall, @Suppress("UNUSED_PARAMETER") resultat: ActivityResult) {
        if (Liaison.radioAllumee(context)) lancer(call) else refuse(call)
    }

    /** `lance: false` aussi quand la séance tient la liaison : les Réglages n'y touchent pas. */
    private fun lancer(call: PluginCall) {
        Liaison.prendre(context, Relais.Detenteur.REGLAGES) { pris -> call.resolve(JSObject().put("lance", pris)) }
    }

    private fun refuse(call: PluginCall) = call.resolve(JSObject().put("lance", false))

    @PluginMethod
    fun annuler(call: PluginCall) {
        Liaison.fermer(Relais.Detenteur.REGLAGES)
        call.resolve()
    }

    /** Volontaire : on oublie l'adresse, le capteur choisi n'était peut-être pas le bon. */
    @PluginMethod
    fun deconnecter(call: PluginCall) {
        Liaison.oublier(Relais.Detenteur.REGLAGES)
        Liaison.fermer(Relais.Detenteur.REGLAGES)
        call.resolve()
    }

    /** Quitter l'application vaut décrochage (sujet 16) ; pendant une séance, rien ne change. */
    override fun handleOnStop() {
        super.handleOnStop()
        Liaison.appQuittee()
    }
}
