package fr.zone2.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SurviePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
