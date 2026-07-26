import {
  binToHex,
  hexToBin,
  ripemd160,
  decodePrivateKeyWif,
  hash256,
  instantiateSecp256k1,
  secp256k1,
  decodeCashAddress,
  encodeCashAddress,
  CashAddressNetworkPrefix,
  CashAddressType,
  sha256 as sha256Libauth,
  utf8ToBin
} from "@bitauth/libauth"

const HASHTYPE = 0x41; // SIGHASH_ALL | SIGHASH_FORKID

function concatUint8Arrays(arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * Derive public key from private key WIF
 * 
 * @param {string} privateKeyWif - WIF-encoded private key
 * @returns {string} 66-char hex compressed public key
 */
export function getPublicKeyFromPrivate(privateKeyWif) {
  const privateKey = decodePrivateKeyWif(privateKeyWif)
  if (typeof privateKey === 'string') throw new Error(privateKey)
  const compressed = secp256k1.derivePublicKeyCompressed(privateKey.privateKey)
  if (typeof compressed === 'string') throw new Error(compressed)
  return binToHex(compressed)
}

/**
 * Sign preimages using the provided WIF private key.
  * @param {Object} params
  * @param {Array} params.preimages - Array of objects containing inputIndex and preimage hex strings.
  * @param {string} params.wif - WIF encoded private key.
  * @returns {Promise<Array<{ inputIndex: number, merchantSigHex: string, merchantPkHex: string }>>} - Array of objects containing inputIndex, merchantSigHex, and merchantPkHex.
  */
export async function signPreimages({ preimages, wif }) {
  // time the signing process
  const startTime = performance.now();
  const decoded = decodePrivateKeyWif(wif);
  if (typeof decoded === 'string') throw new Error(decoded);

  const secp = await instantiateSecp256k1();
  const merchantPkBin = secp.derivePublicKeyCompressed(decoded.privateKey);
  if (typeof merchantPkBin === 'string') throw new Error(merchantPkBin);
  const merchantPkHex = binToHex(merchantPkBin);
  const signedPreimages = preimages.map(({ inputIndex, preimage }) => {
    const preimageBin = hexToBin(preimage);
    const messageHash = hash256(preimageBin);

    const sig64 = secp.signMessageHashSchnorr(decoded.privateKey, messageHash);
    if (typeof sig64 === 'string') throw new Error(sig64);
    const sigWithHashType = new Uint8Array([...sig64, HASHTYPE]); // 65 bytes

    return {
      inputIndex,
      merchantSigHex: binToHex(sigWithHashType),
      merchantPkHex
    };
  })
  const endTime = performance.now();
  console.log(`Signing ${preimages.length} preimages took ${(endTime - startTime) / 1000} seconds`);
  return signedPreimages;
}

export function toTokenAddress (address, isContract = true) {
  const decodedAddress = decodeCashAddress(address)
  const prefix = CashAddressNetworkPrefix.mainnet
  const addressType = isContract ? CashAddressType.p2shWithTokens : CashAddressType.p2pkhWithTokens
  const tokenAddress = encodeCashAddress(prefix, addressType, decodedAddress.payload)
  return tokenAddress
}

export function reverseHex(hex = '') {
    if (!hex) return hex;
    const pairs = hex.match(/.{1,2}/g);
    return pairs ? pairs.reverse().join('') : hex;
}

export function encodeCommitment({ authorized, merchant, spendLimitSats }) {
    if (!spendLimitSats) throw new Error ('missing required spend limit')

    // authorized
    const authorizedBuf = new Uint8Array([authorized ? 0x01 : 0x00]); // 1 byte

    // spend limit
    const spendLimitBuf = new Uint8Array(8);
    const spendLimitView = new DataView(spendLimitBuf.buffer, spendLimitBuf.byteOffset, spendLimitBuf.byteLength);
    spendLimitView.setBigInt64(0, BigInt(spendLimitSats), true); // 8 bytes

    let commitmentData = [authorizedBuf, spendLimitBuf]

    // merchant hash
    if (merchant) {
        const { buf: truncatedHashBuf } = encodeMerchantHash({ merchantId: merchant.id, merchantPk: merchant.pubkey }); // 31 bytes
        commitmentData.push(truncatedHashBuf);
    }

    // commitment (40 bytes): authorized (1 byte) + spendLimit (8 bytes) + merchantHash (31 bytes)
    const commitment = concatUint8Arrays(commitmentData);

    return binToHex(commitment);
}

export function decodeCommitment(hex) {
    const buf = hexToBin(hex);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return {
        authorized: buf[0] === 1,
        spendLimitSats: view.getBigUint64(1, true),
        hash: buf.length > 9 ? binToHex(buf.subarray(9, buf.length)) : undefined
    };
}

export function encodeMerchantHash({ merchantId, merchantPk }) {
    if (!merchantId || !merchantPk) {
        throw new Error('missing required merchantId or merchantPk')
    }
    
    const merchantIdBuf = utf8ToBin(merchantId.toString())
    const merchantPkBuf = hexToBin(merchantPk)
    const concatLength = merchantIdBuf.length + merchantPkBuf.length
    const concat = new Uint8Array(concatLength)
    concat.set(merchantIdBuf, 0)
    concat.set(merchantPkBuf, merchantIdBuf.length)

    const fullHash = sha256Libauth.hash(concat) // Uint8Array(32)
    const truncatedHashBuf = fullHash.subarray(0, 31) // 31 bytes
    const truncatedHashHex = binToHex(truncatedHashBuf)
    return { buf: truncatedHashBuf, hex: truncatedHashHex };
}

/**
 * Decodes an NFT commitment hex into its fields.
 * @param {string} hex
 * @returns {{ type: string, value: string }|null}
 */
export function decodeOwnershipCommitment(hex) {
    if (hex.length === 0) return null;
    const buf = hexToBin(hex);
    return {
      type: buf[0] === 1 ? 'cat' : 'pkh',
      value: reverseHex(binToHex(buf.subarray(1, buf.length)))
    };
}

export function sha256(data='', encoding='utf8') {
  let bin
  if (encoding === 'hex') {
    bin = hexToBin(data)
  } else {
    bin = utf8ToBin(data)
  }
  return binToHex(sha256Libauth.hash(bin))
}

export function pubkeyToPkHash(pubkey='') {
  return binToHex(ripemd160.hash(hexToBin(sha256(pubkey, 'hex'))))
}

export function sortUtxos(utxos = []) {
    return [...utxos].sort((a, b) => {
        if (a.txid === b.txid) return a.vout - b.vout
        return a.txid.localeCompare(b.txid)
    })
}
