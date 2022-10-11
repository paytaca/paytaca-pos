import BCHJS from "@psf/bch-js"
import { createHmac, createHash } from "crypto"

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
export async function generateTOTP(secret, opts) {
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

  const hexDigest = await hmacSha256Hex(secret, timecode.toString())
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
