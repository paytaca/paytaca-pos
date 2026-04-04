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

function getBrowserModel() {
  const ua = navigator.userAgent || "";
  let browser = "Unknown Browser";

  if (ua.includes("Firefox/")) {
    const match = ua.match(/Firefox\/(\d+)/);
    browser = "Firefox" + (match ? " " + match[1] : "");
  } else if (ua.includes("Edg/")) {
    const match = ua.match(/Edg\/(\d+)/);
    browser = "Edge" + (match ? " " + match[1] : "");
  } else if (ua.includes("OPR/") || ua.includes("Opera/")) {
    const match = ua.match(/OPR\/(\d+)/);
    browser = "Opera" + (match ? " " + match[1] : "");
  } else if (ua.includes("Chrome/")) {
    const match = ua.match(/Chrome\/(\d+)/);
    browser = "Chrome" + (match ? " " + match[1] : "");
  } else if (ua.includes("Safari/") && ua.includes("Version/")) {
    const match = ua.match(/Version\/(\d+)/);
    browser = "Safari" + (match ? " " + match[1] : "");
  }

  return browser.slice(0, 50);
}

function getOS() {
  const ua = navigator.userAgent || "";

  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS X") || ua.includes("Macintosh")) return "macOS";
  if (ua.includes("CrOS")) return "ChromeOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "unknown";
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
    model: getBrowserModel(),
    operatingSystem: getOS(),
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
