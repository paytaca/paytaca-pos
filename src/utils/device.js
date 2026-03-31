import { Capacitor } from "@capacitor/core";

export async function getDeviceId() {
  if (Capacitor.isNativePlatform()) {
    const { Device } = await import("@capacitor/device");
    const response = await Device.getId();
    return response?.identifier || response?.uuid;
  }

  const storedId = localStorage.getItem("paytaca-web-device-id");
  if (storedId) return storedId;

  const newId = crypto.randomUUID();
  localStorage.setItem("paytaca-web-device-id", newId);
  return newId;
}

export async function getDeviceInfo() {
  if (Capacitor.isNativePlatform()) {
    const { Device } = await import("@capacitor/device");
    return Device.getInfo();
  }

  return {
    name: "Web Browser",
    platform: "web",
    model: navigator.userAgent,
    operatingSystem: "unknown",
    osVersion: "unknown",
    manufacturer: navigator.vendor || "unknown",
    isVirtual: true,
    appVersion: "1.0.0",
    appBuild: "web",
    appId: "com.paytaca.pos",
    deviceName: "Web Browser",
    batteryInfo: { level: 1, isCharging: true },
    isPortrait: window.matchMedia("(orientation: portrait)").matches,
    isLandscape: window.matchMedia("(orientation: landscape)").matches,
    isDarkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
  };
}
