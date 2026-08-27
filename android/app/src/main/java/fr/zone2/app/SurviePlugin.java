package fr.zone2.app;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;

/**
 * Pont entre l'écran de diagnostic et {@link SurvieService}.
 *
 * L'analyse du journal est faite ici, en natif, et pas côté JavaScript : quatre
 * heures de test font environ 14 400 lignes, qu'il n'y a aucune raison de faire
 * traverser au pont pour les recompter de l'autre côté.
 */
@CapacitorPlugin(
    name = "Survie",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class SurviePlugin extends Plugin {

    private static final long SEUIL_TROU_MS = 5000L;

    @PluginMethod
    public void demarrer(PluginCall call) {
        // Sans cette permission le service tourne quand même, mais sa notification
        // reste invisible — et une notification qu'on ne voit pas est un test
        // qu'on ne peut pas surveiller.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("notifications") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "apresNotifications");
            return;
        }
        lancer(call);
    }

    @PermissionCallback
    private void apresNotifications(PluginCall call) {
        lancer(call);
    }

    private void lancer(PluginCall call) {
        Intent i = new Intent(getContext(), SurvieService.class);
        i.setAction(SurvieService.ACTION_DEMARRER);
        getContext().startForegroundService(i);
        call.resolve();
    }

    @PluginMethod
    public void arreter(PluginCall call) {
        Intent i = new Intent(getContext(), SurvieService.class);
        i.setAction(SurvieService.ACTION_ARRETER);
        getContext().startService(i);
        call.resolve();
    }

    /** Ouvre le réglage système d'exemption d'optimisation batterie. */
    @PluginMethod
    public void exemptionBatterie(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        i.setData(Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /**
     * Dépouille le journal. Le résultat est le verdict du PoC :
     * `trouMax` et `trous` disent si One UI nous a laissés vivre.
     */
    @PluginMethod
    public void etat(PluginCall call) {
        JSObject r = new JSObject();
        long debut = 0, fin = 0, precedent = 0, ticks = 0, trouMax = 0, trous = 0, redemarrages = 0;
        int batterieDebut = -1;
        boolean arretPropre = false;

        File f = new File(getContext().getFilesDir(), SurvieService.FICHIER);
        if (f.exists()) {
            try (BufferedReader lecteur = new BufferedReader(new FileReader(f))) {
                String ligne;
                while ((ligne = lecteur.readLine()) != null) {
                    String[] c = ligne.split(",");
                    if (c.length < 2) continue;
                    long t;
                    try {
                        t = Long.parseLong(c[1]);
                    } catch (NumberFormatException e) {
                        continue;
                    }
                    fin = t;
                    switch (c[0]) {
                        case "D":
                            debut = t;
                            if (c.length > 2) batterieDebut = Integer.parseInt(c[2]);
                            break;
                        case "R":
                            redemarrages++;
                            // Une relance par Android referme le trou : le suivant
                            // se mesure à partir d'ici, pas depuis le dernier tick.
                            precedent = t;
                            break;
                        case "S":
                            arretPropre = true;
                            break;
                        case "T":
                            ticks++;
                            if (precedent > 0) {
                                long ecart = t - precedent;
                                if (ecart > trouMax) trouMax = ecart;
                                if (ecart > SEUIL_TROU_MS) trous++;
                            }
                            precedent = t;
                            break;
                    }
                }
            } catch (Exception e) {
                call.reject("Journal illisible : " + e.getMessage());
                return;
            }
        }

        PowerManager pm = (PowerManager) getContext().getSystemService(PowerManager.class);
        BatteryManager bm = (BatteryManager) getContext().getSystemService(BatteryManager.class);

        r.put("actif", SurvieService.actif);
        r.put("debut", debut);
        r.put("fin", fin);
        r.put("dureeMs", debut > 0 ? fin - debut : 0);
        r.put("ticks", ticks);
        // Une seconde par tick : l'écart entre l'attendu et le reçu est la perte.
        r.put("attendus", debut > 0 ? (fin - debut) / 1000 : 0);
        r.put("trouMax", trouMax);
        r.put("trous", trous);
        r.put("redemarrages", redemarrages);
        r.put("arretPropre", arretPropre);
        r.put("batterieDebut", batterieDebut);
        r.put("batterie", bm == null ? -1 : bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY));
        r.put("exempteBatterie", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(r);
    }
}
