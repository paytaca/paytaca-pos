import { boot } from "quasar/wrappers";
import { Capacitor } from "@capacitor/core";

export default boot(() => {
  if (Capacitor.isNativePlatform()) {
    import("@ionic/pwa-elements/loader")
      .then(({ defineCustomElements }) => {
        defineCustomElements(window);
      })
      .catch(console.warn);
  }
});
