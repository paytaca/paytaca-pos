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

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder("utf-8");
  const algorithm = { name: "HMAC", hash: "SHA-256" };
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    algorithm,
    false, ["sign", "verify"]
  );
  const hashBuffer = await crypto.subtle.sign(
    algorithm.name, 
    key, 
    enc.encode(message)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(
      b => b.toString(16).padStart(2, '0')
  ).join('');
  return hashHex;
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
      console.log(walletHash, xPubKey, posId)
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
