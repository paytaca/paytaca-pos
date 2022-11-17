import { defineStore } from 'pinia';
import { sha256, decodePaymentUri } from 'src/wallet/utils';

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

    /**
     * Txs in home does not reflect immediately after payment received, especially when;
     * POS device is offline. The qr data is stored here to display as an unconfirmed tx in the list;
     * @type {String[]} */
    unconfirmedTxsFromQrData: [],
  }),

  getters: {
    getPage() {
      return function(pageKey='') {
        if (!this.pages[pageKey]) return
        let page = Object.assign({}, this.pages[pageKey])
        return page
      }
    },
    unconfirmedPayments() {
      const unconfirmedPaymentLinkData = this.unconfirmedTxsFromQrData
        .filter(Boolean)
        .map(qrData => {
          try {
            const decoded = decodePaymentUri(qrData)
            decoded.qrDataHash = sha256(qrData)
            return decoded
          } catch(error) {
            console.error(error)
            console.error('Failed to decode unconfirmed payment link:', qrData)
          }
        })
        .filter(data => data?.address)
      return unconfirmedPaymentLinkData
    },
    lastUnconfirmedPayment() {
      const unconfirmedTxsCopy = [...this.unconfirmedPayments]
      return unconfirmedTxsCopy.sort((tx1, tx2) => {
        return tx2?.parameters?.ts - tx1?.parameters?.ts
      })[0]
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
    addQrDataToUnconfirmedPayments(qrData='') {
      if (!qrData) return
      if (!decodePaymentUri(qrData)?.address) return

      this.unconfirmedTxsFromQrData.push(qrData)
      this.unconfirmedTxsFromQrData = this.unconfirmedTxsFromQrData
        .filter((e,i,s) => s.indexOf(e) === i) // filter for removing duplicates
    },
    removeQrDataFromUnconfirmedPayments(qrDataToRemove='') {
      this.unconfirmedTxsFromQrData = this.unconfirmedTxsFromQrData
        .filter(qrData => qrDataToRemove !== qrData)
    }
  }
})
