import { boot } from "quasar/wrappers";
import { Capacitor } from "@capacitor/core";
import { Platform } from "quasar";

export default boot(() => {
  if (Capacitor.isNativePlatform() && Platform.is.ios) {
    import("@capacitor/keyboard")
      .then(({ Keyboard }) => {
        Keyboard.setResizeMode({ mode: "native" })
          .then(() => {
            Keyboard.getResizeMode().then((resizeMode) => {
              console.log("Keyboard resize mode", resizeMode);
            });
          })
          .catch(console.error);
      })
      .catch(console.error);
  }
});
