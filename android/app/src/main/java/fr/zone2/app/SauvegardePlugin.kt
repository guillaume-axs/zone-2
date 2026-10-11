package fr.zone2.app

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Les lignes « Exporter mes séances » et « Importer une sauvegarde » des
 * Réglages (sujet 15).
 *
 * Les deux passent par les fenêtres du système (Storage Access Framework) :
 * « Enregistrer sous » pour l'export, le sélecteur de fichiers pour l'import.
 * L'utilisateur choisit l'endroit — Téléchargements ou Google Drive — et
 * l'application n'a besoin d'aucune permission de stockage.
 *
 * Le greffon ne connaît rien des séances : il écrit le texte qu'on lui donne
 * et rend le texte qu'il lit. La validation du fichier se fait en JavaScript.
 *
 * Fenêtre fermée sans choisir : `{ fait: false }`, rien ne s'est passé.
 */
@CapacitorPlugin(name = "Sauvegarde")
class SauvegardePlugin : Plugin() {

    @PluginMethod
    fun exporter(call: PluginCall) {
        val nom = call.getString("nom") ?: return call.reject("nom manquant")
        if (call.getString("contenu") == null) return call.reject("contenu manquant")
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, nom)
        startActivityForResult(call, intent, "apresExport")
    }

    @ActivityCallback
    private fun apresExport(call: PluginCall, resultat: ActivityResult) {
        val uri = resultat.data?.data
        if (resultat.resultCode != Activity.RESULT_OK || uri == null) return call.resolve(fait(false))
        try {
            val flux = context.contentResolver.openOutputStream(uri, "wt") ?: return call.reject("écriture impossible")
            flux.use { it.write(call.getString("contenu")!!.toByteArray(Charsets.UTF_8)) }
            call.resolve(fait(true))
        } catch (e: Exception) {
            call.reject("écriture impossible", e)
        }
    }

    @PluginMethod
    fun importer(call: PluginCall) {
        // `*/*` et non `application/json` : un fichier passé par Google Drive ou
        // une messagerie perd souvent son type, et resterait grisé.
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
        startActivityForResult(call, intent, "apresImport")
    }

    @ActivityCallback
    private fun apresImport(call: PluginCall, resultat: ActivityResult) {
        val uri = resultat.data?.data
        if (resultat.resultCode != Activity.RESULT_OK || uri == null) return call.resolve(fait(false))
        try {
            val flux = context.contentResolver.openInputStream(uri) ?: return call.reject("lecture impossible")
            val texte = flux.use { it.readBytes().toString(Charsets.UTF_8) }
            call.resolve(fait(true).put("contenu", texte))
        } catch (e: Exception) {
            call.reject("lecture impossible", e)
        }
    }

    private fun fait(oui: Boolean) = JSObject().put("fait", oui)
}
