import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', {
  state: () => {
    return {
      defaultAssetSelected: 'bch', // can be BCH or a fungible cashtoken category
      language: 'en-us'
    }
  }
})
