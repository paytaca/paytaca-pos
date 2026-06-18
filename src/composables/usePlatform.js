import { computed } from "vue";
import { Platform } from "quasar";
import { Capacitor } from "@capacitor/core";

export function usePlatform() {
  const isNativePlatform = computed(() => Capacitor.isNativePlatform());
  const isCapacitor = computed(() => Platform.is.capacitor);
  const isMobile = computed(() => Platform.is.mobile);
  const isIOS = computed(() => Platform.is.ios);
  const isAndroid = computed(() => Platform.is.android);

  const isWeb = computed(() => !isNativePlatform.value);
  const canUseCamera = computed(() => {
    if (isNativePlatform.value) return true;
    return (
      "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices
    );
  });
  const canUseNotifications = computed(() => {
    if (isNativePlatform.value) return true;
    return "Notification" in window && "serviceWorker" in navigator;
  });
  const canUseSecureStorage = computed(() => {
    if (isNativePlatform.value) return true;
    return "indexedDB" in window && "crypto" in window;
  });
  const canUseWakeLock = computed(() => {
    if (isNativePlatform.value) return true;
    return "wakeLock" in navigator;
  });
  const canUseClipboard = computed(() => {
    return "clipboard" in navigator;
  });
  const canUseWebPush = computed(() => {
    if (isNativePlatform.value) return false;
    return "PushManager" in window && "serviceWorker" in navigator;
  });

  return {
    isNativePlatform,
    isCapacitor,
    isMobile,
    isIOS,
    isAndroid,
    isWeb,
    canUseCamera,
    canUseNotifications,
    canUseSecureStorage,
    canUseWakeLock,
    canUseClipboard,
    canUseWebPush,
  };
}

export function getPlatformInfo() {
  return {
    isNativePlatform: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    isCapacitor: Platform.is.capacitor,
    isMobile: Platform.is.mobile,
    isIOS: Platform.is.ios,
    isAndroid: Platform.is.android,
    isWeb: !Capacitor.isNativePlatform(),
    userAgent: navigator.userAgent,
  };
}
