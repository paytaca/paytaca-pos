import axios from 'axios'
import { defineStore } from 'pinia';
import { useWalletStore } from './wallet';

export const useMarketStore = defineStore('market', {
  state: () => ({
    bchRates: [
      { currency: '', rate: 0, timestamp: 0 },
    ]
  }),

  getters: {
    selectedCurrencyPrice() {
      const walletStore = useWalletStore()
      const selectedCurrency = walletStore.preferences.selectedCurrency || 'USD'
      // if (!Array.isArray(this.bchRates)) return
      return this.bchRates.find(rate => rate.currency === selectedCurrency)
    }
  },

  actions: {
    /**
     * @param {String} currency 
     * @param {Object} opts 
     * @param {Number} opts.age will skip update when rate timestamp is less than age of 
     */
    refreshBchPrice(currency, opts) {
      if (!currency) return Promise.reject()
      if (!Array.isArray(this.bchRates)) return Promise.reject()

      currency = currency.toUpperCase()

      const rate = this.bchRates.find(_rate => _rate?.currency === currency)
      if (rate?.timestamp && opts?.age && Date.now() - opts?.age <= rate?.timestamp) {
        return Promise.resolve(rate)
      }

      return axios.get(
        'https://api.coingecko.com/api/v3/simple/price/',
        {
          params: { ids: 'bitcoin-cash', vs_currencies: currency }
        }
      )
        .then(response => {
          const rateValue = response?.data?.['bitcoin-cash']?.[currency.toLowerCase()]
          if (!rateValue) return Promise.reject({ response })
          const newRate = { currency: currency, rate: rateValue, timestamp: Date.now() }
          const index = this.bchRates.findIndex(_rate => _rate?.currency === newRate.currency)
          if (index >= 0) this.bchRates[index] = newRate
          else this.bchRates.push(newRate)

          return Promise.resolve(newRate)
        })
    },
  },
})
