package com.paytaca.pos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
//import com.getcapacitor.Plugin;

//import java.util.ArrayList;

import com.paytaca.pos.plugins.PushNotificationSettingsPlugin;
import com.paytaca.pos.plugins.SaveToGalleryPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    registerPlugin(PushNotificationSettingsPlugin.class);
    registerPlugin(SaveToGalleryPlugin.class);

    // Initializes the Bridge
    // this.init(savedInstanceState, new ArrayList<Class<? extends Plugin>>() {{
    //   // Additional plugins you've installed go here
    // // Ex: add(TotallyAwesomePlugin.class);
    // }});
  }
}
