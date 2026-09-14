import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.zone2.app',
  appName: 'Zone 2',
  webDir: 'dist',
  plugins: {
    // L'écran de lancement reste affiché jusqu'à SplashScreen.hide() : la
    // première image visible est déjà mise en page avec les marges système.
    SplashScreen: { launchAutoHide: false },
  },
};

export default config;
