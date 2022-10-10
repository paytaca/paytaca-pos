import { defineStore } from 'pinia';
import { Wallet } from 'src/wallet';
import { useWalletStore } from './wallet';

export const useAddressesStore = defineStore('addresses', {
  state: () => ({
    maxPresavedAddresses: 10,
    addressSets: [
      {
        receiving: '',
        change: '',
        index: 0,
        paymentIndex: 0,
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
        .filter((addressSet) => {
          if (!Number.isInteger(addressSet.index)) return false

          const { receiving, change } = wallet.getAddressSetAt(addressSet.index)
          if (receiving == addressSet?.receiving && change == addressSet?.change) return true

          return false
        })
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
            this.enqueueAddress(addressSet)
          } catch(error) {
            console.error(error)
          }
        }
        lastPaymentIndex = nextIndex
        loopsLeft--
      }
    },
    enqueueAddress(addressSet) {
      // this.addressSets = [...this.addressSets, addressSet]
      this.addressSets.push(addressSet)
    },
    dequeueAddress() {
      // this.addressSets = this.addressSets.slice(1)
      this.addressSets.splice(0, 1) // remove 1 element/s starting from index 0
    }
  }
})
