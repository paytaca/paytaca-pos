import BCHJS from "@psf/bch-js"
import { createHmac, createHash } from "crypto"
import axios from 'axios'
import * as crypto from 'crypto'
import { parsePaytacaPaymentUri } from "./payment-uri"

const bchjs = new BCHJS()

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
