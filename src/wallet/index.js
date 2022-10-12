import Watchtower from 'watchtower-cash-js'
import BCHJS from '@psf/bch-js'
import { generateTOTP } from './utils'

const bchjs = new BCHJS()
const projectId = process.env.WATCHTOWER_PROJECT_ID

const TOTP_SECRET_KEY = process.env.TOTP_SECRET_KEY

class PaymentIndexValidator {
  static MAX_UNHARDENED_ADDRESS_INDEX = 2**31-1
  static POS_DEVICE_ID_DIGITS = 4
  static MAX_POS_DEVICE_ID_COUNT = 10**this.POS_DEVICE_ID_DIGITS
  static MAX_POSID = this.MAX_POS_DEVICE_ID_COUNT-1
  static MAX_PAYMENT_INDEX = Math.floor(
    this.MAX_UNHARDENED_ADDRESS_INDEX/this.MAX_POS_DEVICE_ID_COUNT
  )
  static MAX_POSID_ON_MAX_PAYMENT_INDEX = this.MAX_UNHARDENED_ADDRESS_INDEX % this.MAX_POS_DEVICE_ID_COUNT

  static validate(paymentIndex, posId) {
    const response = { valid: true, error: undefined }
    try {
      if (!paymentIndex) throw 'Invalid payment index'
      if (paymentIndex % 1 !== 0) throw 'Payment index must be integer'

      if (posId > this.MAX_POSID) {
        throw `POS ID is greater than max: ${this.MAX_POSID}`
      }

      if (paymentIndex > this.MAX_PAYMENT_INDEX) {
        throw `Payment index is greater than max: ${this.MAX_PAYMENT_INDEX}`
      }

      // string concatenation of MAX_PAYMENT_INDEX and MAX_POSID_ON_MAX_PAYMENT_INDEX equals to;
      // MAX_UNHARDENED_ADDRESS_INDEX
      // this condition checks if it is greater than MAX_UNHARDENED_ADDRESS_INDEX
      if (paymentIndex == this.MAX_PAYMENT_INDEX && posId > MAX_POSID_ON_MAX_PAYMENT_INDEX) {
        throw `Invalid POSID on max payment index`
      }

      response.valid = true
    } catch(error) {
      response.valid = false
      response.error = error
    }
    return response
  }
}


export class Wallet {
  static paymentIndexValidator = PaymentIndexValidator

  /**
   * @param {Object} conf 
   * @param {String} conf.walletHash 
   * @param {String} conf.xPubKey 
   * @param {Number} conf.posId 
   */
  constructor(conf) {
    this.projectId = projectId
    this.walletHash  = conf?.walletHash
    this.xPubKey  = conf?.xPubKey
    this.posId  = conf?.posId

    this.watchtower = new Watchtower()
  }

  get paddedPosId() {
    let value = "00000" + this.posId.toString()
    const digits = Wallet.paymentIndexValidator.POS_DEVICE_ID_DIGITS
    if (value.length > digits) value = value.substring(value.length-digits)
    return value
  }

  generateOtp(opts) {
    const secret = `${TOTP_SECRET_KEY}:${this.walletHash}-${this.posId}`
    return generateTOTP(secret, opts) 
  }

  /**
   * 
   * @param {String} otp
   * @param {Object} opts 
   * @param {Number} [opts.digits]
   * @param {Number} [opts.interval]
   * @param {Number} [opts.offset]
   * @param {Number} [opts.refTimestamp]
   * @param {Number} [opts.prevWindows] number of previous windows of OTPs that can be regarded as valid
   * @param {Number} [opts.nextWindows] number of future windows of OTPs that can be regarded as valid
   */
  checkOTP(otp, opts) {
    const response = { valid: false, otps: [], matchIndex: -1 }
    const _opts = {
      digits: opts?.digits || 6,
      interval: opts?.interval || 30,
      offset: opts?.offset || 0,
    }
    const prevWindows = Number.isSafeInteger(opts?.prevWindows) ? opts?.prevWindows : 3
    const nextWindows = Number.isSafeInteger(opts?.nextWindows) ? opts?.nextWindows : 0

    let startTimestamp = Math.floor(Date.now()/1000)
    if (Number.isSafeInteger(opts?.refTimestamp)) startTimestamp = opts.refTimestamp
    for (var i = -prevWindows; i <= nextWindows; i++) {
      _opts.timestamp = startTimestamp + (_opts.interval * i)
      const generatedOTP = this.generateOtp(_opts)
      response.otps.push(generatedOTP)
      if (otp === generatedOTP) {
        response.valid = true
        response.matchIndex = i
        return response
      }
    }

    return response
  }

  getAddressSetAt(index) {
    const childNode = bchjs.HDNode.fromXPub(this.xPubKey)
    const receivingAddressNode = childNode.derivePath('0/' + index.toString())
    const changeAddressNode = childNode.derivePath('1/' + index.toString())
    return {
      receiving: bchjs.HDNode.toCashAddress(receivingAddressNode),
      change: bchjs.HDNode.toCashAddress(changeAddressNode)
    }
  }

  async getNewAddressSet (index, opts = { skipSubscription: true }) {
    const addresses = this.getAddressSetAt(index)
    const data = {
      addresses,
      projectId: this.projectId,
      walletHash: this.walletHash,
      addressIndex: index
    }

    if (opts?.skipSubscription) return addresses

    const result = await this.watchtower.subscribe(data)
    if (result.success) {
      return addresses
    } else {
      if (result?.error) console.error(result.error)
      return null
    }
  }

  /**
   * 
   * @param {Number} paymentIndex 
   */
  async generateReceivingAddress(paymentIndex=1, opts = { skipSubscription: true }) {
    const validation = Wallet.paymentIndexValidator.validate(paymentIndex, this.posId)
    if (!validation.valid) throw validation.error

    const addressIndex = Number(paymentIndex.toString() + this.paddedPosId)
    const addressSet = await this.getNewAddressSet(addressIndex, opts)
    return {
      receiving: addressSet.receiving,
      change: addressSet.change,
      index: Number(addressIndex),
    }
  }

  async getLastPaymentIndex() {
    const response = { paymentIndex: undefined, error: undefined }
    try {
      const apiResponse = await this.watchtower.BCH._api.get(
        `last-address-index/wallet/${this.walletHash}/`,
        { params: { with_tx: true, posid: this.posId } },
      )
      if (Number.isInteger(apiResponse?.data?.address?.payment_index)) {
        response.paymentIndex = apiResponse.data.address.payment_index
      }
    } catch(error) {
      console.error(error)
      response.error = error
    }
    return response
  }

  /**
   * 
   * @param {Object} opts
   * @param {Number} opts.page
   * @param {'incoming' | 'outgoing'} [opts.type]
   */
  async getTransactions (opts) {
    const response = { success: false, transactions: null, error: undefined }
    try {
      const queryParams = {
        page: opts?.page || 1,
        posid: this.posId
      }

      if (opts?.type === 'incoming' || opts?.type === 'outgoing') queryParams.type = opts.type

      const request = await this.watchtower.BCH._api.get(`history/wallet/${this.walletHash}/`, { params: queryParams })
      response.success = true
      response.transactions = request?.data
    } catch(error) {
      console.error(error)
      response.success = false
      response.error = error
    }
    return response
  }
}
