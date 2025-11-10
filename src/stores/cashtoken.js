import { defineStore } from "pinia"
import { getBcmrBackend, convertIpfsUrl } from "src/wallet/cashtokens"

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
      const url = `tokens/${category}/`
      return getBcmrBackend().get(url)
        .then(response => {
          const data = response?.data
          
          // Check for error in response
          if (data?.error) {
            return Promise.reject({ response, message: 'BCMR returned error' })
          }
          
          // BCMR response structure:
          // - data.name is at top level
          // - data.token contains token-specific info (symbol, decimals, uris)
          // - data.uris.icon or data.token.uris.icon for image
          const token = data?.token || {}
          
          // Extract image URL from uris.icon (check both locations)
          let imageUrl = null
          if (data?.token?.uris?.icon) {
            imageUrl = convertIpfsUrl(data.token.uris.icon)
          } else if (data?.uris?.icon) {
            imageUrl = convertIpfsUrl(data.uris.icon)
          } else if (data?.token?.uris?.image) {
            imageUrl = convertIpfsUrl(data.token.uris.image)
          } else if (data?.uris?.image) {
            imageUrl = convertIpfsUrl(data.uris.image)
          }
          
          const metadata = {
            category,
            name: data?.name || '',
            symbol: token?.symbol || '',
            decimals: parseInt(token?.decimals) || 0,
            imageUrl: imageUrl,
          }
          
          this.saveTokenMetadata(metadata);
          return metadata;
        })
        .catch(error => {
          console.error('Failed to fetch token metadata from BCMR:', error)
          // Return null to indicate failure, but don't throw to prevent breaking the UI
          return null
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