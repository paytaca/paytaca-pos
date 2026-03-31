import { Capacitor } from "@capacitor/core";

const DB_NAME = "PaytacaSecureStorage";
const DB_VERSION = 1;
const STORE_NAME = "secure_data";

let dbInstance = null;

function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

async function getEncryptionKey() {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("paytaca-secure-storage-key"),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("paytaca-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(data) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

async function decrypt(encryptedObj) {
  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(encryptedObj.iv) },
    key,
    new Uint8Array(encryptedObj.data)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export class WebSecureStorage {
  static async get({ key }) {
    if (Capacitor.isNativePlatform()) {
      const { SecureStoragePlugin } = await import(
        "capacitor-secure-storage-plugin"
      );
      const result = await SecureStoragePlugin.get({ key });
      return result;
    }

    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = async () => {
          if (!request.result) {
            reject(new Error(`Key "${key}" not found`));
            return;
          }
          try {
            const decrypted = await decrypt(request.result.encrypted);
            resolve({ value: decrypted });
          } catch (e) {
            reject(e);
          }
        };
      });
    } catch (error) {
      console.error("WebSecureStorage.get error:", error);
      throw error;
    }
  }

  static async set({ key, value }) {
    if (Capacitor.isNativePlatform()) {
      const { SecureStoragePlugin } = await import(
        "capacitor-secure-storage-plugin"
      );
      const result = await SecureStoragePlugin.set({ key, value });
      return result;
    }

    try {
      const db = await openDatabase();
      const encrypted = await encrypt(value);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ key, encrypted });

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve({ value: true });
      });
    } catch (error) {
      console.error("WebSecureStorage.set error:", error);
      throw error;
    }
  }

  static async remove({ key }) {
    if (Capacitor.isNativePlatform()) {
      const { SecureStoragePlugin } = await import(
        "capacitor-secure-storage-plugin"
      );
      const result = await SecureStoragePlugin.remove({ key });
      return result;
    }

    try {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve({ value: true });
      });
    } catch (error) {
      console.error("WebSecureStorage.remove error:", error);
      throw error;
    }
  }

  static async clear() {
    if (Capacitor.isNativePlatform()) {
      const { SecureStoragePlugin } = await import(
        "capacitor-secure-storage-plugin"
      );
      const result = await SecureStoragePlugin.clear();
      return result;
    }

    try {
      const db = await openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve({ value: true });
      });
    } catch (error) {
      console.error("WebSecureStorage.clear error:", error);
      throw error;
    }
  }
}

export function isSecureStorageAvailable() {
  if (Capacitor.isNativePlatform()) return true;
  return "indexedDB" in window && "crypto" in window;
}
