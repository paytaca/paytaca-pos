import { boot } from "quasar/wrappers";
import { ref } from "vue";

class NetworkDetect {
  static windowEvents = ["online", "offline", "load"];

  constructor(opts) {
    this._listeners = {};
    this._pingUrl = opts?.url || "https://google.com";
    this.isOnline = navigator.onLine;
    this.check()
      .then((isOnline) => (this.isOnline = isOnline))
      .catch(() => (this.isOnline = false));
    this._windowEventListener = () => this.check();
    this.initWindowEvents();
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((cb) => cb(data));
    }
  }

  async check() {
    let isOnline = navigator.onLine;
    try {
      if (navigator.onLine) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(this._pingUrl, {
          method: "HEAD",
          mode: "no-cors",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        isOnline = true;
      }
    } catch (error) {
      isOnline = navigator.onLine;
    }
    if (isOnline !== this.isOnline) this.emit("network-change", isOnline);
    this.isOnline = isOnline;
    return Promise.resolve(this.isOnline);
  }

  initWindowEvents() {
    NetworkDetect.windowEvents.forEach((event) => {
      window.removeEventListener(event, this._windowEventListener);
    });
    NetworkDetect.windowEvents.forEach((event) => {
      window.addEventListener(event, this._windowEventListener);
    });
  }
}

export default boot(({ app }) => {
  const isOnline = ref(false);
  const networkDetect = new NetworkDetect();
  networkDetect.check().then((_isOnline) => (isOnline.value = _isOnline));
  networkDetect.on(
    "network-change",
    (_isOnline) => (isOnline.value = _isOnline)
  );

  app.config.globalProperties.$isOnline = isOnline;
  app.provide("$isOnline", isOnline);

  app.config.globalProperties.$networkDetect = networkDetect;
  app.provide("$networkDetect", networkDetect);
});
