package fr.zone2.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject

/**
 * Pont vers [SeanceService], le service de séance (`src/seance/greffon.ts`).
 *
 * `ecouter` lance le service, qui se connecte et relaie la FC (`fc`, `etat`) ;
 * `demarrer` ouvre l'enregistrement ; `terminer` ne répond qu'une fois le
 * journal fermé. `journaux` et `effacer` servent le rangement : un journal se
 * lit, se range en base, et ne s'efface qu'ensuite.
 *
 * « Séance en cours » = celle que le service vivant tient en mémoire. Sans
 * service, il n'y en a pas : la séance tuée est un orphelin à ranger (Q1).
 * Le greffon ne lit ni n'écrit jamais les préférences du service. L'ancien
 * `*.log` du PoC n'est jamais listé.
 */
@CapacitorPlugin(
    name = "Seance",
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
class SeancePlugin : Plugin() {

    private val relais: (String, JSObject) -> Unit = { e, d -> notifyListeners(e, d) }

    override fun load() {
        SeanceService.auditeur = relais
    }

    override fun handleOnDestroy() {
        // Une activité recréée a peut-être déjà branché son propre relais.
        if (SeanceService.auditeur === relais) SeanceService.auditeur = null
        super.handleOnDestroy()
    }

    @PluginMethod
    fun ecouter(call: PluginCall) {
        // Sans cette permission le service tourne quand même, mais sa
        // notification reste invisible — le seul retour écran verrouillé.
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
            // Refus : rien n'a démarré, comme la ligne Capteur (sujet 16).
            call.resolve(JSObject().put("lance", false))
            return
        }
        lancer(call)
    }

    private fun lancer(call: PluginCall) {
        context.startForegroundService(
            Intent(context, SeanceService::class.java).setAction(SeanceService.ACTION_ECOUTER),
        )
        call.resolve(JSObject().put("lance", true))
    }

    /**
     * On quitte l'écran Démarrer : le service s'arrête, sauf séance en cours.
     * Envoyé sans condition : juste après `ecouter`, le service n'est peut-être
     * pas encore créé, et c'est lui qui décide, sur son fil.
     */
    @PluginMethod
    fun lacher(call: PluginCall) {
        context.startService(
            Intent(context, SeanceService::class.java).setAction(SeanceService.ACTION_LACHER),
        )
        call.resolve()
    }

    /** `min` et `max` absents : pas de zone réglée (Q2), la séance démarre quand même. */
    @PluginMethod
    fun demarrer(call: PluginCall) {
        val min = call.getInt("min")
        val max = call.getInt("max")
        // Les deux bornes ou aucune : une seule ferait un temps en zone toujours nul, sans le dire.
        if ((min == null) != (max == null)) return call.reject("Zone incomplète : min et max vont ensemble.")
        if (min != null && max != null && !(min in 1..max && max <= 255)) {
            return call.reject("Zone invalide : il faut 1 ≤ min ≤ max ≤ 255.")
        }
        val service = SeanceService.enCours ?: return call.reject("La ceinture n'est pas écoutée.")
        service.demarrer(min, max) { a ->
            if (a == null) {
                call.reject("Le service de séance s'est arrêté.")
            } else {
                call.resolve(JSObject().put("id", a.id).put("debutMs", a.debutMs))
            }
        }
    }

    /** Répond après la fermeture du journal ; `id` à `null` s'il n'y avait pas de séance. */
    @PluginMethod
    fun terminer(call: PluginCall) {
        val service = SeanceService.enCours ?: return call.resolve(JSObject().put("id", JSONObject.NULL))
        service.terminer { id ->
            call.resolve(JSObject().put("id", id ?: JSONObject.NULL))
        }
    }

    @PluginMethod
    fun seanceActive(call: PluginCall) {
        val a = actif() ?: return call.resolve(JSObject())
        call.resolve(JSObject().put("id", a.id).put("debutMs", a.debutMs))
    }

    @PluginMethod
    fun instantane(call: PluginCall) {
        call.resolve(SeanceService.enCours?.instantane() ?: JSObject())
    }

    /** Les journaux à ranger : tous les `seance-<uuid>.log`, moins celui de la séance en cours. */
    @PluginMethod
    fun journaux(call: PluginCall) {
        val actif = actif()?.id
        val liste = JSArray()
        context.filesDir.listFiles().orEmpty()
            .mapNotNull { f -> NOM.matchEntire(f.name)?.groupValues?.get(1)?.let { it to f } }
            .filter { (id, _) -> id != actif }
            .forEach { (id, f) ->
                // Illisible aujourd'hui, il reste sur le disque : le lancement suivant réessaie.
                runCatching { f.readText() }
                    .onSuccess { liste.put(JSObject().put("id", id).put("contenu", it)) }
                    .onFailure { Log.w(TAG, "Journal $id illisible sur le disque", it) }
            }
        call.resolve(JSObject().put("journaux", liste))
    }

    /** Efface un journal rangé. Jamais celui de la séance en cours. */
    @PluginMethod
    fun effacer(call: PluginCall) {
        val id = call.getString("id")
        if (id == null || !ID.matches(id)) return call.reject("Identifiant de journal invalide.")
        if (id == actif()?.id) return call.reject("La séance en cours ne s'efface pas.")
        val f = SeanceService.fichier(context, id)
        if (f.exists() && !f.delete()) return call.reject("Journal impossible à effacer.")
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

    /** La séance tenue en mémoire par le service vivant, s'il y en a un. */
    private fun actif(): SeanceService.Active? = SeanceService.enCours?.seanceEnCours

    private companion object {
        const val TAG = "SeancePlugin"

        /** Un UUID tel que le tire le service : refuse tout chemin glissé dans l'id. */
        val ID = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
        val NOM = Regex("${SeanceService.PREFIXE}(${ID.pattern})\\.log")
    }
}
