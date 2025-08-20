import { isHex } from '@bitauth/libauth';
import axios from 'axios'
import { defineStore } from 'pinia';
import { backend } from 'src/marketplace/backend';

export const useMarketStore = defineStore('market', {
  state: () => ({
    bchRates: [
      { currency: '', rate: 0, timestamp: 0, category: '' },
    ],
    lastRate: 0
  }),


  actions: {
    getRate(currency, resetLastRate = false) {
      const bchRate = this.bchRates.find(rate => rate.currency === currency)
      if (!bchRate) return

      const status = this.getRateStatus(bchRate.rate)
      if (resetLastRate) this.lastRate = 0

      return {
        ...bchRate,
        status,
      }
    },

    getTokenRate(category) {
      return this.bchRates.find(rate => rate.category === category)
    },

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
     * @param {String} newRate.category
     */
    updateBchPrice(newRate) {
      const index = this.bchRates.findIndex(_rate => {
        return _rate?.currency === newRate.currency && _rate.category === newRate.category
      })
      if (index >= 0) this.bchRates[index] = newRate
      else this.bchRates.push(newRate)
    },
    async refreshBchPrice(categorOrCurrency, opts) {
      if (typeof categorOrCurrency !== 'string') return Promise.reject()

      if (categorOrCurrency?.startsWith?.('fiat/')) {
        return this.refreshCurrencyBchPrice(categorOrCurrency.replace('fiat/', ''), opts)
      }
      if (categorOrCurrency?.startsWith?.('ct/')) {
        return this.refreshTokenBchPrice(categorOrCurrency.replace('ct/', ''), opts)
      }

      if (isHex(categorOrCurrency) && categorOrCurrency.length == 64) {
        return this.refreshTokenBchPrice(categorOrCurrency, opts)
      }

      return this.refreshCurrencyBchPrice(categorOrCurrency, opts)
    },
    async refreshCurrencyBchPrice(currency, opts) {
      if (!currency) return Promise.reject()
      if (!Array.isArray(this.bchRates)) return Promise.reject()

      currency = currency.toUpperCase()

      const rate = this.bchRates.find(_rate => _rate?.currency === currency)
      if (rate?.timestamp && opts?.age && Date.now() - opts?.age <= rate?.timestamp) {
        return Promise.resolve(rate)
      }

      return axios.get(`https://watchtower.cash/api/bch-prices/`, { params: { currencies: currency }})
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
    refreshTokenBchPrice(category, opts) {
      if (!category) return Promise.reject()
      if (!Array.isArray(this.bchRates)) return Promise.reject()

      const rate = this.bchRates.find(_rate => _rate?.category === category)
      if (rate?.timestamp && opts?.age && Date.now() - opts?.age <= rate?.timestamp) {
        return Promise.resolve(rate)
      }

      return backend.get(`prices/bch/ct:${category}/`)
        .then(response => {
          const data = response?.data;
          const newRate = {
            category: category,
            rate: parseFloat(data?.price),
            timestamp: new Date(data?.timestamp) * 1,
          }

          if (!newRate.rate) return
          this.updateBchPrice(newRate);
          return newRate;
        })
    }
  },
})
