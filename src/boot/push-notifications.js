import { boot } from "quasar/wrappers";
import { Capacitor } from "@capacitor/core";
import { Platform } from "quasar";
import { reactive } from "vue";
import { markRaw } from "vue";
import { useNotificationsStore } from "src/stores/notifications";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";

class WebPushManager {
  constructor() {
    this.registrationToken = "";
    this.deviceId = "";
    this.permissionStatus =
      typeof Notification !== "undefined" ? Notification.permission : "default";
    this.subscription = null;
    this.swRegistration = null;
  }

  get isSupported() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      VAPID_PUBLIC_KEY
    );
  }

  async registerServiceWorker() {
    if (!this.isSupported) return null;
    try {
      this.swRegistration =
        await navigator.serviceWorker.register("/service-worker.js");
      return this.swRegistration;
    } catch (error) {
      console.error("Service worker registration failed:", error);
      return null;
    }
  }

  async checkPermissions() {
    if (!("Notification" in window)) {
      return { receive: "denied" };
    }
    return { receive: Notification.permission };
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      return { receive: "denied" };
    }
    const permission = await Notification.requestPermission();
    this.permissionStatus = permission;
    return { receive: permission };
  }

  async fetchDeviceId() {
    if (this.deviceId) return this.deviceId;

    const storedId = localStorage.getItem("paytaca-web-device-id");
    if (storedId) {
      this.deviceId = storedId;
      return this.deviceId;
    }

    this.deviceId = this.generateUUID();
    localStorage.setItem("paytaca-web-device-id", this.deviceId);
    return this.deviceId;
  }

  generateUUID() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  async isPushNotificationEnabled() {
    if (!this.isSupported) return { isEnabled: false };

    const permission = await this.checkPermissions();
    if (permission.receive !== "granted") return { isEnabled: false };

    if (!this.swRegistration) {
      await this.registerServiceWorker();
    }

    if (!this.swRegistration) return { isEnabled: false };

    const subscription =
      await this.swRegistration.pushManager.getSubscription();
    return { isEnabled: !!subscription };
  }

  async subscribeToPush() {
    if (!this.isSupported) {
      throw new Error("Web push is not supported");
    }

    const permission = await this.requestPermission();
    if (permission.receive !== "granted") {
      throw new Error("Notification permission denied");
    }

    if (!this.swRegistration) {
      await this.registerServiceWorker();
    }

    if (!this.swRegistration) {
      throw new Error("Service worker registration failed");
    }

    const subscription = await this.swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY
        ? this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        : undefined,
    });

    this.subscription = subscription;
    this.registrationToken = JSON.stringify(subscription);
    return subscription;
  }

  async unsubscribeFromPush() {
    if (!this.subscription) {
      const reg = await this.registerServiceWorker();
      if (!reg) return;
      this.subscription = await reg.pushManager.getSubscription();
    }

    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
      this.registrationToken = "";
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async fetchRegistrationToken() {
    if (!this.isSupported) {
      throw new Error("Web push is not supported");
    }

    await this.registerServiceWorker();

    if (!this.swRegistration) {
      throw new Error("Service worker not registered");
    }

    let subscription = await this.swRegistration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await this.subscribeToPush();
    }

    this.registrationToken = JSON.stringify(subscription);
    return { value: this.registrationToken };
  }

  async openPushNotificationsSettings() {
    if (this.permissionStatus === "denied") {
      window.open("notification-settings:");
    }
    return { isEnabled: this.permissionStatus === "granted" };
  }

  async openPushNotificationsSettingsPrompt() {
    return this.openPushNotificationsSettings();
  }
}

class NativePushNotificationsManager {
  constructor() {
    this.events = PushNotificationsEventEmitter.getInstance();
    this.registrationToken = "";
    this.deviceId = "";
    this.appInfo = null;
    this.registrationTokenError = "no error";
    this.permissionStatus = null;
    this.isEnabled = null;
  }

  get isMobile() {
    return Platform.is.mobile;
  }

  get platform() {
    return Capacitor.getPlatform();
  }

  async fetchAppInfo() {
    const { App } = await import("@capacitor/app");
    const response = await App.getInfo();
    this.appInfo = response;
    return response;
  }

  async isPushNotificationEnabled() {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const PushNotificationSettings = (
      await import("@capacitor/core")
    ).registerPlugin("PushNotificationSettings");

    return PushNotificationSettings.getNotificationStatus()
      .catch((error) => {
        if (error.code === "UNIMPLEMENTED") return { isEnabled: null };
        return Promise.reject(error);
      })
      .then((response) => {
        this.isEnabled = response?.isEnabled;
        return response;
      });
  }

  async openPushNotificationsSettings() {
    const PushNotificationSettings = (
      await import("@capacitor/core")
    ).registerPlugin("PushNotificationSettings");

    if (this._openSettingsPromise) return this._openSettingsPromise;
    this._openSettingsPromise =
      PushNotificationSettings.openNotificationSettings();
    return this._openSettingsPromise
      .catch((error) => {
        if (error.code === "UNIMPLEMENTED") return { isEnabled: null };
        return Promise.reject(error);
      })
      .then((response) => {
        this.isEnabled = response?.isEnabled;
        return response;
      })
      .finally(() => {
        this._openSettingsPromise = undefined;
      });
  }

  async openPushNotificationsSettingsPrompt(opts) {
    const PushNotificationSettings = (
      await import("@capacitor/core")
    ).registerPlugin("PushNotificationSettings");

    if (this._openSettingsPromptPromise) return this._openSettingsPromptPromise;
    this._openSettingsPromptPromise =
      PushNotificationSettings.openNotificationSettingsPrompt(opts);
    return this._openSettingsPromptPromise
      .catch((error) => {
        if (error.code === "UNIMPLEMENTED") return { isEnabled: null };
        return Promise.reject(error);
      })
      .then((response) => {
        this.isEnabled = response?.isEnabled;
        return response;
      })
      .finally(() => {
        this._openSettingsPromptPromise = undefined;
      });
  }

  async checkPermissions() {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const response = await PushNotifications.checkPermissions();
    this.permissionStatus = response?.receive;
    return Promise.resolve(response);
  }

  async requestPermission() {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const response = await PushNotifications.requestPermissions();
    this.permissionStatus = response?.receive;
    return Promise.resolve(response);
  }

  async fetchDeviceId() {
    const { Device } = await import("@capacitor/device");
    const response = await Device.getId();
    const identifier = response?.identifier || response?.uuid;
    if (!identifier) throw response;
    this.deviceId = identifier;
    return this.deviceId;
  }

  async fetchRegistrationToken(opts = {}) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const manager = this;

    return new Promise((resolve, reject) => {
      const registrationSuccessHandler = (token) => {
        manager.registrationToken = token?.value || token;
        resolve(token);
        removeListeners();
      };
      const registrationErrorHandler = (error) => {
        reject(error);
        removeListeners();
      };

      const removeListeners = () => {
        this.events.removeEventListener(
          "registration",
          registrationSuccessHandler,
        );
        this.events.removeEventListener(
          "registrationError",
          registrationErrorHandler,
        );
      };

      this.events.addEventListener("registration", registrationSuccessHandler);
      this.events.addEventListener(
        "registrationError",
        registrationErrorHandler,
      );

      setTimeout(
        () => {
          const error = new Error("Timeout exceeded");
          error.name = "RegistrationTokenTimeout";
          reject(error);
          removeListeners();
        },
        opts?.timeout || 30 * 1000,
      );

      PushNotifications.register();
    });
  }
}

let PushNotificationsEventEmitter, PushNotifications;

if (Capacitor.isNativePlatform()) {
  const { PushNotifications: PN } = require("@capacitor/push-notifications");
  PushNotifications = PN;

  PushNotificationsEventEmitter = class {
    static events = [
      "registration",
      "registrationError",
      "pushNotificationReceived",
      "pushNotificationActionPerformed",
    ];

    static getInstance() {
      if (!PushNotificationsEventEmitter.instance) {
        PushNotificationsEventEmitter.instance =
          new PushNotificationsEventEmitter();
      }
      return PushNotificationsEventEmitter.instance;
    }

    constructor() {
      if (PushNotificationsEventEmitter.instance)
        return PushNotificationsEventEmitter.instance;
      PushNotificationsEventEmitter.instance = this;

      this.listeners = {};
      this.eventHandlers = {};
      PushNotificationsEventEmitter.events.forEach((eventName) => {
        this.eventHandlers[eventName] = (eventData) =>
          this.emitEvent(eventName, eventData);
      });
      this.setupEventHandlers();
    }

    setupEventHandlers() {
      Object.getOwnPropertyNames(this.eventHandlers).forEach((eventName) => {
        PushNotifications.addListener(eventName, this.eventHandlers[eventName])
          .catch((error) => {
            if (error?.code !== 'UNIMPLEMENTED') {
              console.warn('PushNotifications.addListener failed:', eventName, error);
            }
          });
      });
    }

    addEventListener(eventName = "", callback) {
      if (!eventName || typeof callback !== "function") return;
      if (!Array.isArray(this.listeners[eventName]))
        this.listeners[eventName] = [];
      if (this.listeners[eventName].indexOf(callback) >= 0) return;
      this.listeners[eventName].push(callback);
    }

    removeEventListener(eventName = "", callback) {
      if (!Array.isArray(this.listeners[eventName])) return;
      const index = this.listeners[eventName].indexOf(callback);
      if (index >= 0) {
        this.listeners[eventName].splice(index, 1);
      }
    }

    emitEvent(eventName, data) {
      if (!Array.isArray(this.listeners[eventName])) return;
      this.listeners[eventName].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(error);
        }
      });
    }
  };
}

class UnifiedPushNotificationsManager {
  constructor() {
    if (Capacitor.isNativePlatform()) {
      this.nativeManager = new NativePushNotificationsManager();
    } else {
      this.webManager = new WebPushManager();
    }
  }

  get isMobile() {
    return Platform.is.mobile;
  }

  get platform() {
    return Capacitor.getPlatform();
  }

  get events() {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.events;
    }
    return null;
  }

  async fetchAppInfo() {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.fetchAppInfo();
    }
    return { name: "Paytaca POS Web", version: "1.0.0" };
  }

  async isPushNotificationEnabled() {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.isPushNotificationEnabled();
    }
    return this.webManager.isPushNotificationEnabled();
  }

  async openPushNotificationsSettings() {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.openPushNotificationsSettings();
    }
    return this.webManager.openPushNotificationsSettings();
  }

  async openPushNotificationsSettingsPrompt(opts) {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.openPushNotificationsSettingsPrompt(opts);
    }
    return this.webManager.openPushNotificationsSettingsPrompt();
  }

  async checkPermissions() {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.checkPermissions();
    }
    return this.webManager.checkPermissions();
  }

  async requestPermission() {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.requestPermission();
    }
    return this.webManager.requestPermission();
  }

  async fetchDeviceId() {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.fetchDeviceId();
    }
    return this.webManager.fetchDeviceId();
  }

  async fetchRegistrationToken(opts) {
    if (Capacitor.isNativePlatform()) {
      return this.nativeManager.fetchRegistrationToken(opts);
    }
    return this.webManager.fetchRegistrationToken();
  }

  async subscribeToPush() {
    if (Capacitor.isNativePlatform()) {
      throw new Error("subscribeToPush not available on native");
    }
    return this.webManager.subscribeToPush();
  }

  async unsubscribeFromPush() {
    if (Capacitor.isNativePlatform()) {
      throw new Error("unsubscribeFromPush not available on native");
    }
    return this.webManager.unsubscribeFromPush();
  }
}

export const pushNotificationsManager = new UnifiedPushNotificationsManager();

export default boot(({ app }) => {
  if (Capacitor.isNativePlatform()) {
    const manager = reactive(markRaw(pushNotificationsManager.nativeManager));

    app.config.globalProperties.$pushNotifications = manager;
    app.provide("$pushNotifications", manager);

    if (pushNotificationsManager.nativeManager.events) {
      pushNotificationsManager.nativeManager.events.addEventListener(
        "pushNotificationActionPerformed",
        (notificationAction) => {
          console.log(
            "Notification action:",
            JSON.stringify(notificationAction, null, 2),
          );
          const notificationStore = useNotificationsStore();
          notificationStore.setOpenedNotification(
            notificationAction?.notification,
          );
          notificationStore.handleOpenedNotification();
        },
      );
    }
  } else {
    const manager = reactive(markRaw(pushNotificationsManager.webManager));

    app.config.globalProperties.$pushNotifications = manager;
    app.provide("$pushNotifications", manager);
  }
});
