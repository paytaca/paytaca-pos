import { Capacitor } from "@capacitor/core";

let BarcodeScanner = null;
let BarcodeFormat = null;

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

export async function prepareScanner() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return false;

  const { BarcodeScanner } = scanner;
  try {
    const { supported } = await BarcodeScanner.isSupported();
    return supported;
  } catch (error) {
    console.warn("BarcodeScanner prepare error:", error);
    return false;
  }
}

export async function startScan() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return { hasContent: false };

  const { BarcodeScanner, BarcodeFormat } = scanner;
  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    });
    if (barcodes && barcodes.length > 0) {
      return { hasContent: true, content: barcodes[0].rawValue };
    }
    return { hasContent: false };
  } catch (error) {
    console.warn("BarcodeScanner startScan error:", error);
    return { hasContent: false };
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