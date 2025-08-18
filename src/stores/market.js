import axios from 'axios'
import { defineStore } from 'pinia';

export const useMarketStore = defineStore('market', {
  state: () => ({
    bchRates: [
      { currency: '', rate: 0, timestamp: 0 },
    ],
    lastRate: 0
  }),

  getters: {
    getRate() {
      return (currency, resetLastRate = false) => {
        const bchRate = this.bchRates.find(rate => rate.currency === currency)
        const bchRateUsed = bchRate && currency !== 'ARS'
        let rate = 0

        if (bchRateUsed) {
          rate = bchRate.rate
        } else {
          const bchUsdRate = this.bchRates.find(rate => rate.currency === 'USD')
          if (!bchUsdRate) return
          const usdRate = this.usdRates.find(rate => rate.currency === currency)
          if (!usdRate) return
          
          rate = bchUsdRate.rate * usdRate.rate
        }

        const status = this.getRateStatus(rate)
        if (resetLastRate) this.lastRate = 0

        if (bchRateUsed) {
          return {
            ...bchRate,
            status,
            rate,
          }
        }
        return {
          currency: usdRate.currency,
          timestamp: usdRate.timestamp,
          status,
          rate
        }
      }
    }
  },

  actions: {
    getRateStatus (rate) {
      const status = {
        increased: 1,
        decreased: -1,
        unchanged: 0
      }
      let finalStatus = status.unchanged

      if (this.lastRate !== 0) {
        if (this.lastRate < rate) finalStatus = status.increased
        else if (this.lastRate > rate) finalStatus = status.decreased
      }
      this.lastRate = rate

      return finalStatus
    },
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
    refreshBchPrice(currency, opts) {
      if (!currency) return Promise.reject()
      if (!Array.isArray(this.bchRates)) return Promise.reject()

      currency = currency.toUpperCase()

      const rate = this.bchRates.find(_rate => _rate?.currency === currency)
      if (rate?.timestamp && opts?.age && Date.now() - opts?.age <= rate?.timestamp) {
        return Promise.resolve(rate)
      }

      return axios.get(`https://watchtower.cash/api/bch-prices`, { params: { currencies: currency }})
        .catch(() => this.refreshBchPriceOld(currency, opts))
        .then(response => {
          const priceData = response?.data?.find?.(result => result?.relative_currency === 'BCH' && result?.currency === currency)
          if (!priceData) return Promise.reject({ response })
          const newRate = {
            currency: priceData?.currency,
            rate: parseFloat(priceData?.price_value),
            timestamp: new Date(priceData?.timestamp) * 1,
          }

          if (!newRate?.rate) return Promise.reject({ response })
          this.updateBchPrice(newRate)
          return newRate
        })
    },
  },
})
