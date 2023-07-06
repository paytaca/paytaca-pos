import BCHJS from "@psf/bch-js"
import { createHmac, createHash } from "crypto"
import axios from 'axios'
import * as crypto from 'crypto'
import { parsePaytacaPaymentUri } from "./payment-uri"

const bchjs = new BCHJS()

/**
 * @param {Number} posId 
 */
 export function padPosId(posId, digits=4) {
  let val = String(posId)
  while(val.length < digits) {
    val = "0" + val
  }
  return val
}

/**
 * 
 * @param {String} secret digest string
 * @param {Object} [opts]
 * @param {Number} opts.digits
 * @param {Number} opts.interval
 * @param {Number} opts.offset
 * @param {Number} opts.timestamp
 */
export function generateTOTP(secret, opts) {
  const _opts = {
    digits: 6,
    interval: 30,
    offset: 0,
    timestamp: Math.floor(Date.now()/1000),
  }

  if (opts?.digits !== undefined) _opts.digits = opts.digits
  if (opts?.interval !== undefined) _opts.interval = opts.interval
  if (opts?.offset !== undefined) _opts.offset = opts.offset
  if (opts?.timestamp !== undefined) _opts.timestamp = opts.timestamp

  const timecode = Math.floor((_opts.timestamp - _opts.offset) / _opts.interval)

  const hexDigest = hmacSha256Hex(secret, timecode.toString())
  const digestNumber = BigInt('0x'+hexDigest).toString()
  let codeStr = digestNumber.substring(digestNumber.length-_opts.digits)
  while (codeStr.length < _opts.digits) {
    codeStr = "0" + codeStr
  }
  return codeStr
}

export function hmacSha256Hex(secret, message) {
  const hmac = createHmac("SHA256", Buffer.from(secret, "utf8"))
  hmac.update(Buffer.from(message, "utf8"))
  return hmac.digest().toString("hex")
}

export function sha256(data) {
  const sha256 = createHash('SHA256')
  sha256.update(Buffer.from(data, "utf8"))
  return sha256.digest().toString('hex')
}

/**
 * Allows JSON string or a pattern '{walletHash}|{xPubKey}|{posId}'
 * @param {String} data 
 */
export function parseWalletLinkData(data) {
  const response = { walletHash: '', xPubKey: '', posId: -1 }
  try {
    const parsedData = JSON.parse(data)
    parsedData.posId = Number(parsedData?.posId)
    if (parsedData?.walletHash && parsedData?.xPubKey && Number.isInteger(parsedData?.posId)) {
      response.walletHash = parsedData.walletHash
      response.xPubKey = parsedData.xPubKey
      response.posId =  parsedData.posId
    }
  } catch(error) {
    if (typeof data === 'string') {
      let [ walletHash, xPubKey, posId ] = data.split('|')
      posId = Number(posId)
      if (walletHash && xPubKey && Number.isInteger(posId)) {
        response.walletHash = walletHash
        response.xPubKey = xPubKey
        response.posId = posId
      }
    }
  }

  return response
}

export function decodePaymentUri(paymentUri) {
  const response = {
    address: '',
    amount: undefined,
    label: undefined,
    message: undefined,
    parameters: null,
  }

  if (paymentUri.startsWith('paytaca:')) {
    const decoded = parsePaytacaPaymentUri(paymentUri, { keepParsedParams: true })
    if (decoded?.outputs?.length) {
      const output = decoded?.outputs?.[0]
      response.address = output?.address
      response.amount = output?.amount?.value
      response.label = decoded?.name
      response.message = decoded?.message

      const parsedParams = { ts: decoded.timestamp }
      if (output?.amount?.currency) parsedParams.currency = output?.amount?.currency
      response.parameters = Object.assign(decoded?.otherParams, parsedParams)
      return response
    }
  }

  return decodeBIP0021URI(paymentUri)
}


/**
 * decoding a URI standard BIP 0021 used as bitcoin payment links
 * @param {String} uri 
 */
 export function decodeBIP0021URI(paymentUri) {
  const response = {
    address: '',
    amount: undefined,
    label: undefined,
    message: undefined,
    parameters: null,
  }
  const urlObject = new URL(paymentUri)
  if (!urlObject?.protocol || !urlObject?.pathname) return

  if (!bchjs.Address.isCashAddress(urlObject.protocol + urlObject.pathname)) return

  response.address = urlObject.protocol + urlObject.pathname

  const searchParams = Object.fromEntries(urlObject.searchParams.entries())
  if (searchParams.amount) {
    response.amount = Number(searchParams.amount)
    delete searchParams.amount
  }
  if (searchParams.label) {
    response.label = searchParams.label
    delete searchParams.label
  }
  if (searchParams.message) {
    response.message = searchParams.message
    delete searchParams.message
  }

  response.parameters = searchParams

  return response
}


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
 *
 * @param {String} qrData 
 * @param {TxRecord[]} txRecords
 * @param {Object} opts
 * @param {Boolean} opts.checkAmount
 */
export function paymentUriHasMatch(qrData, txRecords, opts) {
  let decodedPaymentUri = undefined
  try {
    decodedPaymentUri = decodePaymentUri(qrData)
  } catch(error) {
    if (error?.name === 'TypeError') return false
  }

  if (!Array.isArray(txRecords)) return false
  
  let bchAmount
  if (decodedPaymentUri.amount) {
    if (!decodedPaymentUri.parameters.currency || String(decodedPaymentUri.parameters.currency).toLowerCase() == 'bch') {
      bchAmount = decodedPaymentUri.amount
    }
  }

  return txRecords.find(txRecord => {
    if (!Array.isArray(txRecord?.recipients)) return false
    const createdDate = new Date(txRecord.date_created)
    const isCreatedAfterQrData = createdDate >= Number(decodedPaymentUri.parameters?.ts * 1000)
    if (bchAmount && opts?.checkAmount) {
      const recipientsMap = {}
      txRecord.recipients.forEach(recipient => {
        if (!recipient[0]) return
        const subtotal = recipientsMap[recipient[0]] || 0
        recipientsMap[recipient[0]] = subtotal + Number(recipient[1])
      })
      const AMOUNT_COMPARE_ERROR_MARGIN = 546
      const hasMatchingAmount = Math.abs(recipientsMap[decodedPaymentUri.address] - bchAmount * 10 ** 8) < AMOUNT_COMPARE_ERROR_MARGIN

      if (hasMatchingAmount && isCreatedAfterQrData) return txRecord
    } else {
      const hasMatchingRecipient = txRecord.recipients.some(recipient => recipient?.[0] === decodedPaymentUri.address)
      if (hasMatchingRecipient && isCreatedAfterQrData) return txRecord
    }
  })
}

/**
 * 
 * @typedef BitDBOutput
 * @property {String} a address, without the prefix 'bitcoincash:'
 * @property {Number} v value in satoshis
 * @property {Number} i index
 * @param {String} qrData 
 * @param {Object} opts
 * @param {Boolean} opts.checkAmount
 * @returns {{tx: {h: String}, out: BitDBOutput[] }}
 */
export async function findMatchingPaymentLink(qrData, opts) {
  let decodedPaymentUri = undefined
  try {
    decodedPaymentUri = decodePaymentUri(qrData)
  } catch(error) {
    if (error?.name === 'TypeError') return false
  }

  let bchAmount
  if (decodedPaymentUri.amount) {
    if (!decodedPaymentUri.parameters.currency || String(decodedPaymentUri.parameters.currency).toLowerCase() == 'bch') {
      bchAmount = decodedPaymentUri.amount
    }
  }

  // qpdfdtdf7x27gpvtmlgmgeem2wgrlemqky67jycqde
  const truncatedAddress = decodedPaymentUri.address.replace('bitcoincash:', '')
  const query = `{
    "v": 3,
    "q": {
      "find": {
        "out.e.a": "${truncatedAddress}",
        "blk.t": {"$gte": ${decodedPaymentUri.parameters.ts} }
      },
      "project": { "tx.h": 1, "out.e": 1 },
      "limit": 10
    }
  }`

  const url = `https://bitdb.bch.sx/q/${btoa(query)}`
  const {data: responseData} = await axios.get(url)
  const txs = []
  if (Array.isArray(responseData.c)) responseData.c.forEach(tx => txs.push(tx))
  if (Array.isArray(responseData.u)) responseData.u.forEach(tx => txs.push(tx))
  
  if (bchAmount && opts?.checkAmount) {
    const filteredTxs = txs.filter(tx => {
      if (!Array.isArray(tx?.out)) return false

      const totalReceived = tx.out
        .filter(output => output.a === truncatedAddress)
        .reduce((subtotal, output) => subtotal + output?.v, 0)
      const AMOUNT_COMPARE_ERROR_MARGIN = 546
      const hasMatchingAmount = Math.abs(totalReceived - bchAmount * 10 ** 8) < AMOUNT_COMPARE_ERROR_MARGIN
      return hasMatchingAmount
    })
    return filteredTxs
  }

  return txs
}

export const aes = {
  generateKey() {
    return {
      password: crypto.randomBytes(16).toString('hex'),
      iv: crypto.randomBytes(8).toString('hex'),
    }
  },
  encrypt(data, password, iv) {
    const CHUNK_SIZE = 15
    const bytes = Buffer.from(data)
    let encrypted = ''
    for (var i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.toString('hex', i, i+CHUNK_SIZE)
      const cipheriv = crypto.createCipheriv('aes-256-cbc', password, iv)
      cipheriv.update(chunk, 'hex', 'hex')
      encrypted += cipheriv.final('hex')
    }
    return encrypted
  },

  decrypt(encryptedData='', password, iv) {
    const CHUNK_SIZE = 32
    let decryptedData = ''
    for(var i = 0; i < encryptedData.length; i += CHUNK_SIZE) {
      const chunk = encryptedData.substring(i, i + CHUNK_SIZE)
      const decipheriv = crypto.createDecipheriv('aes-256-cbc', password, iv)
      decipheriv.update(chunk, 'hex', 'utf8')
      decryptedData += decipheriv.final('utf8')
    }
    return decryptedData
  }
}

/**
 * 
 * @param {String} xpubkey 
 * @param {String|Number} path
 */
export function getPubkeyAt(xpubkey, path) {
  const mainNode = bchjs.HDNode.fromXPub(xpubkey)
  const childNode = mainNode.derivePath(String(path))
  return bchjs.HDNode.toPublicKey(childNode).toString('hex')
}


export async function asyncSleep(interval) {
  return new Promise((resolve, reject) => {
    try {
      setTimeout(() => resolve(), interval)
    } catch (error) {
      reject(error)
    }
  })
}


/**
 * @param {String} url
 * @param {Object} reconnectOpts 
 * @param {Number} reconnectOpts.maxAttempts 
 * @param {Number} reconnectOpts.baseInterval
 * @param {Number} [reconnectOpts.exponentialBackoff]
 */
export async function connectWebsocket(url='', reconnectOpts={maxAttempts:5, baseInterval: 5000, exponentialBackoff: 1 }) {
  const maxAttempts = parseInt(reconnectOpts?.maxAttempts)
  const baseInterval = parseInt(reconnectOpts?.baseInterval)
  const exponentialBackoff = parseFloat(reconnectOpts?.exponentialBackoff) || 1

  if (isNaN(maxAttempts)) return Promise.reject('Invalid max attempts value')
  if (isNaN(baseInterval)) return Promise.reject('Invalid base interval value')
  if (isNaN(exponentialBackoff)) return Promise.reject('Invalid backoff value')

  let lastError = null
  for (var i = 0; i < maxAttempts; i++) {
    try {
      const resp = await initWebsocket(url)
      return Promise.resolve(resp.target)
    } catch(error) {
      lastError = error
      const interval = baseInterval * exponentialBackoff ** i
      console.log(i+1, 'of', maxAttempts, 'attempts. Reconnecting in', interval/1000, 'seconds')
      await asyncSleep(interval)
    }
  }

  if (lastError) console.error(lastError)
  return Promise.reject('Max connections reached')
}

export async function initWebsocket(...websocketArgs) {
  return new Promise((resolve, reject) => {
    const websocket = new WebSocket(...websocketArgs)
    websocket.onopen = (...args) => {
      websocket.onopen = null
      websocket.onerror = null
      resolve(...args)
    }

    websocket.onerror = (...args) => {
      websocket.onopen = null
      websocket.onerror = null
      reject(...args)
    }
  })
}

/**
 * Class for listening to transactions of cashaddress through websocket.
 * - Works on mainnet & chipnet only
 * - Reconnects on address change. Only reconnects when there is existing connection
 */
export class TransactionListener {
  /**
   * @param {String} address
   * @param {Object} opts
   * @param {Boolean} opts.reconnect
   */
  constructor(address, opts) {
    this.address = address
    this.reconnection = {
      enable: Boolean(opts?.reconnect),
      reconnectAttempts: parseInt(opts?.reconnectAttempts) || 5,
    }

    this.websocket = [].map(() => new WebSocket())[0]

    this.listeners = []
    
    this._connectCtr = 0
    this._lastConnectId = null
  }

  get readyState() {
    return this?.websocket?.readyState
  }

  get address() {
    return this._address
  }

  set address(value) {
    const changed = value != this._address
    this._address = value
    if (changed && this.readyState == 1) {
      this.disconnect()
      this.connect()
    }
  }

  get url() {
    const host = this.address?.startsWith?.('bchtest:')
      ? 'chipnet.watchtower.cash' : 'watchtower.cash'

    return `wss://${host}/ws/watch/bch/${this.address}/`
  }

  disconnect() {
    if (this.websocket?.onclose) this.websocket.onclose = null
    this.websocket?.close?.()
    this.websocket = null
  }

  async connect() {    
    if (!this.address) return Promise.reject('Invalid address')

    // must close websocket before initializing, due to how
    // watchtower subscribes addresses to websocket channels
    this.websocket?.close?.()
    this.websocket = null

    if (isNaN(this._connectCtr)) this._connectCtr = 0
    const connectId = ++this._connectCtr
    this._lastConnectId = connectId

    const reconnectAttempts = this.reconnection?.enable ? this.reconnection.reconnectAttempts : 1
    const response = await connectWebsocket(this.url, {
      maxAttempts: reconnectAttempts || 5,
      baseInterval: 2000,
      exponentialBackoff: 1,
    })

    // Used for disconnecting connection attempts run at the same time;
    // except for the last connect attempt
    if (connectId != this._lastConnectId) {
      response?.close?.()
      return response
    }

    this.websocket = response
    this.websocket.onmessage = (...args) => this.emit(...args)
    this.websocket.onclose = (...args) => {
      if (!this.reconnection.enable) return console.error(...args)
      console.log('Websocket closed. Reconnecting')
      return this.connect()
    }
    return this.websocket
  }

  emit(...args) {
    try {
      const data = JSON.parse(args?.[0]?.data)
      const parsedData = this.parseWebsocketDataReceived(data)
      args.push(parsedData)
    } catch (error) { console.error(error) }
    this.listeners.forEach(listener => {
      listener?.(...args)
    })
  }

  /**
   * @param {Function} callback 
   */
  addListener(callback) {
    if (typeof callback != 'function') return

    if (!this.listeners.includes(callback)) this.listeners.push(callback)
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(_callback => _callback !== callback)
  }

  /**
   * @param {Object} data 
   * @param {String} data.token_name
   * @param {String} data.token_id
   * @param {String} data.token_symbol
   * @param {Number} data.amount
   * @param {Number} data.value
   * @param {String} data.address
   * @param {String} data.source
   * @param {String} data.txid
   * @param {Number} data.index
   * @param {String} data.address_path
   * @param {String[]} data.senders
   */
  parseWebsocketDataReceived(data) {
    const response = {
      amount: data?.amount,
      value: data?.value,
      txid: data?.txid,
      index: data?.index,
      address: data?.address,
      tokenName: data?.token_name,
      tokenId: data?.token_id,
      tokenSymbol: data?.token_symbol,
      addressPath: data?.address_path,
      senders: Array.isArray(data?.senders) ? data?.senders : [data?.senders],
      source: data?.source,
      logo: null,
    }

    if (!response?.amount && response?.value) response.amount = Math.round(response?.value) / 10 ** 8

    if (typeof response.tokenSymbol === 'string') response.tokenSymbol = response.tokenSymbol.toUpperCase()
    if (response.tokenSymbol === 'BCH') response.logo = 'bch-logo.png'
    return response
  }
}
