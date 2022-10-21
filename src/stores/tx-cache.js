import { defineStore } from 'pinia';

/**
 * @typedef {Object} TxRecord - data structured returned from watchtower's wallet history API
 * @property {String} record_type - "incoming" | "outgoing"
 * @property {String} txid - transaction hash
 * @property {Number} amount - balance change of a wallet hash(not an address)
 * @property {String} token - token id or "bch"
 * @property {Number} tx_fee - transaction fee in satoshis
 * @property {Object[]} senders - 2d array of senders/inputs: [address, amount][]
 * @property {Object[]} recipients - 2d array of recipients/outputs: [adress, amount][]
 * @property {String} date_created - timestamp of the record being created in server, not the transaction in blockchain. Is in ISO format
 * 
 */

/**
 * @typedef {Object} PageRecord
 * @property {Number} num_pages
 * @property {String} page
 * @property {Boolean} has_next
 * @property {TxRecord[]} history
 * @property {Number} __cachedAt__
 * 
 * @typedef {Map<String, PageRecord>} PageCacheMap - map of page data to a string of txids
 */
export const useTxCacheStore = defineStore('tx-cache', {
  state: () => ({
    /** @type {PageCacheMap} */
    pages: {},
  }),

  getters: {
    getPage() {
      return function(pageKey='') {
        if (!this.pages[pageKey]) return
        let page = Object.assign({}, this.pages[pageKey])
        return page
      }
    }
  },

  actions: {
    /**
     * 
     * @param {String} pageKey 
     * @param {{has_next:Boolean, history: TxRecord[], num_pages:Number, page: String }} transactions 
     */
    cachePage(pageKey, transactions) {
      if (!Array.isArray(transactions?.history)) return

      this.pages[pageKey] = {
        num_pages: transactions?.num_pages,
        page: transactions?.page,
        has_next: transactions?.has_next,
        history: transactions?.history,
        __cachedAt__: Date.now(),
      }

      return this.pages[pageKey]
    },
    removePageCache(pageKey='') {
      delete this.pages[pageKey]
    },
    removeOldPageCache(age=86400) {
      const now = Date.now()
      const cutoffTime = now - (age * 1000)
      for (let pageKey in this.pages) {
        const valid = this.pages[pageKey]?.__cachedAt__ >= cutoffTime
        if (!valid) this.removePageCache(pageKey)
      }
    },
    clearPageCache() {
      this.pages = {}
    },
  }
})
