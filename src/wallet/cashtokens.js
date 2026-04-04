import axios from "axios";
import { convertIpfsUrl } from "src/utils/ipfs";

const BCMR_BACKEND_CHIP = axios.create({
  baseURL: "https://bcmr-chipnet.paytaca.com/api",
});
const BCMR_BACKEND_MAIN = axios.create({
  baseURL: "https://bcmr.paytaca.com/api",
});

let walletStore = null;
let addressesStore = null;

function getStores() {
  if (!walletStore) {
    const { useWalletStore } = require("src/stores/wallet");
    walletStore = useWalletStore();
  }
  if (!addressesStore) {
    const { useAddressesStore } = require("src/stores/addresses");
    addressesStore = useAddressesStore();
  }
  return { walletStore, addressesStore };
}

export function getBcmrBackend() {
  const { walletStore, addressesStore } = getStores();

  const address =
    walletStore.firstReceivingAddress ||
    addressesStore.currentAddressSet?.receiving ||
    walletStore.deviceInfo?.linkedDevice?.linkCode;

  const isChipnet = address?.startsWith?.("bchtest:");

  if (isChipnet) {
    return BCMR_BACKEND_CHIP;
  } else {
    return BCMR_BACKEND_MAIN;
  }
}

export { convertIpfsUrl };
