package fr.zone2.app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
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
 * La liaison vit ici, avec l'application au premier plan, sans service : la
 * quitter coupe la liaison et garde l'adresse — c'est un décrochage. Une
 * notification permanente pour de l'appairage ne vaudrait pas son prix.
 *
 * Deux signaux vers le JavaScript : `etat` (le nom d'un [Ceinture.Etat], plus
 * le nom de l'appareil) et `fc` (les bpm). La FC n'est écrite nulle part
 * (sujet 11) : elle s'affiche, rien de plus.
 *
 * Chaque méthode répond tout de suite ; c'est `etat` qui dit ce qui se passe.
 * `connecter` répond `{ lance: false }` quand l'utilisateur a refusé le
 * Bluetooth : rien n'a démarré, la ligne reste à « Connecter ».
 *
 * Deux pertes qu'Android ne signale pas, traitées ici comme un décrochage
 * (sujet 16, complément du 2026-10-10) : le Bluetooth coupé — depuis
 * Android 10, la connexion ne prévient plus — et un capteur resté connecté
 * qui se tait plus de 5 s, sangle ôtée par exemple.
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

    private val fil = Handler(Looper.getMainLooper())
    private var ceinture: Ceinture? = null

    private val silence = Runnable { decrocher() }

    private val radio = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            val etat = i.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
            if (etat == BluetoothAdapter.STATE_TURNING_OFF || etat == BluetoothAdapter.STATE_OFF) {
                fil.post { decrocher() }
            }
        }
    }

    override fun load() {
        ContextCompat.registerReceiver(
            context,
            radio,
            IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun handleOnDestroy() {
        context.unregisterReceiver(radio)
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
                activity.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                        .setData(Uri.fromParts("package", context.packageName, null)),
                )
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
        if (adaptateur()?.isEnabled == true) return lancer(call)
        startActivityForResult(call, Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "apresActivation")
    }

    @ActivityCallback
    private fun apresActivation(call: PluginCall, @Suppress("UNUSED_PARAMETER") resultat: ActivityResult) {
        if (adaptateur()?.isEnabled == true) lancer(call) else refuse(call)
    }

    private fun lancer(call: PluginCall) {
        ceinture?.arreter()
        ceinture = Ceinture(context, fil, reconnecter = false, ::battement, ::etat).also { it.demarrer() }
        call.resolve(JSObject().put("lance", true))
    }

    private fun refuse(call: PluginCall) = call.resolve(JSObject().put("lance", false))

    @PluginMethod
    fun annuler(call: PluginCall) {
        couper()
        call.resolve()
    }

    /** Volontaire : on oublie l'adresse, le capteur choisi n'était peut-être pas le bon. */
    @PluginMethod
    fun deconnecter(call: PluginCall) {
        ceinture?.oublier()
        couper()
        call.resolve()
    }

    /** Quitter l'application vaut décrochage (sujet 16). */
    override fun handleOnStop() {
        super.handleOnStop()
        decrocher()
    }

    /** Coupe en gardant l'adresse, et l'annonce : la ligne revient à « Connecter ». */
    private fun decrocher() {
        if (ceinture == null) return
        couper()
        notifyListeners("etat", JSObject().put("etat", Ceinture.Etat.DECROCHEE.name))
    }

    private fun couper() {
        fil.removeCallbacks(silence)
        ceinture?.arreter()
        ceinture = null
    }

    /** Connecté, le capteur doit parler : chaque battement relance le délai. */
    private fun guetter() {
        fil.removeCallbacks(silence)
        fil.postDelayed(silence, SILENCE_MS)
    }

    private fun adaptateur() = context.getSystemService(BluetoothManager::class.java)?.adapter

    private fun battement(b: Battement) {
        guetter()
        notifyListeners("fc", JSObject().put("bpm", b.bpm))
    }

    private fun etat(e: Ceinture.Etat) {
        if (e == Ceinture.Etat.CONNECTEE) guetter()
        notifyListeners("etat", JSObject().put("etat", e.name).put("nom", ceinture?.nom))
    }

    private companion object {
        /** Le seuil de la ceinture muette, le même que sur l'écran de séance (sujet 12). */
        const val SILENCE_MS = 5_000L
    }
}
