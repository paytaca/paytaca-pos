import { Capacitor } from "@capacitor/core";

let BarcodeScanner = null;
let SupportedFormat = null;

async function getBarcodeScanner() {
  if (!Capacitor.isNativePlatform()) return null;
  if (BarcodeScanner) return { BarcodeScanner, SupportedFormat };

  try {
    const module = await import("@capacitor-community/barcode-scanner");
    BarcodeScanner = module.BarcodeScanner;
    SupportedFormat = module.SupportedFormat;
    return { BarcodeScanner, SupportedFormat };
  } catch (error) {
    console.warn("BarcodeScanner not available:", error);
    return null;
  }
}

export async function checkPermission() {
  const scanner = await getBarcodeScanner();
  if (!scanner)
    return {
      granted: false,
      denied: true,
      asked: false,
      neverAsked: true,
      restricted: false,
      unknown: false,
    };

  const { BarcodeScanner } = scanner;
  try {
    const status = await BarcodeScanner.checkPermission({ force: true });
    return status;
  } catch (error) {
    console.warn("BarcodeScanner checkPermission error:", error);
    return {
      granted: false,
      denied: true,
      asked: false,
      neverAsked: true,
      restricted: false,
      unknown: false,
    };
  }
}

export async function prepareScanner() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return false;

  const { BarcodeScanner, SupportedFormat } = scanner;
  try {
    await BarcodeScanner.prepare({
      targetedFormats: [SupportedFormat.QR_CODE],
    });
    return true;
  } catch (error) {
    console.warn("BarcodeScanner prepare error:", error);
    return false;
  }
}

export async function startScan() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return { hasContent: false };

  const { BarcodeScanner } = scanner;
  try {
    await BarcodeScanner.hideBackground();
    const res = await BarcodeScanner.startScan({
      targetedFormats: [SupportedFormat.QR_CODE],
    });
    return res;
  } catch (error) {
    console.warn("BarcodeScanner startScan error:", error);
    return { hasContent: false };
  }
}

export async function stopScan() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return;

  const { BarcodeScanner } = scanner;
  try {
    BarcodeScanner.showBackground();
    BarcodeScanner.stopScan();
  } catch (error) {
    console.warn("BarcodeScanner stopScan error:", error);
  }
}

export async function openAppSettings() {
  const scanner = await getBarcodeScanner();
  if (!scanner) return;

  const { BarcodeScanner } = scanner;
  try {
    await BarcodeScanner.openAppSettings();
  } catch (error) {
    console.warn("BarcodeScanner openAppSettings error:", error);
  }
}
