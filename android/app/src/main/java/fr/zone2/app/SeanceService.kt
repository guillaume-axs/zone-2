package fr.zone2.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter
import java.io.Writer
import java.util.UUID

/**
 * Le service de séance, seul détenteur de la ceinture (sujet 11, J1).
 *
 * Deux temps. **L'écoute** ([ACTION_ECOUTER]), dès l'écran Démarrer : il se
 * connecte et relaie la FC, preuve de connexion, sans rien écrire.
 * **L'enregistrement** ([demarrer]) : un journal `seance-<uuid>.log` par
 * séance, une ligne par trame (format : [Journal]), jusqu'à [terminer].
 *
 * La séance active est notée sur le disque avant la première trame. Relancé
 * seul par Android (`START_STICKY`, intent `null`), le service la relit,
 * rejoue son journal pour retrouver le temps en zone et continue dans le même
 * fichier. Recréé par toute autre demande, il l'oublie : son journal est un
 * orphelin, que le rangement retrouvera au prochain lancement. Aucun fichier n'est jamais supprimé ici : c'est le rangement, côté
 * application, qui efface un journal une fois en base.
 *
 * Tout ce qui touche à la ceinture et au journal se passe sur [fil] : un seul
 * fil, donc aucun verrou. Les champs lus par [instantane] depuis le greffon
 * sont `@Volatile`.
 *
 * Le PoC (étages 1 et 2, verdicts des 2026-08-28 et 2026-09-19) a validé la
 * tenue de ce service : même type `connectedDevice`, toujours sans verrou de
 * réveil — un paquet Bluetooth entrant réveille le processeur de lui-même.
 */
class SeanceService : Service() {

    /** La séance en cours d'enregistrement, telle que notée sur le disque. */
    data class Active(val id: String, val debutMs: Long, val min: Int?, val max: Int?)

    private lateinit var fil: HandlerThread
    private lateinit var handler: Handler
    private var ceinture: Ceinture? = null

    private var flux: FileOutputStream? = null
    private var journal: Writer? = null
    private var compteurs = Compteurs()

    @Volatile private var seance: Active? = null

    /**
     * La séance que ce service tient en mémoire — la seule définition de
     * « séance en cours » pour le greffon, qui ne lit jamais les préférences.
     */
    val seanceEnCours: Active? get() = seance

    /** La séance trouvée à la création, tranchée au premier `onStartCommand` (fil principal). */
    private var aReprendre: Active? = null

    /** Posé au premier `startForeground` (fil principal). */
    private var auPremierPlan = false
    @Volatile private var etat = Ceinture.Etat.RECHERCHE.name
    @Volatile private var dernierBpm: Int? = null
    @Volatile private var derniereTrameMs: Long? = null
    @Volatile private var enZoneS = 0L

    /** Connectée mais rien depuis 5 s : sangle ôtée, électrodes sèches. La ceinture se reconnecte seule si le lien tombe. */
    private val silence = Runnable { signaler(MUETTE) }

    /** `flush` confie la ligne au système, pas au disque : seul `sync` l'y pose. */
    private val synchro = object : Runnable {
        override fun run() {
            synchroniser()
            handler.postDelayed(this, SYNC_MS)
        }
    }

    /**
     * Depuis Android 10, couper le Bluetooth ne prévient plus la connexion :
     * le service suit lui-même la radio, comme la ligne Capteur.
     */
    private val radio = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)) {
                BluetoothAdapter.STATE_TURNING_OFF, BluetoothAdapter.STATE_OFF -> handler.post { couperCeinture() }
                BluetoothAdapter.STATE_ON -> handler.post { demarrerCeinture() }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        creerCanal()
        fil = HandlerThread("seance").apply { start() }
        handler = Handler(fil.looper)
        handler.postDelayed(synchro, SYNC_MS)
        ContextCompat.registerReceiver(
            this,
            radio,
            IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        // Une séance notée dont le journal existe encore ; `onStartCommand`
        // décide si elle se reprend. Journal disparu = déjà rangé et effacé
        // par l'application pendant que le service était mort : on l'oublie,
        // plutôt que d'écrire un second journal sous le même id.
        aReprendre = active(this)?.takeIf { fichier(this, it.id).exists() }
        if (aReprendre == null) oublierActive(this)
        enCours = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notee = aReprendre
        aReprendre = null
        if (notee != null) {
            // Seul Android relance sans intent : la séance n'a jamais été
            // terminée, on continue son journal. Recréé par l'écoute ou par
            // `lacher`, le service n'a pas à ressusciter une séance morte
            // (journal d'hier, durée d'hier) : on l'oublie, le fichier reste
            // et le rangement le rangera comme orphelin.
            if (intent == null) seance = notee else oublierActive(this)
        }
        if (intent?.action == ACTION_LACHER && !auPremierPlan && seance == null) {
            // `lacher` est envoyé sans condition (`startService`) : un service
            // créé par lui n'a rien à lâcher. Surtout pas de `startForeground` —
            // Bluetooth refusé, Android 14 le refuserait d'une exception.
            stopSelf()
            return START_NOT_STICKY
        }
        // Démarré par `startForegroundService`, le service a 10 s pour s'annoncer :
        // c'est la première chose qu'il fait, quelle que soit la demande.
        ServiceCompat.startForeground(
            this, NOTIF_ID, notification(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            else 0,
        )
        auPremierPlan = true

        if (intent == null) {
            if (notee != null) handler.post { reprendre(notee) }
            // Sans séance, une écoute ne survit pas à sa mort.
            if (seance == null) {
                stopSelf()
                return START_NOT_STICKY
            }
            return START_STICKY
        }

        when (intent.action) {
            ACTION_ECOUTER -> handler.post { if (ceinture == null) demarrerCeinture() }
            // On quitte l'écran Démarrer sans démarrer. Une séance en cours,
            // elle, ne se lâche pas : seul [terminer] l'arrête. La question se
            // pose sur [fil], après un [demarrer] qui l'aurait précédé.
            ACTION_LACHER -> handler.post {
                if (seance == null) {
                    ceinture?.arreter()
                    ceinture = null
                    stopSelf()
                }
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        enCours = null
        unregisterReceiver(radio)
        handler.removeCallbacks(silence)
        handler.removeCallbacks(synchro)
        handler.post {
            ceinture?.arreter()
            ceinture = null
            fermerJournal()
        }
        fil.quitSafely()
        super.onDestroy()
    }

    // --- séance -------------------------------------------------------------

    /**
     * Ouvre la séance : un UUID neuf, noté sur le disque **avant** la première
     * trame, puis le journal. Déjà en cours (double appui), la même séance est
     * rendue. [rappel] reçoit `null` si le service s'arrête entre-temps.
     */
    fun demarrer(min: Int?, max: Int?, rappel: (Active?) -> Unit) {
        val poste = handler.post {
            val a = seance ?: Active(UUID.randomUUID().toString(), System.currentTimeMillis(), min, max).also {
                noter(it)
                seance = it
                compteurs = Compteurs()
                enZoneS = 0
                ouvrirJournal(it)
                majNotification()
            }
            rappel(a)
        }
        if (!poste) rappel(null)
    }

    /**
     * Écrit la fin, vide et pose le fichier sur le disque, le ferme, oublie la
     * séance et lâche la ceinture — **puis** répond, avec l'id de la séance
     * close (`null` s'il n'y en avait pas). Le rangement peut lire le fichier
     * dès la réponse.
     */
    fun terminer(rappel: (String?) -> Unit) {
        val poste = handler.post {
            val id = seance?.id
            if (seance != null) {
                ecrire(Journal.fin(System.currentTimeMillis()))
                fermerJournal()
                oublierActive(this)
                seance = null
            }
            handler.removeCallbacks(silence)
            ceinture?.arreter()
            ceinture = null
            stopSelf()
            rappel(id)
        }
        if (!poste) rappel(null)
    }

    /** L'état à l'instant, pour l'écran qui revient d'une WebView gelée. */
    fun instantane(): JSObject {
        val o = JSObject().put("etat", etat).put("enZoneS", enZoneS)
        dernierBpm?.let { o.put("bpm", it) }
        derniereTrameMs?.let { o.put("derniereTrameMs", it) }
        seance?.let { o.put("debutMs", it.debutMs) }
        return o
    }

    private fun reprendre(a: Active) {
        ouvrirJournal(a)
        compteurs = runCatching { Journal.rejouer(fichier(this, a.id).readText(), a.min, a.max) }
            .onFailure { Log.w(TAG, "Journal illisible à la reprise, temps en zone repris à zéro", it) }
            .getOrDefault(Compteurs())
        enZoneS = compteurs.enZoneMs / 1000
        derniereTrameMs = compteurs.derniereMs
        // La relance se voit dans le journal : le service avait été tué.
        ecrire(Journal.relance(System.currentTimeMillis()))
        demarrerCeinture()
    }

    private fun noter(a: Active) {
        val e = getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .clear()
            .putString(CLE_ID, a.id)
            .putLong(CLE_DEBUT, a.debutMs)
        a.min?.let { e.putInt(CLE_MIN, it) }
        a.max?.let { e.putInt(CLE_MAX, it) }
        // Synchrone : la séance doit être sur le disque avant sa première trame.
        if (!e.commit()) Log.w(TAG, "Séance non notée : une relance d'Android ne pourra pas la reprendre")
    }

    // --- ceinture -----------------------------------------------------------

    private fun demarrerCeinture() {
        ceinture?.arreter()
        ceinture = Ceinture(this, handler, reconnecter = true, ::noterBattement, ::noterEtat).also { it.demarrer() }
    }

    /** Bluetooth coupé : la ceinture s'arrête, elle repartira au retour de la radio. */
    private fun couperCeinture() {
        val c = ceinture ?: return
        c.arreter()
        ceinture = null
        noterEtat(Ceinture.Etat.DECROCHEE)
    }

    private fun noterBattement(b: Battement) {
        val ms = System.currentTimeMillis()
        val a = seance
        // Écrite telle quelle : [Journal.compte] décide, ici comme à la lecture.
        if (a != null) ecrire(Journal.trame(ms, b))
        // Ôté de la sangle, le H10 émet encore une FC figée : un trou, pas une
        // trame. Le délai n'est pas relancé, la séance passe muette en 5 s,
        // comme la ligne Capteur.
        if (!b.porte) return
        guetter()
        if (etat == MUETTE) signaler(Ceinture.Etat.CONNECTEE.name)
        val changement = b.bpm != dernierBpm
        dernierBpm = b.bpm
        derniereTrameMs = ms
        if (a != null && Journal.compte(ms - a.debutMs, b.bpm, b.contact, b.rr)) {
            compteurs.compter(ms, b.bpm, a.min, a.max)
            enZoneS = compteurs.enZoneMs / 1000
        }
        auditeur?.invoke("fc", JSObject().put("bpm", b.bpm).put("enZoneS", enZoneS))
        if (changement) majNotification()
    }

    private fun noterEtat(e: Ceinture.Etat) {
        if (e == Ceinture.Etat.CONNECTEE) guetter() else handler.removeCallbacks(silence)
        signaler(e.name)
    }

    /** Un nom de [Ceinture.Etat], ou [MUETTE]. */
    private fun signaler(e: String) {
        etat = e
        ecrire(Journal.liaison(System.currentTimeMillis(), e))
        auditeur?.invoke("etat", JSObject().put("etat", e))
        majNotification()
    }

    /** Connectée, la ceinture doit parler : chaque trame relance le délai. */
    private fun guetter() {
        handler.removeCallbacks(silence)
        handler.postDelayed(silence, Journal.SILENCE_MS)
    }

    // --- journal ------------------------------------------------------------

    /**
     * Ouvre le journal de [a] en ajout. Un reste de ligne coupé par un arrêt
     * brutal est d'abord retiré : la ligne suivante s'y collerait et rendrait
     * illisible une ligne du milieu, donc tout le journal. Ce reste n'a jamais
     * été lisible. Un fichier vide reçoit sa ligne de départ.
     *
     * Un échec laisse [journal] à `null` : la prochaine ligne réessaiera.
     */
    private fun ouvrirJournal(a: Active) {
        fermerJournal()
        try {
            val f = fichier(this, a.id)
            Journal.couperReste(f)
            val s = FileOutputStream(f, true)
            flux = s
            journal = OutputStreamWriter(s, Charsets.UTF_8)
            if (f.length() == 0L) {
                journal?.write(Journal.depart(a.id, a.debutMs, a.min, a.max))
                journal?.flush()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Journal impossible à ouvrir, nouvel essai à la prochaine ligne", e)
            fermerJournal()
        }
    }

    /**
     * Chaque ligne est vidée aussitôt : un tampon emporte les dernières
     * secondes avec le processus. Une écriture ratée perd sa ligne, pas les
     * suivantes : le journal est rouvert à la prochaine. En pleine séance,
     * l'utilisateur ne pourrait rien faire d'une alerte ; le trou se dira en
     * fin de séance.
     */
    private fun ecrire(ligne: String) {
        val a = seance ?: return
        if (journal == null) ouvrirJournal(a)
        val j = journal ?: return
        try {
            j.write(ligne)
            j.flush()
        } catch (e: Exception) {
            Log.w(TAG, "Ligne du journal perdue", e)
            fermerJournal()
        }
    }

    private fun synchroniser() {
        try {
            flux?.fd?.sync()
        } catch (e: Exception) {
            Log.w(TAG, "Synchronisation du journal ratée", e)
        }
    }

    private fun fermerJournal() {
        try {
            journal?.flush()
        } catch (e: Exception) {
            Log.w(TAG, "Journal non vidé à la fermeture", e)
        }
        synchroniser()
        try {
            journal?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Journal mal fermé", e)
        }
        journal = null
        flux = null
    }

    // --- notification -------------------------------------------------------

    private fun creerCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val canal = NotificationChannel(CANAL, "Séance en cours", NotificationManager.IMPORTANCE_LOW)
        canal.setShowBadge(false)
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(canal)
        // Le canal du PoC, même nom affiché : sans ça, deux « Séance en cours » dans les réglages.
        nm.deleteNotificationChannel("survie")
    }

    /** Le seul retour visible écran verrouillé : la liaison tient-elle, et la FC. */
    private fun notification(): Notification {
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val ligne = when (etat) {
            Ceinture.Etat.CONNECTEE.name -> dernierBpm?.let { "$it bpm" } ?: "Ceinture connectée"
            Ceinture.Etat.RECHERCHE.name -> "Recherche de la ceinture…"
            Ceinture.Etat.TROUVEE.name -> "Ceinture trouvée, connexion…"
            Ceinture.Etat.DECROCHEE.name -> "Liaison perdue, reconnexion…"
            Ceinture.Etat.INTROUVABLE.name -> "Aucun capteur, nouvel essai…"
            Ceinture.Etat.ECHEC.name -> "Bluetooth indisponible"
            MUETTE -> "Ceinture muette"
            else -> "Démarrage"
        }
        return NotificationCompat.Builder(this, CANAL)
            .setContentTitle("Séance en cours")
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
        const val ACTION_ECOUTER = "fr.zone2.app.ECOUTER"
        const val ACTION_LACHER = "fr.zone2.app.LACHER"

        /** Les journaux s'appellent `seance-<uuid>.log`, dans `filesDir`. */
        const val PREFIXE = "seance-"

        /** L'état « connectée mais muette depuis 5 s », en plus des noms de [Ceinture.Etat]. */
        const val MUETTE = "MUETTE"

        /** Le service vivant, s'il y en a un. */
        @Volatile
        var enCours: SeanceService? = null
            private set

        /** Reçoit les événements `fc` et `etat` ; branché par le greffon. */
        @Volatile
        var auditeur: ((String, JSObject) -> Unit)? = null

        fun fichier(context: Context, id: String) = File(context.filesDir, "$PREFIXE$id.log")

        /** La séance notée sur le disque, qu'un service la tienne encore ou non. */
        private fun active(context: Context): Active? {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val id = p.getString(CLE_ID, null) ?: return null
            return Active(
                id = id,
                debutMs = p.getLong(CLE_DEBUT, 0),
                min = if (p.contains(CLE_MIN)) p.getInt(CLE_MIN, 0) else null,
                max = if (p.contains(CLE_MAX)) p.getInt(CLE_MAX, 0) else null,
            )
        }

        private fun oublierActive(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit()
        }

        private const val TAG = "SeanceService"
        private const val PREFS = "seance"
        private const val CLE_ID = "id"
        private const val CLE_DEBUT = "debutMs"
        private const val CLE_MIN = "min"
        private const val CLE_MAX = "max"
        private const val CANAL = "seance"
        private const val NOTIF_ID = 4201
        private const val SYNC_MS = 30_000L
    }
}
