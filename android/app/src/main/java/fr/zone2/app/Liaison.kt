package fr.zone2.app

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.provider.Settings
import androidx.core.content.ContextCompat
import fr.zone2.app.Relais.Detenteur
import fr.zone2.app.Relais.Ordre

/**
 * L'unique liaison avec la ceinture, pour toute l'app (DECISIONS, 2026-10-22).
 *
 * Les Réglages et la séance s'en servent tour à tour ; [Relais] décide de ce
 * que chaque événement en fait selon qui la tient, ici on l'exécute. Une seule
 * [Ceinture], un seul guet du silence, un seul récepteur de la radio : les deux
 * copies d'avant pouvaient se disputer le capteur, qui n'accepte qu'une liaison.
 *
 * Tout l'état se lit et s'écrit sur [fil] ; chaque méthode publique y poste.
 */
object Liaison {

    /** Ce que le détenteur reçoit, sur [fil]. */
    interface Ecouteur {
        fun etat(e: Ceinture.Etat, nom: String?)

        /** Tous, portés ou non : le service journalise tout. */
        fun battement(b: Battement)
    }

    val fil: Handler = Handler(HandlerThread("liaison").apply { start() }.looper)

    /** Le nom que donne le capteur de lui-même. */
    val nom: String? get() = ceinture?.nom

    private val relais = Relais()
    private val ecouteurs = mutableMapOf<Detenteur, Ecouteur>()
    private var ceinture: Ceinture? = null
    private var app: Context? = null

    private val silence = Runnable { executer(relais.silence()) }

    private val radio = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)) {
                BluetoothAdapter.STATE_TURNING_OFF, BluetoothAdapter.STATE_OFF -> fil.post { executer(relais.radio(false)) }
                BluetoothAdapter.STATE_ON -> fil.post { executer(relais.radio(true)) }
            }
        }
    }

    fun ecouteur(pour: Detenteur, e: Ecouteur) {
        fil.post { ecouteurs[pour] = e }
    }

    /** Désinscrit [e] s'il écoute encore : une activité recréée a déjà inscrit le sien. */
    fun lacher(pour: Detenteur, e: Ecouteur) {
        fil.post { ecouteurs.remove(pour, e) }
    }

    /** [rappel] reçoit `false` quand la liaison est refusée : la séance la tient. */
    fun prendre(context: Context, par: Detenteur, rappel: (Boolean) -> Unit) {
        val application = context.applicationContext
        fil.post {
            if (app == null) {
                app = application
                ContextCompat.registerReceiver(
                    application,
                    radio,
                    IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
                    ContextCompat.RECEIVER_NOT_EXPORTED,
                )
            }
            executer(relais.prendre(par))
            rappel(relais.detenteur == par)
        }
    }

    fun rendre() {
        fil.post { executer(relais.rendre()) }
    }

    fun fermer(par: Detenteur) {
        fil.post { executer(relais.fermer(par)) }
    }

    /** La déconnexion volontaire : le capteur choisi n'était peut-être pas le bon. */
    fun oublier(par: Detenteur) {
        fil.post { if (relais.detenteur == par) ceinture?.oublier() }
    }

    fun appQuittee() {
        fil.post { executer(relais.appQuittee()) }
    }

    fun radioAllumee(context: Context) =
        context.getSystemService(BluetoothManager::class.java)?.adapter?.isEnabled == true

    /** Refus définitif : Android ne repose plus la question, seule la page de l'app dans ses paramètres la rouvre. */
    fun ouvrirParametres(activity: Activity) {
        activity.startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(Uri.fromParts("package", activity.packageName, null)),
        )
    }

    private fun executer(ordres: List<Ordre>) {
        for (o in ordres) when (o) {
            Ordre.Lancer -> lancer()
            Ordre.Arreter -> {
                ceinture?.arreter()
                ceinture = null
            }
            Ordre.ArmerSilence -> {
                fil.removeCallbacks(silence)
                fil.postDelayed(silence, Journal.SILENCE_MS)
            }
            Ordre.DesarmerSilence -> fil.removeCallbacks(silence)
            is Ordre.Signaler -> ecouteurs[o.pour]?.etat(o.etat, nom)
        }
    }

    /**
     * Une ceinture arrêtée peut encore avoir des rappels en file sur [fil] :
     * seuls ceux de la ceinture courante passent, les autres sont ignorés.
     */
    private fun lancer() {
        lateinit var c: Ceinture
        c = Ceinture(
            app!!,
            fil,
            reconnecter = { relais.reconnecte },
            surBattement = { if (ceinture === c) battement(it) },
            surEtat = { if (ceinture === c) executer(relais.etatCeinture(it)) },
        )
        ceinture = c
        c.demarrer()
    }

    private fun battement(b: Battement) {
        val pour = relais.detenteur ?: return
        if (b.porte) executer(relais.battementPorte())
        ecouteurs[pour]?.battement(b)
    }
}
