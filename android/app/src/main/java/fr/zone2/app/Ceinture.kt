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
 * Les rappels sont délivrés sur le [fil] fourni, jamais sur le fil principal :
 * celui qui les reçoit écrit sur le disque à chaque battement.
 */
class Ceinture(
    private val context: Context,
    private val fil: Handler,
    private val surBattement: (Battement) -> Unit,
    private val surEtat: (Etat) -> Unit,
) {

    enum class Etat { RECHERCHE, TROUVEE, CONNECTEE, DECROCHEE, ECHEC }

    private val bluetooth = context.getSystemService(BluetoothManager::class.java)
    private val prefs = context.getSharedPreferences("ceinture", Context.MODE_PRIVATE)

    private var gatt: BluetoothGatt? = null
    private var enRecherche = false
    private var arretDemande = false

    // --- cycle de vie -------------------------------------------------------

    /**
     * Une adresse déjà connue évite la recherche : on va droit à la ceinture.
     * Elle n'est mémorisée que sur ce téléphone et n'apparaît nulle part
     * ailleurs — le dépôt est public (sujet 8).
     */
    @SuppressLint("MissingPermission")
    fun demarrer() {
        arretDemande = false
        val connue = prefs.getString(CLE_ADRESSE, null)
        if (connue != null) {
            runCatching { bluetooth.adapter.getRemoteDevice(connue) }.getOrNull()?.let {
                connecter(it, auto = false)
                return
            }
        }
        chercher()
    }

    @SuppressLint("MissingPermission")
    fun arreter() {
        arretDemande = true
        fil.removeCallbacks(chien)
        arreterRecherche()
        gatt?.let {
            it.disconnect()
            it.close()
        }
        gatt = null
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
        surEtat(Etat.RECHERCHE)

        // Filtré sur le service cardiaque : une salle de sport est pleine
        // d'appareils Bluetooth, aucun intérêt à les voir passer.
        scanner.startScan(
            listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE)).build()),
            ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),
            chasse,
        )
    }

    @SuppressLint("MissingPermission")
    private fun arreterRecherche() {
        if (!enRecherche) return
        enRecherche = false
        runCatching { bluetooth.adapter?.bluetoothLeScanner?.stopScan(chasse) }
    }

    private val chasse = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            arreterRecherche()
            prefs.edit().putString(CLE_ADRESSE, result.device.address).apply()
            surEtat(Etat.TROUVEE)
            connecter(result.device, auto = false)
        }

        override fun onScanFailed(errorCode: Int) {
            enRecherche = false
            surEtat(Etat.ECHEC)
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
                        fil.post { connecter(g.device, auto = true) }
                    }
                }
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val mesure = g.getService(SERVICE)?.getCharacteristic(MESURE)
            if (mesure == null) {
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

        private const val CLE_ADRESSE = "adresse"

        /** Délai au-delà duquel une reconnexion automatique est jugée morte. */
        private const val PATIENCE_MS = 60_000L
    }
}
