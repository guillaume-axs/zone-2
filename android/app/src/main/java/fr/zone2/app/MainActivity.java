package fr.zone2.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SurviePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
