import Watchtower from 'watchtower-cash-js';
import { defineStore } from 'pinia';
import { Wallet } from 'src/wallet';
import { useAddressesStore } from './addresses';
import {
  sha256,
  decodePaymentUri,
  getPubkeyAt,
  pubkeyToCashAddress,
} from 'src/wallet/utils';


export const useWalletStore = defineStore('wallet', {
  state: () => ({
    posId: -1,
    walletHash: null,
    xPubKey: null,
    linkCode: null,

    deviceInfo: {
      name: '',
      posId: -1,
      walletHash: null,
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
      },
      vault: {
        receiving: {
          address: '',
          pubkey: '',
        },
        signer: {
          address: '',
          pubkey: '',
        },
        address: '',
        tokenAddress: '',
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
      data: [{ month: 0, year: 0, day: 0, total: 0, currency: 0, totalMarketValue: 0, count: 0 }],
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
      const data = {
        today: { total: 0, currency: 0, totalMarketValue: 0, count: 0 },
        yesterday: { total: 0, currency: 0, totalMarketValue: 0, count: 0 },
        last7Days: this.salesReportPastWeek,
        lastMonth: this.salesReportPastMonth,
      }
      const today = new Date()
      Object.assign(
        data.today,
        this.salesReport.data.find((record) => record?.year === today.getFullYear() && record?.month-1 === today.getMonth() && record?.day === today.getDate()),
      )

      data.today.total = Number(data.today.total.toFixed(8))
      data.today.totalMarketValue = Number(data.today.totalMarketValue.toFixed(2))

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      Object.assign(
        data.yesterday,
        this.salesReport.data.find((record) => record?.year === yesterday.getFullYear() && record?.month-1 === yesterday.getMonth() && record?.day === yesterday.getDate()),
      )
      data.yesterday.total = Number(data.yesterday.total.toFixed(8))
      data.yesterday.totalMarketValue = Number(data.yesterday.totalMarketValue.toFixed(2))
      return data
    },
    salesReportPastWeek() {
      const data = { total: 0, currency: 0, totalMarketValue: 0, count: 0 }
      const today = new Date()
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      const records = this.salesReport.data.filter((record) => {
        const timestamp = new Date(record.year, record.month-1, record.day)
        return timestamp <= today && timestamp >= lastWeek
      })

      const currencies = records.map(record => record?.currency).filter(Boolean).filter((e, i, l) => l.indexOf(e) === i)
      const hasMissingMarketValue = records.find(record => !record?.totalMarketValue || !record?.currency)
      data.total = records.reduce((subtotal, record) => subtotal + record.total, 0)
      data.count = records.reduce((subtotal, record) => subtotal + record.count, 0)
      if (currencies.length === 1 && !hasMissingMarketValue) {
        data.currency = records?.[0]?.currency
        data.totalMarketValue = records.reduce((subtotal, record) => subtotal + record.totalMarketValue, 0)
      }

      data.total = Number(data.total.toFixed(8))
      data.totalMarketValue = Number(data.totalMarketValue.toFixed(2))
      return data
    },
    salesReportPastMonth() {
      const data = { total: 0, currency: 0, totalMarketValue: 0, count: 0 }
      const today = new Date()
      const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 7)
      const records = this.salesReport.data.filter((record) => {
        const timestamp = new Date(record.year, record.month-1, record.day)
        return timestamp <= today && timestamp >= lastMonth
      })

      const currencies = records.map(record => record?.currency).filter(Boolean).filter((e, i, l) => l.indexOf(e) === i)
      const hasMissingMarketValue = records.find(record => !record?.totalMarketValue || !record?.currency)
      data.total = records.reduce((subtotal, record) => subtotal + record.total, 0)
      data.count = records.reduce((subtotal, record) => subtotal + record.count, 0)
      if (currencies.length === 1 && !hasMissingMarketValue) {
        data.currency = records?.[0]?.currency
        data.totalMarketValue = records.reduce((subtotal, record) => subtotal + record.totalMarketValue, 0)
      }

      data.total = Number(data.total.toFixed(8))
      data.totalMarketValue = Number(data.totalMarketValue.toFixed(2))
      return data
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
     * @param {String} data.signer_pubkey
     * @param {String} data.receiving_pubkey
     * 
     * @param {Object} [data.location]
     * @param {String} data.location.landmark
     * @param {String} data.location.location
     * @param {String} data.location.street
     * @param {String} data.location.city
     * @param {String} data.location.country
     * @param {String} data.location.longitude
     * @param {String} data.location.latitude
     * @param {Object} [data.vault]
     * @param {String} data.vault.address
     * @param {String} data.vault.token_address
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
        vault: {
          receiving: {
            address: pubkeyToCashAddress(data?.receiving_pubkey),
            pubkey: data?.receiving_pubkey,
          },
          signer: {
            address: pubkeyToCashAddress(data?.signer_pubkey),
            pubkey: data?.signer_pubkey,
          },
          address: data?.vault?.address,
          tokenAddress: data?.vault?.token_address,
        }
      }

      this.merchantInfo = merchantInfo
    },
    refetchMerchantInfo() {
      if (!this.walletHash) return this.setMerchantInfo(null)
      const watchtower = new Watchtower()
      return watchtower.BCH._api.get(`paytacapos/merchants/${this.walletHash}/`)
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
          }
        })
    },
    /**
     * @param {Object} data 
     * @param {String} data.wallet_hash
     * @param {Number} data.posid
     * @param {Number} [data.branch_id]
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
          }
        })
        .finally(() => {
          this.refetchBranchInfo()
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
    refetchSalesReport() {
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
      watchtower.BCH._api.get(`paytacapos/devices/sales_report/${this.walletHash}/`, { params })
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
    verifyOtpForQrData(otp, qrData) {
      if (!qrData) return false
      const qrDataHash = sha256(qrData)
      let refTimestamp
      if (this.qrDataTimestampCache[qrDataHash]?.timestamp) refTimestamp = this.qrDataTimestampCache[qrDataHash]?.timestamp
      else refTimestamp = Math.floor(Date.now()/1000)

      if (!Number.isSafeInteger(refTimestamp)) return false

      const otpCheck = this.walletObj.checkOTP(otp, {
        prevWindows: 3, nextWindows: 2,
        refTimestamp: refTimestamp,
      })

      if (!otpCheck.valid) console.log('OTP mismatch for', otp, '. Valid otps:', otpCheck.otps)
      return otpCheck.valid
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
