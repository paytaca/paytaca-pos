import Watchtower from 'watchtower-cash-js';
import { defineStore } from 'pinia';
import { Wallet } from 'src/wallet';
import { sha256, decodePaymentUri } from 'src/wallet/utils';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    posId: -1,
    walletHash: null,
    xPubKey: null,

    deviceInfo: {
      name: '',
      posId: -1,
      walletHash: null,
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
    },
    qrDataTimestampCache: {
      hash: { qrData: '', timestamp: -1 },
      // '0a3d13aecf...': { qrData: 'bitcoincash:ead42...?amount=0.01', timestamp: 1665457793 }
      // '3d3ad2a8e0...': { qrData: 'bitcoincash:ead42...?amount=10.1', timestamp: 1639596781 }
      // ...
    }
  }),

  getters: {
    formattedMerchantAddress(state) {
      const formattedLocation = [
        state.merchantInfo?.location?.location || state.merchantInfo?.location?.landmark,
        state.merchantInfo?.location?.street,
        state.merchantInfo?.location?.city,
        state.merchantInfo?.location?.country,
      ].filter(Boolean).join(', ')
      return formattedLocation
    },
    getWalletHash (state) {
      return state.walletHash
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
     * 
     * @param {Object} data 
     * @param {String} data.wallet_hash
     * @param {Number} data.posid
     * @param {String} data.name
     */
    setDeviceInfo(data) {
      this.deviceInfo = {
        name: data?.name,
        walletHash: data?.wallet_hash,
        posId: data?.posid,
      }
    },
    refetchDeviceInfo() {
      const handle = [this.walletHash, this.posId].join(':')
      const watchtower = new Watchtower()
      return watchtower.BCH._api.get(`paytacapos/devices/${handle}/`)
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
    }
  }
})
