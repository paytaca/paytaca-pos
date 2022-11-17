import { defineStore } from 'pinia';
import { Wallet } from 'src/wallet';
import { sha256, decodePaymentUri } from 'src/wallet/utils';

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    posId: -1,
    walletHash: null,
    xPubKey: null,
    qrDataTimestampCache: {
      hash: { qrData: '', timestamp: -1 },
      // '0a3d13aecf...': { qrData: 'bitcoincash:ead42...?amount=0.01', timestamp: 1665457793 }
      // '3d3ad2a8e0...': { qrData: 'bitcoincash:ead42...?amount=10.1', timestamp: 1639596781 }
      // ...
    }
  }),

  getters: {
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
