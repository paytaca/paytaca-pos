import Watchtower from 'watchtower-cash-js'
import BCHJS from '@psf/bch-js'
import { useTxCacheStore } from 'src/stores/tx-cache'

const bchjs = new BCHJS()
const projectId = process.env.WATCHTOWER_PROJECT_ID

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

  get xPubKey() {
    return this._xPubKey
  }

  set xPubKey(value) {
    this._xPubKey = value
    try {
      this._mainHDNode = bchjs.HDNode.fromXPub(this._xPubKey)
    } catch(error) {
      console.error(error)
      this._mainHDNode = null
    }
  }

  get mainHDNode() {
    return this._mainHDNode
  }

  getAddressSetAt(index) {
    const childNode = this.mainHDNode
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
   * @param {Number} opts.cacheAge
   * @param {'incoming' | 'outgoing'} [opts.type]
   */
  async getTransactions (opts) {
    const response = { success: false, transactions: null, error: undefined }
    const txCacheStore = useTxCacheStore()

    const cacheAge = opts?.cacheAge || 15 * 1000 // default age
    let pageKey = ''
    let cachedPageData

    try {
      const queryParams = {
        page: opts?.page || 1,
        posid: this.posId,
        include_attrs: true,
      }

      if (opts?.type === 'incoming' || opts?.type === 'outgoing') queryParams.type = opts.type

      pageKey = JSON.stringify(Object.assign({ walletHash: this.walletHash }, queryParams))
      cachedPageData = txCacheStore.getPage(pageKey)
      if (cachedPageData?.__cachedAt__ >= Date.now() - cacheAge) {  
        response.success = true
        response.transactions = cachedPageData
      } else {
        const request = await this.watchtower.BCH._api.get(`history/wallet/${this.walletHash}/`, { params: queryParams })
        response.success = true
        response.transactions = request?.data
        txCacheStore.cachePage(pageKey, response.transactions)
      }
    } catch(error) {
      console.error(error)
      response.success = false
      response.error = error
    }

    // get cached txs if unsuccessfully taken transactions from server
    if (!response.success && pageKey && cachedPageData) {
      response.success = true
      response.transactions = cachedPageData
    }
    return response
  }
}
