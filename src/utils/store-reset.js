import { useAddressesStore } from "src/stores/addresses";
import { useCashtokenStore } from "src/stores/cashtoken";
import { useMarketStore } from "src/stores/market";
import { useMarketplaceStore } from "src/stores/marketplace";
import { useMarketplaceHeartbeatStore } from "src/stores/marketplace-heartbeat";
import { useNotificationsStore } from "src/stores/notifications";
import { usePaymentsStore } from "src/stores/payments";
import { useSettingsStore } from "src/stores/settings";
import { useTxCacheStore } from "src/stores/tx-cache";
import { useWalletStore } from "src/stores/wallet";

// Pinia store ids double as the keys used by pinia-plugin-persistedstate-2,
// so clearing these localStorage entries wipes every persisted state blob.
const STORE_IDS = [
  "addresses",
  "cashtoken",
  "market",
  "marketplace",
  "marketplace-heartbeat",
  "notifications",
  "payments",
  "settings",
  "tx-cache",
  "wallet",
];

function resetStore(store) {
  if (typeof store.$reset === "function") {
    store.$reset();
    return;
  }
  Object.keys(store.$state).forEach((key) => delete store.$state[key]);
}

export function resetAllStores() {
  const stores = [
    useAddressesStore(),
    useCashtokenStore(),
    useMarketStore(),
    useMarketplaceStore(),
    useMarketplaceHeartbeatStore(),
    useNotificationsStore(),
    usePaymentsStore(),
    useSettingsStore(),
    useTxCacheStore(),
    useWalletStore(),
  ];
  stores.forEach(resetStore);
  STORE_IDS.forEach((id) => localStorage.removeItem(id));
}
