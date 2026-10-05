package fr.zone2.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.ParcelUuid
import java.util.UUID

/**
 * La liaison avec la ceinture cardiaque.
 *
 * Elle parle le profil standard « Heart Rate » (`0x180D`), pas le dialecte
 * propriétaire de Polar : n'importe quelle ceinture ECG du marché fonctionne,
 * et rien ici ne dépend d'un SDK sous licence. Ce choix a été arbitré le
 * 2026-09-16 — la mémoire interne du H10, elle, exigerait le SDK Polar, et
 * n'a d'intérêt que si cette liaison se révèle peu fiable. C'est justement ce
 * que le PoC mesure.
 *
 * N'importe quel capteur qui parle ce service convient, ceinture ou brassard
 * optique (sujet 16) : rien ici ne suppose la forme de l'appareil.
 *
 * Les rappels sont délivrés sur le [fil] fourni. Le service de séance lui en
 * donne un à part, parce qu'il écrit sur le disque à chaque battement.
 *
 * [reconnecter] : le service de séance se rattache seul au capteur qui
 * décroche ; la ligne des Réglages, non — un décrochage la ramène à
 * « Connecter » (sujet 16).
 */
class Ceinture(
    private val context: Context,
    private val fil: Handler,
    private val reconnecter: Boolean,
    private val surBattement: (Battement) -> Unit,
    private val surEtat: (Etat) -> Unit,
) {

    /** [INTROUVABLE] : l'écoute a fini sans rien entendre. [ECHEC] : le Bluetooth n'a pas pu chercher, ou le capteur ne donne pas de FC. */
    enum class Etat { RECHERCHE, TROUVEE, CONNECTEE, DECROCHEE, INTROUVABLE, ECHEC }

    /** Le nom que le capteur donne de lui-même (« Polar H10 … »), connu dès qu'il est choisi. */
    var nom: String? = null
        private set

    private val bluetooth = context.getSystemService(BluetoothManager::class.java)
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private var gatt: BluetoothGatt? = null
    private var enRecherche = false
    private var arretDemande = false

    /** Les capteurs entendus pendant l'écoute, par adresse : le dernier signal de chacun. */
    private val entendus = mutableMapOf<String, ScanResult>()

    // --- cycle de vie -------------------------------------------------------

    fun demarrer() {
        arretDemande = false
        chercher()
    }

    /**
     * Coupe tout, sans rappel : celui qui arrête sait déjà pourquoi. L'adresse
     * reste mémorisée — c'est un décrochage, pas un choix (sujet 16).
     */
    @SuppressLint("MissingPermission")
    fun arreter() {
        arretDemande = true
        fil.removeCallbacks(chien)
        fil.removeCallbacks(finEcoute)
        fil.removeCallbacks(relance)
        arreterRecherche()
        gatt?.let {
            it.disconnect()
            it.close()
        }
        gatt = null
        nom = null
    }

    /** La déconnexion volontaire : le capteur choisi n'est plus le bon (sujet 16). */
    fun oublier() {
        prefs.edit().remove(CLE_ADRESSE).apply()
    }

    // --- recherche ----------------------------------------------------------

    @SuppressLint("MissingPermission")
    private fun chercher() {
        val scanner = bluetooth.adapter?.bluetoothLeScanner
        if (scanner == null) {
            surEtat(Etat.ECHEC)
            return
        }
        if (enRecherche) return
        enRecherche = true
        entendus.clear()
        surEtat(Etat.RECHERCHE)

        // Filtré sur le service cardiaque : une salle de sport est pleine
        // d'appareils Bluetooth, aucun intérêt à les voir passer.
        scanner.startScan(
            listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE)).build()),
            ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),
            chasse,
        )
        fil.postDelayed(finEcoute, ECOUTE_MS)
    }

    /**
     * La fin de l'écoute choisit (sujet 16) : le capteur mémorisé s'il a été
     * entendu, sinon le signal le plus fort — celui qu'on porte est à 30 cm,
     * celui du voisin de vélo à plusieurs mètres. L'adresse est mémorisée
     * sur ce téléphone seulement, jamais ailleurs : le dépôt est public (sujet 8).
     */
    private val finEcoute = Runnable {
        arreterRecherche()
        val choisi = entendus[prefs.getString(CLE_ADRESSE, null)]
            ?: entendus.values.maxByOrNull { it.rssi }
        entendus.clear()
        if (choisi == null) {
            surEtat(Etat.INTROUVABLE)
            if (reconnecter) fil.postDelayed(relance, RELANCE_MS)
            return@Runnable
        }
        prefs.edit().putString(CLE_ADRESSE, choisi.device.address).apply()
        nom = choisi.nom()
        surEtat(Etat.TROUVEE)
        connecter(choisi.device, auto = false)
    }

    /** Le service de séance n'abandonne pas : il réécoute un peu plus tard. */
    private val relance = Runnable { if (!arretDemande) chercher() }

    @SuppressLint("MissingPermission")
    private fun ScanResult.nom(): String? = scanRecord?.deviceName ?: device.name

    @SuppressLint("MissingPermission")
    private fun arreterRecherche() {
        if (!enRecherche) return
        enRecherche = false
        runCatching { bluetooth.adapter?.bluetoothLeScanner?.stopScan(chasse) }
    }

    private val chasse = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        // Les résultats arrivent sur le fil principal : on les repasse sur
        // [fil], où la fin de l'écoute les lira.
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            fil.post { if (enRecherche) entendus[result.device.address] = result }
        }

        override fun onScanFailed(errorCode: Int) {
            fil.post {
                fil.removeCallbacks(finEcoute)
                enRecherche = false
                surEtat(Etat.ECHEC)
            }
        }
    }

    // --- connexion ----------------------------------------------------------

    /**
     * [auto] à `false` pour la première tentative, `true` ensuite : c'est la
     * voie que documente Android pour se rattacher à un appareil connu. L'appel
     * n'expire jamais et la pile système reconnecte d'elle-même dès qu'elle
     * revoit la ceinture, y compris processeur endormi.
     */
    @SuppressLint("MissingPermission")
    private fun connecter(appareil: BluetoothDevice, auto: Boolean) {
        gatt?.close()
        gatt = appareil.connectGatt(context, auto, rappels, BluetoothDevice.TRANSPORT_LE)
        if (auto) fil.postDelayed(chien, PATIENCE_MS)
    }

    /**
     * `autoConnect` ne fonctionne que si la ceinture est encore dans le cache
     * Bluetooth du système — un redémarrage du téléphone ou une bascule du
     * Bluetooth le vide. Sans ce garde-fou, une reconnexion pourrait donc
     * attendre indéfiniment une pile qui ne cherche plus rien, et le test
     * rendrait quatre heures de silence sans qu'on sache pourquoi.
     */
    private val chien = Runnable {
        if (!arretDemande && gatt != null) {
            gatt?.close()
            gatt = null
            chercher()
        }
    }

    private val rappels = object : BluetoothGattCallback() {

        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    fil.removeCallbacks(chien)
                    fil.post { surEtat(Etat.CONNECTEE) }
                    g.discoverServices()
                }

                BluetoothProfile.STATE_DISCONNECTED -> {
                    fil.post { surEtat(Etat.DECROCHEE) }
                    // Fermer sans attendre : un `BluetoothGatt` laissé ouvert
                    // immobilise une ressource système et fait échouer les
                    // tentatives suivantes — c'est la cause classique du
                    // « status 133 » qui bloque tout jusqu'au redémarrage.
                    g.close()
                    if (!arretDemande) {
                        gatt = null
                        if (reconnecter) fil.post { connecter(g.device, auto = true) }
                    }
                }
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val mesure = g.getService(SERVICE)?.getCharacteristic(MESURE)
            if (mesure == null) {
                // Pas un capteur cardiaque après tout : on lâche, sans
                // reconnexion — il n'en deviendra pas un.
                arretDemande = true
                g.disconnect()
                fil.post { surEtat(Etat.ECHEC) }
                return
            }
            g.setCharacteristicNotification(mesure, true)

            // Côté téléphone, la ligne précédente suffit ; côté ceinture, il
            // faut encore lui demander d'émettre, en écrivant dans son
            // descripteur de configuration. L'oublier donne une connexion
            // parfaitement établie d'où rien n'arrive jamais.
            val cccd = mesure.getDescriptor(CCCD) ?: return
            val ordre = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                g.writeDescriptor(cccd, ordre)
            } else {
                @Suppress("DEPRECATION")
                cccd.value = ordre
                @Suppress("DEPRECATION")
                g.writeDescriptor(cccd)
            }
        }

        override fun onCharacteristicChanged(
            g: BluetoothGatt,
            c: BluetoothGattCharacteristic,
            valeur: ByteArray,
        ) = recevoir(c, valeur)

        @Deprecated("Signature d'avant l'API 33, indispensable sous Android 12 et moins.")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                recevoir(c, c.value ?: return)
            }
        }
    }

    private fun recevoir(c: BluetoothGattCharacteristic, valeur: ByteArray) {
        if (c.uuid != MESURE) return
        val battement = lireBattement(valeur) ?: return
        fil.post { surBattement(battement) }
    }

    companion object {
        /** Service « Heart Rate », `0x180D` — standard Bluetooth SIG. */
        private val SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")

        /** Caractéristique « Heart Rate Measurement », `0x2A37`. */
        private val MESURE = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")

        /** Descripteur de configuration des notifications, `0x2902`. */
        private val CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        private const val PREFS = "ceinture"
        private const val CLE_ADRESSE = "adresse"

        /** La durée d'écoute avant de choisir (sujet 16). */
        private const val ECOUTE_MS = 3_000L

        /**
         * Le service de séance réécoute après ce délai. Android refuse plus de
         * cinq recherches en 30 s : réécouter aussitôt finirait bloqué.
         */
        private const val RELANCE_MS = 10_000L

        /** Délai au-delà duquel une reconnexion automatique est jugée morte. */
        private const val PATIENCE_MS = 60_000L
    }
}
