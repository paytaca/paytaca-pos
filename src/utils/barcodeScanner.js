import { Capacitor } from "@capacitor/core";

let BarcodeScanner = null;
let BarcodeFormat = null;

const MODULE_INSTALL_TIMEOUT = 60000;

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

export async function isGoogleScannerModuleAvailable() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return false;

  const { BarcodeScanner } = scanner;
  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    return Boolean(available);
  } catch (error) {
    console.warn("BarcodeScanner module availability check error:", error);
    return false;
  }
}

export async function installGoogleScannerModule() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return false;

  const { BarcodeScanner } = scanner;
  return new Promise((resolve) => {
    let listener = null;
    const timeout = setTimeout(() => {
      listener?.remove?.();
      resolve(false);
    }, MODULE_INSTALL_TIMEOUT);

    BarcodeScanner.addListener(
      "googleBarcodeScannerModuleInstallProgress",
      (event) => {
        if (event?.state === 4) {
          clearTimeout(timeout);
          listener?.remove?.();
          resolve(true);
        } else if (event?.state === 3) {
          clearTimeout(timeout);
          listener?.remove?.();
          resolve(false);
        }
      }
    ).then((handle) => {
      listener = handle;
    });

    BarcodeScanner.installGoogleBarcodeScannerModule().catch((error) => {
      console.warn("BarcodeScanner module install error:", error);
      clearTimeout(timeout);
      listener?.then?.((handle) => handle.remove?.());
      resolve(false);
    });
  });
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

    if (!(await isGoogleScannerModuleAvailable())) {
      const installed = await installGoogleScannerModule();
      if (!installed) {
        return {
          prepared: false,
          error: "The Google Barcode Scanner module is not available. Please update Google Play services and try again",
        };
      }
    }
    return { prepared: true, error: null };
  } catch (error) {
    console.warn("BarcodeScanner prepare error:", error);
    return { prepared: false, error: null };
  }
}

export async function startScan() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return { hasContent: false, canceled: false, error: null };

  const { BarcodeScanner, BarcodeFormat } = scanner;
  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    });
    if (barcodes && barcodes.length > 0) {
      return { hasContent: true, content: barcodes[0].rawValue, canceled: false, error: null };
    }
    return { hasContent: false, canceled: false, error: null };
  } catch (error) {
    console.warn("BarcodeScanner startScan error:", error);
    const message = typeof error === "string" ? error : error?.message || "";
    if (message && message.toLowerCase().includes("canceled")) {
      return { hasContent: false, canceled: true, error: null };
    }
    return { hasContent: false, canceled: false, error: message || "The scan failed" };
  }
}

// The new plugin uses a modal model — scan() resolves when done.
// stopScan is kept for API compatibility but is a no-op.
export async function stopScan() {
  // No-op: @capacitor-mlkit/barcode-scanning scan() is modal and self-closing.
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
