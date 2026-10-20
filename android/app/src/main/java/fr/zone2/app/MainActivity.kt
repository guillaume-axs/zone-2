package fr.zone2.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SeancePlugin::class.java)
        registerPlugin(CapteurPlugin::class.java)
        registerPlugin(SauvegardePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
