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
 * Service de séance — étage 2 du PoC de l'étape 2.
 *
 * L'étage 1 a mesuré la survie du *processus* : un faux cœur battait une fois
 * par seconde et on comptait les trous. Verdict du 2026-08-28 : zéro relance
 * sur 9 h 30 cumulées. Ce que ce test ne pouvait pas produire, c'est une
 * déconnexion Bluetooth — le service peut rester parfaitement vivant pendant
 * que le lien avec la ceinture tombe, et personne ne le verrait.
 *
 * Le faux cœur est donc remplacé par le vrai. Tout le reste est inchangé, et
 * c'est délibéré : une seule variable change par rapport aux 9 h 30 déjà
 * mesurées, donc un échec sera interprétable.
 *
 * Le verdict n'est plus seulement « combien de battements manquent » mais
 * **combien de temps s'est écoulé sans donnée**, et surtout la part de ce temps
 * pendant laquelle la liaison se croyait vivante. Cette part-là est la panne
 * silencieuse : celle qui ne lève aucune alarme et qu'on ne verrait jamais sans
 * la mesurer.
 *
 * LE VERROU DE RÉVEIL RESTE, POUR CE TEST SEULEMENT. Il était là pour rendre le
 * faux cœur crédible : un `Handler` qui se replanifie ne réveille pas un
 * processeur endormi, alors qu'un paquet Bluetooth entrant, lui, le réveille.
 * Le garder ici ne change donc qu'une chose à la fois. Un second test le
 * retirera, pour savoir si le trafic réel suffit à nous tenir éveillés —
 * tenir un processeur éveillé quatre heures coûte de la batterie, et finit par
 * rendre une application suspecte aux yeux d'Android.
 */
class SurvieService : Service() {

    private lateinit var fil: HandlerThread
    private lateinit var handler: Handler
    private var verrou: PowerManager.WakeLock? = null
    private var journal: BufferedWriter? = null
    private var ceinture: Ceinture? = null
    private var battements = 0L

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
            this, NOTIF_ID, notification(),
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
        demarrerCeinture()
        return START_STICKY
    }

    override fun onDestroy() {
        actif = false
        ceinture?.arreter()
        ceinture = null
        handler.removeCallbacksAndMessages(null)
        fil.quitSafely()
        fermerJournal()
        verrou?.takeIf { it.isHeld }?.release()
        super.onDestroy()
    }

    // --- ceinture -----------------------------------------------------------

    private fun demarrerCeinture() {
        ceinture?.arreter()
        ceinture = Ceinture(this, handler, ::noterBattement, ::noterEtat).also { it.demarrer() }
    }

    /**
     * Une ligne par battement reçu. Le contact peau y figure séparément de la
     * liaison : une électrode sèche et un lien mort produisent tous deux du
     * silence, et les confondre au dépouillement ferait accuser le Bluetooth
     * d'une faute qui revient à un maillot mal humidifié.
     */
    private fun noterBattement(b: Battement) {
        battements++
        dernierBpm = b.bpm
        val contact = when (b.contact) {
            true -> "1"
            false -> "0"
            null -> "-"
        }
        ecrire("B,${System.currentTimeMillis()},${b.bpm},$contact,${b.rr.joinToString(";")}")
        if (battements % 60 == 0L) majNotification()
    }

    private fun noterEtat(e: Ceinture.Etat) {
        etat = e.name
        ecrire("C,${System.currentTimeMillis()},${e.name}")
        majNotification()
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

    /**
     * La notification est le seul retour visible pendant quatre heures d'écran
     * verrouillé. Elle dit donc l'essentiel : la liaison tient-elle, et combien
     * de battements sont arrivés.
     */
    private fun notification(): Notification {
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val ligne = when (etat) {
            Ceinture.Etat.CONNECTEE.name -> "$dernierBpm bpm · $battements battements"
            Ceinture.Etat.RECHERCHE.name -> "Recherche de la ceinture…"
            Ceinture.Etat.TROUVEE.name -> "Ceinture trouvée, connexion…"
            Ceinture.Etat.DECROCHEE.name -> "Liaison perdue, reconnexion…"
            Ceinture.Etat.ECHEC.name -> "Bluetooth indisponible"
            else -> "Démarrage"
        }
        return NotificationCompat.Builder(this, CANAL)
            .setContentTitle("Test de séance en cours")
            .setContentText(ligne)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun majNotification() {
        getSystemService(NotificationManager::class.java)?.notify(NOTIF_ID, notification())
    }

    companion object {
        const val FICHIER = "survie.log"
        const val ACTION_DEMARRER = "fr.zone2.app.DEMARRER"
        const val ACTION_ARRETER = "fr.zone2.app.ARRETER"

        private const val CANAL = "survie"
        private const val NOTIF_ID = 4201

        /** Lu par le pont : distingue « service toujours vivant » de « tué ». */
        @Volatile
        @JvmStatic
        var actif = false
            private set

        /** État de la liaison, affiché en direct par l'écran de diagnostic. */
        @Volatile
        @JvmStatic
        var etat = ""
            private set

        @Volatile
        @JvmStatic
        var dernierBpm = 0
            private set
    }
}
