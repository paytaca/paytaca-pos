import Watchtower from 'watchtower-cash-js';
import { defineStore } from 'pinia';
import { Wallet } from 'src/wallet';
import { useAddressesStore } from './addresses';
import {
  sha256,
  decodePaymentUri,
  getPubkeyAt,
} from 'src/wallet/utils';
import { summarizeSalesReports } from 'src/utils/sales-report';
import { useCashtokenStore } from './cashtoken';


export const useWalletStore = defineStore('wallet', {
  state: () => ({
    posId: -1,
    walletHash: null,
    xPubKey: null,
    linkCode: null,
    firstReceivingAddress: null,

    deviceInfo: {
      name: '',
      posId: -1,
      walletHash: null,
      merchantId: null,
      branchId: null,
      linkedDevice: {
        linkCode: '',
        name: '',
        deviceModel: '',
        os: '',
        isSuspended: false,
        unlinkRequest: {
          id: 0,
          force: false,
          signature: '',
          nonce: 0,
          updatedAt: '',
        },
      },
    },

    merchantInfo: {
      id: 0,
      walletHash: '',
      name: '',
      primaryContactNumber: '',
      location: {
        landmark: '',
        location: '',
        street: '',
        city: '',
        country: '',
        longitude: null,
        latitude: null,
      }
    },

    branchInfo: {
      id: 0,
      name: '',
      location: {
        landmark: '',
        location: '',
        street: '',
        city: '',
        country: '',
        longitude: null,
        latitude: null,
      },
    },

    preferences: {
      selectedCurrency: 'USD',
    },

    salesReport: {
      timestampFrom: 0,
      timestampTo: 0,
      data: [{ month: 0, year: 0, day: 0, total: 0, currency: 0, totalMarketValue: 0, count: 0, ftCategory: '' }],
    },

    qrDataTimestampCache: {
      hash: { qrData: '', timestamp: -1 },
      // '0a3d13aecf...': { qrData: 'bitcoincash:ead42...?amount=0.01', timestamp: 1665457793 }
      // '3d3ad2a8e0...': { qrData: 'bitcoincash:ead42...?amount=10.1', timestamp: 1639596781 }
      // ...
    }
  }),

  getters: {
    salesReportSummary() {
      return {
        today: this.salesReportToday,
        yesterday: this.salesReportYesterday,
        last7Days: this.salesReportPastWeek,
        lastMonth: this.salesReportPastMonth,
      }
    },
    salesReportToday() {
      const today = new Date()
      const recordsToday = this.salesReport.data.filter((record) => {
        return record?.year === today.getFullYear() &&
               record?.month-1 === today.getMonth() &&
               record?.day === today.getDate()
      })
      return summarizeSalesReports(recordsToday);
    },
    salesReportYesterday() {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const recordsYesterday = this.salesReport.data.filter((record) => {
        return record?.year === yesterday.getFullYear() &&
               record?.month-1 === yesterday.getMonth() &&
               record?.day === yesterday.getDate()
      })
      return summarizeSalesReports(recordsYesterday);
    },
    salesReportPastWeek() {
      const today = new Date()
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const records = this.salesReport.data.filter((record) => {
        const timestamp = new Date(record.year, record.month-1, record.day)
        return timestamp <= today && timestamp >= lastWeek
      })
      return summarizeSalesReports(records);
    },
    salesReportPastMonth() {
      const today = new Date()
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      const records = this.salesReport.data.filter((record) => {
        const timestamp = new Date(record.year, record.month-1, record.day)
        return timestamp <= today && timestamp >= lastMonth
      })
      return summarizeSalesReports(records)
    },
    walletHandle() {
      if (!this.walletHash) return ''
      return `${this.walletHash}:${this.posId}`
    },
    formattedMerchantAddress(state) {
      const formattedLocation = [
        state.merchantInfo?.location?.location || state.merchantInfo?.location?.landmark,
        state.merchantInfo?.location?.street,
        state.merchantInfo?.location?.city,
        state.merchantInfo?.location?.country,
      ].filter(Boolean).join(', ')
      return formattedLocation
    },
    formattedBranchAddress(state) {
      const formattedLocation = [
        state.branchInfo?.location?.location || state.branchInfo?.location?.landmark,
        state.branchInfo?.location?.street,
        state.branchInfo?.location?.city,
        state.branchInfo?.location?.country,
      ].filter(Boolean).join(', ')
      return formattedLocation
    },
    getWalletHash (state) {
      return state.walletHash
    },
    isLinked() {
      return Boolean(this.walletHash && this.posId >= 0)
    },
    isDeviceValid() {
      return this.linkCode == this.deviceInfo.linkedDevice.linkCode
    },
    walletObj(state) {
      return new Wallet({
        walletHash: state.walletHash,
        xPubKey: state.xPubKey,
        posId: state.posId,
      })
    }
  },
  
  actions: {
    /**
     * @param {Object} state 
     * @param {Object} data
     * @param {Number} data.id
     * @param {String} data.name
     * @param {String} data.wallet_hash
     * @param {String} data.primary_contact_number
     * 
     * @param {Object} [data.location]
     * @param {String} data.location.landmark
     * @param {String} data.location.location
     * @param {String} data.location.street
     * @param {String} data.location.city
     * @param {String} data.location.country
     * @param {String} data.location.longitude
     * @param {String} data.location.latitude
    */
    setMerchantInfo(data) {
      const merchantInfo = {
        id: data?.id,
        walletHash: data?.wallet_hash,
        name: data?.name,
        primaryContactNumber: data?.primary_contact_number,
        location: {
          landmark: data?.location?.landmark,
          location: data?.location?.location,
          street: data?.location?.street,
          city: data?.location?.city,
          country: data?.location?.country,
          longitude: data?.location?.longitude,
          latitude: data?.location?.latitude,
        },
      }

      this.merchantInfo = merchantInfo
    },
    refetchMerchantInfo() {
      if (!this.walletHash || Number.isNaN(this.deviceInfo.merchantId)) return this.setMerchantInfo(null)
      if (!this.deviceInfo.merchantId) return this.setMerchantInfo(null)

      const watchtower = new Watchtower()
      return watchtower.BCH._api.get(`paytacapos/merchants/${this.deviceInfo.merchantId}/`)
        .then(response => {
          if (response?.data?.wallet_hash == this.walletHash) {
            this.setMerchantInfo(response.data)
            return Promise.resolve(response)
          }
          return Promise.reject({ response })
        })
        .catch(error => {
          if (error?.response.status === 404) {
            this.setMerchantInfo(null)
            return
          }
          return Promise.reject(error)
        })
    },
    /**
     * @param {Object} data 
     * @param {String} data.wallet_hash
     * @param {Number} data.posid
     * @param {Number} data.branch_id
     * @param {Number} data.merchant_id
     * @param {Object} [data.linked_device]
     * @param {String} [data.linked_device.link_code]
     * @param {String} [data.linked_device.name]
     * @param {String} [data.linked_device.device_model]
     * @param {String} [data.linked_device.os]
     * @param {Boolean} data.linked_device.is_suspended
     * @param {Object} [data.linked_device.unlink_request]
     * @param {Number} data.linked_device.unlink_request.id
     * @param {Boolean} data.linked_device.unlink_request.force
     * @param {Number} data.linked_device.unlink_request.nonce
     * @param {String} data.linked_device.unlink_request.signature
     * @param {String} data.linked_device.unlink_request.updated_at
     */
    setDeviceInfo(data) {
      this.deviceInfo = {
        name: data?.name,
        walletHash: data?.wallet_hash,
        posId: data?.posid,
        branchId: data?.branch_id,
        merchantId: data?.merchant_id,
        linkedDevice: {
          linkCode: data?.linked_device?.link_code,
          name: data?.linked_device?.name,
          deviceModel: data?.linked_device?.device_model,
          os: data?.linked_device?.os,
          isSuspended: data?.linked_device?.is_suspended,
          unlinkRequest: {
            id: data?.linked_device?.unlink_request?.id,
            force: data?.linked_device?.unlink_request?.force,
            nonce: data?.linked_device?.unlink_request?.nonce,
            signature: data?.linked_device?.unlink_request?.signature,
            updatedAt: data?.linked_device?.unlink_request?.updated_at,
          },
        }
      }
    },
    refetchDeviceInfo() {
      if (!this.walletHandle) {
        this.setDeviceInfo(null)
        this.setBranchInfo(null)
        return
      }
      const watchtower = new Watchtower()
      return watchtower.BCH._api.get(`paytacapos/devices/${this.walletHandle}/`)
        .then(response => {
          if (response?.data?.wallet_hash == this.walletHash) {
            this.setDeviceInfo(response.data)
            return Promise.resolve(response)
          }
          return Promise.reject({ response })
        })
        .catch(error => {
          if (error?.response.status === 404) {
            this.setDeviceInfo(null)
            return
          }
          return Promise.reject(error)
        })
        .finally(() => {
          this.refetchBranchInfo()
          this.refetchMerchantInfo()
        })
    },
    confirmUnlinkRequest() {
      const pubkey = getPubkeyAt(this.xPubKey, this.deviceInfo.linkedDevice.unlinkRequest.nonce)
      const watchtower = new Watchtower()
      return watchtower.BCH._api.post(`paytacapos/devices/${this.walletHandle}/unlink_device/`, { verifying_pubkey: pubkey })
    },
    cancelUnlinkRequest() {
      const watchtower = new Watchtower()
      return watchtower.BCH._api.post(`paytacapos/devices/${this.walletHandle}/unlink_device/cancel/`)
    },
    /**
     * @param {Object} data 
     * @param {Number} data.id
     * @param {String} data.name
     * @param {Object} [data.location]
     * @param {String} data.location.landmark
     * @param {String} data.location.location
     * @param {String} data.location.street
     * @param {String} data.location.city
     * @param {String} data.location.country
     * @param {String} data.location.longitude
     * @param {String} data.location.latitude
     */
    setBranchInfo(data) {
      this.branchInfo = {
        id: data?.id,
        name: data?.name,
        location: {
          landmark: data?.location?.landmark,
          location: data?.location?.location,
          street: data?.location?.street,
          city: data?.location?.city,
          country: data?.location?.country,
          longitude: data?.location?.longitude,
          latitude: data?.location?.latitude,
        },
      }
    },
    refetchBranchInfo() {
      if (!this.walletHash || Number.isNaN(this.deviceInfo.branchId)) return this.setBranchInfo(null)
      if (!this.deviceInfo.branchId) return this.setBranchInfo(null)
      const watchtower = new Watchtower()
      const params = { wallet_hash: this.deviceInfo.walletHash }
      return watchtower.BCH._api.get(`paytacapos/branches/${this.deviceInfo.branchId}/`, { params })
        .then(response => {
          if (response?.data?.id) {
            this.setBranchInfo(response.data)
            return Promise.resolve(response)
          }
          return Promise.reject({ response })
        })
        .catch(error => {
          if (error?.response.status === 404) {
            this.setBranchInfo(null)
          }
        })
    },
    /**
     * @param {Object} data 
     * @param {Object} data.selected_currency
     */
    setPreferences(data) {
      this.preferences.selectedCurrency = data?.selected_currency || 'USD'
    },
    refetchPreferences() {
      if (!this.walletHash) return
      const watchtower = new Watchtower()
      return watchtower.BCH._api.get(`/wallet/preferences/${this.walletHash}/`)
        .then(response => {
          this.setPreferences(response?.data)
        })
    },
    refetchSalesReportTokenMetadata() {
      const ftCategories = this.salesReport.data
        .map(data => data.ftCategory)
        .filter(Boolean)
        .filter((element, index, list) => list.indexOf(element) === index)

      const cashtokenStore = useCashtokenStore();
      return ftCategories
        .filter(category => !cashtokenStore.getTokenMetadata(category))
        .map(category => cashtokenStore.fetchTokenMetadata(category))
    },
    async refetchSalesReport() {
      if (!this.walletHash) return this.clearSalesReport()
      const today = new Date()
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      const params = {
        to: Math.floor(today / 1000),
        from: Math.floor(lastMonth / 1000),
        currency: this.preferences.selectedCurrency,
        range: 'day',
        posid: this.posId,
      }
      const watchtower = new Watchtower()
      return watchtower.BCH._api.get(`paytacapos/devices/sales_report/${this.walletHash}/`, { params })
        .then(response => {
          const salesReport = {
            timestampFrom: response?.data?.timestamp_from,
            timestampTo: response?.data?.timestamp_to,
            data: [],
          }

          if (Array.isArray(response?.data?.data)) {
            salesReport.data = response?.data?.data.map(record => {
              return {
                year: record?.year,
                month: record?.month,
                day: record?.day,
                total: record?.total,
                currency: record?.currency,
                totalMarketValue: record?.total_market_value,
                count: record?.count,
                ftCategory: record?.ft_category,
              }
            })
          }

          this.salesReport = salesReport
        })
    },
    clearSalesReport() {
      this.salesReport.timestampFrom = 0
      this.salesReport.timestampTo = 0
      this.salesReport.data = []
    },
    /**
     * Remove qr data older than age specified in seconds
     * @param {Number} age seconds
     */
    removeOldQrDataCache(age=86400) {
      const now = Math.floor(Date.now()/1000)
      const cutoffTimestamp = now - age
      for (const qrDataHash in this.qrDataTimestampCache) {
        const timestamp = this.qrDataTimestampCache[qrDataHash]?.timestamp
        if (cutoffTimestamp > timestamp || !Number.isSafeInteger(timestamp)) delete this.qrDataTimestampCache[qrDataHash]
      }
    },
    clearQrDataTimestampCache() {
      this.qrDataTimestampCache = {}
    },
    /**
     * QR data must be BIP0021 URI with unix-timestamp 'ts' property in parameters or;
     * a valid Paytaca payment uri
     * @param {String} qrData 
     */
    cacheQrData(qrData='') {
      if (!qrData) return

      const paymentLinkData = decodePaymentUri(qrData)
      const timestamp = Number(paymentLinkData?.parameters?.ts)
      if (!paymentLinkData?.address || !Number.isSafeInteger(timestamp)) return

      const qrDataHash = sha256(qrData)
      this.qrDataTimestampCache[qrDataHash] = {
        qrData: qrData,
        timestamp: timestamp,
      }
    },
    clearAll() {
      this.walletHash = ''
      this.posId = -1
      this.xPubKey = ''
      this.linkCode = ''
      this.setDeviceInfo(null)
      this.setBranchInfo(null)
      this.setMerchantInfo(null)
      this.setPreferences(null)
      this.clearQrDataTimestampCache()
      this.clearSalesReport()
      const addressesStore = useAddressesStore()
      addressesStore.addressSets = []
    }
  }
})
