import { defineStore } from 'pinia';
import { Wallet } from 'src/wallet';
import { hmacSha256Hex } from 'src/wallet/utils';
import { useWalletStore } from './wallet';

/**
 * 
 * @param {Object} addressSet 
 * @param {String} addressSet.receiving 
 * @param {String} addressSet.change 
 * @param {Number} addressSet.index 
 * @param {Number} addressSet.paymentIndex 
 * @param {Object} [addressSet.hmac] 
 * @param {String} [addressSet.hmac.receiving] 
 * @param {String} [addressSet.hmac.change] 
 * @param {Wallet} wallet
 */
export function isValidAddressSet(addressSet, wallet) {
  if (!Number.isInteger(addressSet.index)) return false
  if (!addressSet?.receiving || !addressSet?.change) return false

  const receivingAddrHmac = hmacSha256Hex(wallet.xPubKey, addressSet?.receiving)
  const changeAddrHmac = hmacSha256Hex(wallet.xPubKey, addressSet?.change)
  if (addressSet?.hmac?.receiving && addressSet?.hmac?.change) {
    if (addressSet?.hmac?.receiving !== receivingAddrHmac) return false
    if (addressSet?.hmac?.change !== changeAddrHmac) return false
    return true
  }

  const { receiving, change } = wallet.getAddressSetAt(addressSet.index)
  if (receiving !== addressSet?.receiving) return false
  if (change !== addressSet?.change) return false

  addressSet.hmac = { receiving: receivingAddrHmac, change: changeAddrHmac }
  return true
}

export const useAddressesStore = defineStore('addresses', {
  state: () => ({
    maxPresavedAddresses: 10,
    addressSets: [
      {
        receiving: '',
        change: '',
        index: 0,
        paymentIndex: 0,
        // hmacSha256Hex(secret: <xPubKey>, message:<receiving|change>)
        // used for verifying address and xpubkey instead of
        // generating new address from xPubKey as it seems slow and costly
        hmac: {
          receiving: '',
          change: '',
        }
      }
    ]
  }),

  getters: {
    currentAddressSet() {
      return this.addressSets?.[0]
    }
  },

  actions: {
    cleanAddressSets() {
      this.removeDuplicateIndices()
      this.removeInvalidAddressSets()
    },
    removeInvalidAddressSets() {
      const wallet = useWalletStore().walletObj
      this.addressSets = this.addressSets
        .filter(addressSet => isValidAddressSet(addressSet, wallet))
    },
    removeDuplicateIndices() {
      this.addressSets = this.addressSets
        .filter((addressSet, index, array) => 
          array.findIndex(addressSet1 => addressSet.index === addressSet1.index) === index
        )
    },
    async fillAddressSets() {
      this.cleanAddressSets()
      if (this.addressSets.length >= this.maxPresavedAddresses) return

      const wallet = useWalletStore().walletObj

      const paymentIndices = this.addressSets
        .map(addressSet => addressSet?.paymentIndex)
        // .filter(index => Number.isInteger(index))

      let lastPaymentIndex = Math.max(0, ...paymentIndices)

      if (!lastPaymentIndex) {
        const { paymentIndex } = await wallet.getLastPaymentIndex()
        lastPaymentIndex = await paymentIndex || 0
      }

      // setup hard limit on filling address
      let loopsLeft = 20
      while(this.addressSets.length < this.maxPresavedAddresses && loopsLeft > 0) {
        let nextIndex = (lastPaymentIndex+1) % Wallet.paymentIndexValidator.MAX_UNHARDENED_ADDRESS_INDEX
        if (nextIndex === 0) nextIndex++

        if (paymentIndices.indexOf(nextIndex) < 0) {
          try {
            const addressSet = await wallet.generateReceivingAddress(
              nextIndex, { skipSubscription: false },
            )
            addressSet.paymentIndex = nextIndex
            addressSet.hmac = {
              receiving: hmacSha256Hex(wallet.xPubKey, addressSet.receiving),
              change: hmacSha256Hex(wallet.xPubKey, addressSet.change),
            }
            this.enqueueAddress(addressSet)
          } catch(error) {
            console.error(error)
          }
        }
        lastPaymentIndex = nextIndex
        loopsLeft--
      }
    },
    enqueueAddress(addressSet, verify=true) {
      if (verify) {
        const wallet = useWalletStore().walletObj
        if (!isValidAddressSet(addressSet, wallet)) return
      }

      // this.addressSets = [...this.addressSets, addressSet]
      this.addressSets.push(addressSet)
    },
    dequeueAddress() {
      // this.addressSets = this.addressSets.slice(1)
      this.addressSets.splice(0, 1) // remove 1 element/s starting from index 0
    }
  }
})
