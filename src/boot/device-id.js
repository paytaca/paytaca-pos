import { boot } from "quasar/wrappers";
import { useWalletStore } from "src/stores/wallet";
import { getDeviceId } from "src/utils/device";

const DEVICE_ID_TIMEOUT = 3000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timed out resolving device id")), ms)
    ),
  ]);
}

/**
 * Resolve this device's own id at startup so the wallet store can validate the
 * linked device by identity (device_id) instead of the ephemeral link code.
 * Non-fatal: a failure just falls back to the link code comparison.
 */
export default boot(async ({ store }) => {
  const walletStore = useWalletStore(store);
  try {
    const deviceId = await withTimeout(getDeviceId(), DEVICE_ID_TIMEOUT);
    if (deviceId) walletStore.setDeviceId(deviceId);
  } catch (error) {
    console.warn("Unable to resolve device id:", error);
  }
});
