import { defineStore } from 'pinia';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    walletHash: null,
    xPubKey: null
  }),

  getters: {
    getWalletHash (state) {
      return state.walletHash
    }
  },

  actions: {
    setWalletHash (state, walletHash) {
      state.walletHash = walletHash
    }
  }
})
