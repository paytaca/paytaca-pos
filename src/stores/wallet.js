import { defineStore } from 'pinia';
import { Wallet } from 'src/wallet';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    posId: -1,
    walletHash: null,
    xPubKey: null,
  }),

  getters: {
    getWalletHash (state) {
      return state.walletHash
    },
    walletObj(state) {
      return new Wallet({
        walletHash: state.walletHash,
        xPubKey: state.xPubKey,
        posId: state.posId,
      })
    }
  }
})
