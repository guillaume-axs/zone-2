package fr.zone2.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter

/**
 * Service de survie — étage 1 du PoC de l'étape 2.
 *
 * Il ne fait rien d'utile : il écrit un horodatage par seconde dans un fichier.
 * C'est délibéré. La question qu'on teste n'est pas « sait-on parler Bluetooth »
 * — c'est « One UI laisse-t-il vivre notre processus pendant quatre heures,
 * écran verrouillé ». Un générateur de battements remplace donc le capteur, et
 * tout le reste est l'architecture réelle décidée le 2026-08-11 : service de
 * premier plan, type `connectedDevice`, notification permanente, écriture
 * directe depuis le natif sans dépendre du JavaScript.
 *
 * Le verdict est un nombre : une série parfaite de 4 h contient 14 400 lignes.
 * On compte les trous.
 *
 * FIDÉLITÉ DU SIMULATEUR — à lire avant d'interpréter un résultat. Un `Handler`
 * qui s'auto-replanifie ne réveille pas le processeur endormi, alors qu'un
 * paquet BLE entrant, lui, le réveille. Sans précaution, ce service mesurerait
 * donc une somnolence que le vrai trafic Bluetooth ne subirait pas, et
 * échouerait pour une mauvaise raison. D'où le `WakeLock` partiel ci-dessous :
 * il tient le processeur éveillé comme le ferait un flux de battements réels.
 * Cette hypothèse devra être revalidée à l'étage 2, contre un vrai GATT.
 */
class SurvieService : Service() {

    private lateinit var fil: HandlerThread
    private lateinit var handler: Handler
    private var verrou: PowerManager.WakeLock? = null
    private var journal: BufferedWriter? = null
    private var ticks = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        creerCanal()

        verrou = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "zone2:survie")
            .apply { acquire() }

        fil = HandlerThread("survie").apply { start() }
        handler = Handler(fil.looper)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_ARRETER) {
            ecrire("S,${System.currentTimeMillis()},${batterie()}")
            stopSelf()
            return START_NOT_STICKY
        }

        ServiceCompat.startForeground(
            this, NOTIF_ID, notification(0),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            else 0,
        )

        if (intent?.action == ACTION_DEMARRER) {
            // Un démarrage explicite ouvre un test neuf : le journal précédent
            // n'a plus d'intérêt et fausserait le comptage.
            File(filesDir, FICHIER).delete()
            ouvrirJournal()
            ecrire("D,${System.currentTimeMillis()},${batterie()}")
        } else {
            // Ici Android nous a relancés seul (START_STICKY). C'est un échec
            // partiel qu'il faut voir dans le résultat, pas masquer : le service
            // avait été tué. On le consigne au lieu de reprendre l'air de rien.
            ouvrirJournal()
            ecrire("R,${System.currentTimeMillis()},${batterie()}")
        }

        actif = true
        handler.removeCallbacksAndMessages(null)
        handler.postDelayed(battement, PERIODE_MS)
        return START_STICKY
    }

    private val battement = object : Runnable {
        override fun run() {
            ticks++
            ecrire("T,${System.currentTimeMillis()}")
            if (ticks % 60 == 0L) majNotification()
            handler.postDelayed(this, PERIODE_MS)
        }
    }

    override fun onDestroy() {
        actif = false
        handler.removeCallbacksAndMessages(null)
        fil.quitSafely()
        fermerJournal()
        verrou?.takeIf { it.isHeld }?.release()
        super.onDestroy()
    }

    // --- journal ------------------------------------------------------------

    private fun ouvrirJournal() {
        fermerJournal()
        journal = runCatching {
            BufferedWriter(FileWriter(File(filesDir, FICHIER), true))
        }.getOrNull()
    }

    /**
     * Chaque ligne est vidée sur le disque immédiatement. C'est le seul moyen de
     * connaître l'instant exact de la mise à mort : un tampon non vidé emporte
     * dans la tombe les dernières secondes, c'est-à-dire précisément ce qu'on
     * cherche à mesurer. Une écriture par seconde est négligeable.
     */
    @Synchronized
    private fun ecrire(ligne: String) {
        val j = journal ?: return
        runCatching {
            j.write(ligne)
            j.newLine()
            j.flush()
        }
    }

    @Synchronized
    private fun fermerJournal() {
        journal?.let { runCatching { it.close() } }
        journal = null
    }

    private fun batterie() =
        getSystemService(BatteryManager::class.java)
            ?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1

    // --- notification -------------------------------------------------------

    private fun creerCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val canal = NotificationChannel(CANAL, "Séance en cours", NotificationManager.IMPORTANCE_LOW)
        canal.setShowBadge(false)
        getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
    }

    private fun notification(n: Long): Notification {
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CANAL)
            .setContentTitle("Test de survie en cours")
            .setContentText(if (n == 0L) "Démarré" else "${n / 60} min · $n battements")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun majNotification() {
        getSystemService(NotificationManager::class.java)?.notify(NOTIF_ID, notification(ticks))
    }

    companion object {
        const val FICHIER = "survie.log"
        const val ACTION_DEMARRER = "fr.zone2.app.DEMARRER"
        const val ACTION_ARRETER = "fr.zone2.app.ARRETER"

        private const val CANAL = "survie"
        private const val NOTIF_ID = 4201
        private const val PERIODE_MS = 1000L

        /** Lu par le pont : distingue « service toujours vivant » de « tué ». */
        @Volatile
        @JvmStatic
        var actif = false
            private set
    }
}
