import axios from 'axios'
import { defineStore } from 'pinia';
import { useWalletStore } from './wallet';

export const useMarketStore = defineStore('market', {
  state: () => ({
    usdRates: [
      { currency: 'USD', rate: 1, timestamp: 0 },
    ],
    bchRates: [
      { currency: '', rate: 0, timestamp: 0 },
    ]
  }),

  getters: {
    selectedCurrencyPrice() {
      const walletStore = useWalletStore()
      const selectedCurrency = walletStore.preferences.selectedCurrency || 'USD'
      return this.getRate(selectedCurrency)
    },
    getRate() {
      return (currency) => {
        const bchRate = this.bchRates.find(rate => rate.currency === currency)
        if (bchRate && currency !== 'ARS') return bchRate

        const bchUsdRate = this.bchRates.find(rate => rate.currency === 'USD')
        if (!bchUsdRate) return
        const usdRate = this.usdRates.find(rate => rate.currency === currency)
        if (!usdRate) return
        return {
          currency: usdRate.currency,
          rate: bchUsdRate.rate * usdRate.rate,
          timestamp: usdRate.timestamp
        }
      }
    }
  },

  actions: {
    /**
     * @param {Object} newRate 
     * @param {String} newRate.currency
     * @param {Number} newRate.rate
     * @param {Number} newRate.timestamp
     */
    updateBchPrice(newRate) {
      const index = this.bchRates.findIndex(_rate => _rate?.currency === newRate.currency)
      if (index >= 0) this.bchRates[index] = newRate
      else this.bchRates.push(newRate)
    },
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

      const getUsdRates = []
      const vsCurrencies = []
      if (currency === 'ARS') {
        getUsdRates.push(currency)
        vsCurrencies.push('USD')
      } else {
        vsCurrencies.push(currency)
      }

      getUsdRates.map(this.refreshUsdPrice)
      return axios.get(
        'https://api.coingecko.com/api/v3/simple/price/',
        {
          params: { ids: 'bitcoin-cash', vs_currencies: vsCurrencies.join(',') }
        }
      )
        .then(response => {
          const bchRatesData = response?.data?.['bitcoin-cash']
          if (!bchRatesData) return Promise.reject({ response })
          const newRates = Object.getOwnPropertyNames(bchRatesData).forEach(_currency => {
           const rateValue = bchRatesData[_currency]
           if (!rateValue) return
           const newRate = { currency: _currency.toLocaleUpperCase(), rate: rateValue, timestamp: Date.now() }
            this.updateBchPrice(newRate)
          }) 
          return Promise.resolve(newRates)
        })
    },
    /**
     * 
     * @param {Object} newRate 
     * @param {String} newRate.currency
     * @param {Number} newRate.rate
     * @param {Number} newRate.timestamp
     */
    updateUsdPrice(newRate) {
      const index = this.usdRates.findIndex(_rate => _rate?.currency === newRate.currency)
      if (index >= 0) this.usdRates[index] = newRate
      else this.usdRates.push(newRate)
    },
    /**
     * @param {String} currency 
     * @param {Object} opts 
     * @param {Number} opts.age will skip update when rate timestamp is less than age of 
     */
    async refreshUsdPrice(currency, opts) {
      if (!currency) return Promise.reject()
      const _currency = currency.toUpperCase()

      const rate = this.usdRates.find(rateData => rateData.currency === _currency)
      if (rate?.timestamp && opts?.age && Date.now() - opts?.age <= rate?.timestamp) {
        return Promise.resolve(rate)
      }

      const { data } = await axios.get(`https://api.yadio.io/rate/${_currency}/USD`)
      if (!data.rate) return Promise.reject()
      const newRate = { currency: String(_currency), rate: data.rate, timestamp: data?.timestamp }
      this.updateUsdPrice(newRate)

      return newRate
    }
  },
})
