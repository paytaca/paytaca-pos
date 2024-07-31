import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', {
  state: () => {
    return {
      language: 'en-us'
    }
  }
})
