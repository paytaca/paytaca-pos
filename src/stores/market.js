import axios from 'axios'
import { defineStore } from 'pinia';

export const useMarketStore = defineStore('market', {
  state: () => ({
    usdRates: [
      { currency: 'USD', rate: 1, timestamp: 0 },
    ],
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
    /**
     * @param {String} currency 
     * @param {Object} opts 
     * @param {Number} opts.age will skip update when rate timestamp is less than age of 
     */
    refreshBchPriceOld(currency, opts) {
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
      let url = 'https://api.coingecko.com/api/v3/simple/price/'
      const headers = {}
      const params = { ids: 'bitcoin-cash', vs_currencies: vsCurrencies.join(',') }
      if (process.env.COINGECKO_API_KEY) {
        url = 'https://pro-api.coingecko.com/api/v3/simple/price/'
        headers['x-cg-pro-api-key'] = process.env.COINGECKO_API_KEY
      }
      return axios.get(url, { headers, params })
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
