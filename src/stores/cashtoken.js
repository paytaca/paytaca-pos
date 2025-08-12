import axios from "axios"
import { defineStore } from "pinia"

export const useCashtokenStore = defineStore('cashtoken', {
  state: () => ({
    fungibleCashtokens: [].map(() => {
      return { category: '', name: '', symbol: '', decimals: 0, imageUrl: '' }
    })
  }),
  actions: {
    getTokenMetadata(category) {
      for (const metadata of this.fungibleCashtokens) {
        if (metadata.category === category) return metadata
      }
      return null;
    },
    async fetchTokenMetadata(category) {
      return axios.get(`https://watchtower.cash/api/cashtokens/fungible/${category}/`)
        .then(response => {
          const data = response?.data
          const assetId = data?.id
          if (typeof assetId !== 'string') return Promise.reject({ response, message: 'No asset ID' })
          const _category = assetId?.replace('ct/', '')
          if (_category !== category) return Promise.reject({ response, message: 'Category mismatch' })
          const metadata = {
            category,
            name: data?.name,
            symbol: data?.symbol,
            decimals: data?.decimals,
            imageUrl: data?.image_url || data?.imageUrl,
          }
          this.saveTokenMetadata(metadata);
          return metadata;
        })
        .catch(error => {
          console.error(error)
        })
    },
    saveTokenMetadata(metadata) {
      if (!metadata?.category) return

      const index = this.fungibleCashtokens.findIndex(_metadata => {
        return _metadata.category === metadata?.category
      })
      if (index >= 0) this.fungibleCashtokens[index] = metadata
      else this.fungibleCashtokens.push(metadata)
    }
  }
})