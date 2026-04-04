import { Capacitor } from "@capacitor/core";

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId() {
  if (Capacitor.isNativePlatform()) {
    const { Device } = await import("@capacitor/device");
    const response = await Device.getId();
    return response?.identifier || response?.uuid;
  }

  const storedId = localStorage.getItem("paytaca-web-device-id");
  if (storedId) return storedId;

  const newId = generateUUID();
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
