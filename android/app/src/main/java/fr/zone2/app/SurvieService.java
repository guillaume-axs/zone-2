package fr.zone2.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;

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
public class SurvieService extends Service {

    public static final String FICHIER = "survie.log";
    public static final String ACTION_DEMARRER = "fr.zone2.app.DEMARRER";
    public static final String ACTION_ARRETER = "fr.zone2.app.ARRETER";

    private static final String CANAL = "survie";
    private static final int NOTIF_ID = 4201;
    private static final long PERIODE_MS = 1000L;

    private HandlerThread fil;
    private Handler handler;
    private PowerManager.WakeLock verrou;
    private BufferedWriter journal;
    private long ticks = 0L;

    /** Lu par le pont : distingue « service toujours vivant » de « tué ». */
    public static volatile boolean actif = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        creerCanal();

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        verrou = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "zone2:survie");
        verrou.acquire();

        fil = new HandlerThread("survie");
        fil.start();
        handler = new Handler(fil.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        boolean neuf = intent != null && ACTION_DEMARRER.equals(intent.getAction());

        if (intent != null && ACTION_ARRETER.equals(intent.getAction())) {
            ecrire("S," + System.currentTimeMillis() + "," + batterie());
            stopSelf();
            return START_NOT_STICKY;
        }

        ServiceCompat.startForeground(
            this, NOTIF_ID, notification(0),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                : 0
        );

        if (neuf) {
            // Un démarrage explicite ouvre un test neuf : le journal précédent
            // n'a plus d'intérêt et fausserait le comptage.
            new File(getFilesDir(), FICHIER).delete();
            ouvrirJournal();
            ecrire("D," + System.currentTimeMillis() + "," + batterie());
        } else {
            // Ici Android nous a relancés seul (START_STICKY). C'est un échec
            // partiel qu'il faut voir dans le résultat, pas masquer : le service
            // avait été tué. On le consigne au lieu de reprendre l'air de rien.
            ouvrirJournal();
            ecrire("R," + System.currentTimeMillis() + "," + batterie());
        }

        actif = true;
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(battement, PERIODE_MS);
        return START_STICKY;
    }

    private final Runnable battement = new Runnable() {
        @Override
        public void run() {
            ticks++;
            ecrire("T," + System.currentTimeMillis());
            if (ticks % 60 == 0) majNotification();
            handler.postDelayed(this, PERIODE_MS);
        }
    };

    @Override
    public void onDestroy() {
        actif = false;
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (fil != null) fil.quitSafely();
        fermerJournal();
        if (verrou != null && verrou.isHeld()) verrou.release();
        super.onDestroy();
    }

    // --- journal ------------------------------------------------------------

    private void ouvrirJournal() {
        fermerJournal();
        try {
            journal = new BufferedWriter(new FileWriter(new File(getFilesDir(), FICHIER), true));
        } catch (Exception e) {
            journal = null;
        }
    }

    /**
     * Chaque ligne est vidée sur le disque immédiatement. C'est le seul moyen de
     * connaître l'instant exact de la mise à mort : un tampon non vidé emporte
     * dans la tombe les dernières secondes, c'est-à-dire précisément ce qu'on
     * cherche à mesurer. Une écriture par seconde est négligeable.
     */
    private synchronized void ecrire(String ligne) {
        if (journal == null) return;
        try {
            journal.write(ligne);
            journal.newLine();
            journal.flush();
        } catch (Exception ignore) {
        }
    }

    private synchronized void fermerJournal() {
        if (journal == null) return;
        try {
            journal.close();
        } catch (Exception ignore) {
        }
        journal = null;
    }

    private int batterie() {
        BatteryManager bm = (BatteryManager) getSystemService(BATTERY_SERVICE);
        return bm == null ? -1 : bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
    }

    // --- notification -------------------------------------------------------

    private void creerCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel canal = new NotificationChannel(
            CANAL, "Séance en cours", NotificationManager.IMPORTANCE_LOW
        );
        canal.setShowBadge(false);
        ((NotificationManager) getSystemService(NotificationManager.class)).createNotificationChannel(canal);
    }

    private Notification notification(long n) {
        Intent ouvrir = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, ouvrir, PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(this, CANAL)
            .setContentTitle("Test de survie en cours")
            .setContentText(n == 0 ? "Démarré" : (n / 60) + " min · " + n + " battements")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void majNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIF_ID, notification(ticks));
    }
}
