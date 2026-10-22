import { Capacitor } from "@capacitor/core";

let BarcodeScanner = null;
let BarcodeFormat = null;

let activeScan = null;

async function getBarcodeScanner() {
  if (!Capacitor.isNativePlatform()) return null;
  if (BarcodeScanner) return { BarcodeScanner, BarcodeFormat };

  try {
    const module = await import("@capacitor-mlkit/barcode-scanning");
    BarcodeScanner = module.BarcodeScanner;
    BarcodeFormat = module.BarcodeFormat;
    return { BarcodeScanner, BarcodeFormat };
  } catch (error) {
    console.warn("BarcodeScanner not available:", error);
    return null;
  }
}

export async function checkPermission() {
  const scanner = await getBarcodeScanner();
  if (!scanner)
    return { granted: false, denied: true, asked: false, neverAsked: true, restricted: false, unknown: false };

  const { BarcodeScanner } = scanner;
  try {
    const { camera } = await BarcodeScanner.checkPermissions();
    return {
      granted: camera === "granted",
      denied: camera === "denied",
      asked: camera !== "prompt",
      neverAsked: camera === "prompt",
      restricted: camera === "restricted",
      unknown: camera === "prompt-with-rationale",
    };
  } catch (error) {
    console.warn("BarcodeScanner checkPermission error:", error);
    return { granted: false, denied: true, asked: false, neverAsked: true, restricted: false, unknown: false };
  }
}

export async function requestPermission() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return { granted: false, denied: true, asked: false, neverAsked: true, restricted: false, unknown: false };

  const { BarcodeScanner } = scanner;
  try {
    const { camera } = await BarcodeScanner.requestPermissions();
    return {
      granted: camera === "granted",
      denied: camera === "denied",
      asked: camera !== "prompt",
      neverAsked: camera === "prompt",
      restricted: camera === "restricted",
      unknown: camera === "prompt-with-rationale",
    };
  } catch (error) {
    console.warn("BarcodeScanner requestPermission error:", error);
    return { granted: false, denied: true, asked: false, neverAsked: true, restricted: false, unknown: false };
  }
}

export async function prepareScanner() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return { prepared: false, error: null };

  const { BarcodeScanner } = scanner;
  try {
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) {
      return { prepared: false, error: "Barcode scanning is not supported on this device" };
    }
    return { prepared: true, error: null };
  } catch (error) {
    console.warn("BarcodeScanner prepare error:", error);
    return { prepared: false, error: null };
  }
}

function finishScan(result) {
  const scan = activeScan;
  if (!scan) return;
  activeScan = null;
  scan.finish(result);
}

export async function startScan() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return { hasContent: false, canceled: false, error: null };

  const { BarcodeScanner, BarcodeFormat } = scanner;

  if (activeScan) {
    finishScan({ hasContent: false, canceled: true, error: null });
  }

  return new Promise((resolve) => {
    const listenerPromises = [];

    const finish = (result) => {
      activeScan = null;
      listenerPromises.forEach((promise) =>
        Promise.resolve(promise)
          .then((handle) => handle?.remove?.())
          .catch(() => {})
      );
      try {
        BarcodeScanner.stopScan().catch(() => {});
      } catch (e) {
        // Camera not started yet
      }
      resolve(result);
    };

    activeScan = { finish };

    const registerListener = (eventName, handler) => {
      const promise = BarcodeScanner.addListener(eventName, handler).catch((error) => {
        console.warn("BarcodeScanner listener error:", error);
        return null;
      });
      listenerPromises.push(promise);
    };

    registerListener("barcodesScanned", (event) => {
      const barcode = event?.barcodes?.find?.((b) => b?.rawValue);
      if (!barcode) return;
      finish({ hasContent: true, content: barcode.rawValue, canceled: false, error: null });
    });

    registerListener("scanError", (event) => {
      console.warn("BarcodeScanner scanError:", event);
      finish({ hasContent: false, canceled: false, error: event?.message || "The scan failed" });
    });

    BarcodeScanner.startScan({
      formats: [BarcodeFormat.QrCode],
      lensFacing: "BACK",
    }).catch((error) => {
      console.warn("BarcodeScanner startScan error:", error);
      const message = typeof error === "string" ? error : error?.message || "";
      finish({ hasContent: false, canceled: false, error: message || "The scan failed" });
    });
  });
}

export async function stopScan() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return;

  const { BarcodeScanner } = scanner;
  if (activeScan) {
    finishScan({ hasContent: false, canceled: true, error: null });
    return;
  }
  try {
    await BarcodeScanner.stopScan();
  } catch (error) {
    console.warn("BarcodeScanner stopScan error:", error);
  }
}

export async function openAppSettings() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return;

  const { BarcodeScanner } = scanner;
  try {
    await BarcodeScanner.openSettings();
  } catch (error) {
    console.warn("BarcodeScanner openAppSettings error:", error);
  }
}
