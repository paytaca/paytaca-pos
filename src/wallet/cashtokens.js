import axios from "axios"
import { useWalletStore } from "src/stores/wallet"
import { useAddressesStore } from "src/stores/addresses"
import { convertIpfsUrl } from "src/utils/ipfs"

const BCMR_BACKEND_CHIP = axios.create({
  baseURL: 'https://bcmr-chipnet.paytaca.com/api',
})
const BCMR_BACKEND_MAIN = axios.create({
  baseURL: 'https://bcmr.paytaca.com/api',
})

export function getBcmrBackend() {
  // Determine if we're on chipnet by checking addresses
  const walletStore = useWalletStore()
  const addressesStore = useAddressesStore()
  
  // Try multiple sources to determine network
  const address = 
    walletStore.firstReceivingAddress || 
    addressesStore.currentAddressSet?.receiving ||
    walletStore.deviceInfo?.linkedDevice?.linkCode
  
  // Check if address starts with 'bchtest:' to determine chipnet
  const isChipnet = address?.startsWith?.('bchtest:')
  
  if (isChipnet) {
    return BCMR_BACKEND_CHIP
  } else {
    return BCMR_BACKEND_MAIN
  }
}

// Re-export convertIpfsUrl for convenience
export { convertIpfsUrl }

