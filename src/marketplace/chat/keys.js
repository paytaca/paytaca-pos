import crypto from "crypto";
import { backend } from "../backend";
import * as secp from "@noble/secp256k1";
import { WebSecureStorage } from "src/utils/webSecureStorage";
import { pushNotificationsManager } from "src/boot/push-notifications";

const SecureStorage = WebSecureStorage;

const AES_STORAGE_KEY = "marketplace-chat-aes-key";

let deviceId;
async function getDeviceId() {
  if (!deviceId) deviceId = await pushNotificationsManager.fetchDeviceId();
  return deviceId;
}

/**
 * @param {String} pubkey
 */
export async function updatePubkey(pubkey) {
  const pubkeyBytes = Buffer.from(pubkey, "hex");
  if (pubkeyBytes.length !== 33) throw new Error("Pubkey is not a 33 byte hex");

  const data = {
    pubkey: {
      pubkey: pubkey,
      device_id: await getDeviceId().catch(console.error),
    },
  };
  return backend.post(`chat/identities/`, data);
}

export async function getKeypair() {
  const storageData = await SecureStorage.get({ key: AES_STORAGE_KEY });
  const parsedData = JSON.parse(storageData?.value);

  const response = { pubkey: "", privkey: "" };
  response.pubkey = parsedData?.pubkey;
  response.privkey = parsedData?.privkey;
  return response;
}

/**
 * @param {String} privkey
 */
export async function savePrivkey(privkey) {
  const privkeyBytes = Buffer.from(privkey, "hex");
  if (privkeyBytes.length !== 32)
    throw new Error("Privkey is not a 32 byte hex");

  const pubkey = privToPub(privkey);
  const keypair = { pubkey, privkey };
  const serializdKeypair = JSON.stringify(keypair);
  const response = await SecureStorage.set({
    key: AES_STORAGE_KEY,
    value: serializdKeypair,
  });
  return response.value;
}

/**
 * @param {Object} opts
 * @param {String} opts.seed
 */
export function generateKeypair(opts = { seed: "" }) {
  const seed = opts?.seed;
  let privkey = "";
  if (seed && typeof seed === "string") {
    privkey = sha256(seed);
  } else {
    const privBytes = crypto.randomFillSync(new Uint8Array(32));
    privkey = Buffer.from(privBytes).toString("hex");
  }

  const pubkey = privToPub(privkey);
  return { privkey, pubkey };
}

export function privToPub(priv) {
  const privBytes = secp.etc.hexToBytes(priv);
  const pub = secp.getPublicKey(privBytes);
  const pubHex = secp.etc.bytesToHex(pub);
  return pubHex;
}

/**
 * @param {String} data
 * @returns {String}
 */
export function sha256(data) {
  const _sha256 = crypto.createHash("sha256");
  _sha256.update(Buffer.from(data, "utf8"));
  return _sha256.digest().toString("hex");
}
