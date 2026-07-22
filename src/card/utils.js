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
  CashAddressType
} from "@bitauth/libauth"
import { createHash } from 'crypto';

const HASHTYPE = 0x41; // SIGHASH_ALL | SIGHASH_FORKID

/**
 * Derive public key from private key WIF
 * 
 * @param {string} privateKeyWif - WIF-encoded private key
 * @returns {string} 66-char hex compressed public key
 */
export function getPublicKeyFromPrivate(privateKeyWif) {
  const privateKey = decodePrivateKeyWif(privateKeyWif)
  const compressed = secp256k1.derivePublicKeyCompressed(privateKey.privateKey)
  if (typeof compressed !== 'string') return binToHex(compressed)
  const uncompressed = secp256k1.derivePublicKeyUncompressed(privateKey.privateKey)
  if (typeof uncompressed !== 'string') return binToHex(uncompressed)
  return uncompressed
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
  const merchantPkHex = binToHex(merchantPkBin);
  const signedPreimages = preimages.map(({ inputIndex, preimage }) => {
    const preimageBin = hexToBin(preimage);
    const messageHash = hash256(preimageBin);

    const sig64 = secp.signMessageHashSchnorr(decoded.privateKey, messageHash);
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
    const authorizedBuf = Buffer.from([authorized ? 0x01 : 0x00]); // 1 byte

    // spend limit
    const spendLimitBuf = Buffer.alloc(8);
    spendLimitBuf.writeBigInt64LE(BigInt(spendLimitSats)); // 8 bytes

    let commitmentData = [authorizedBuf, spendLimitBuf]

    // merchant hash
    if (merchant) {
        const { buf: truncatedHashBuf } = encodeMerchantHash({ merchantId: merchant.id, merchantPk: merchant.pubkey }); // 31 bytes
        commitmentData.push(truncatedHashBuf);
    }

    // commitment (40 bytes): authorized (1 byte) + spendLimit (8 bytes) + merchantHash (31 bytes)
    const commitment = Buffer.concat(commitmentData);

    return commitment.toString('hex'); 
}

export function decodeCommitment(hex) {
    const buf = Buffer.from(hex, 'hex');
    return {
        authorized: buf[0] === 1,
        spendLimitSats: buf.readBigUInt64LE(1),
        hash: buf.length > 9 ? buf.subarray(9, buf.length).toString('hex') : undefined    };
}

export function encodeMerchantHash({ merchantId, merchantPk }) {
    if (!merchantId || !merchantPk) {
        throw new Error('missing required merchantId or merchantPk')
    }
    
    const merchantIdBuf = Buffer.from(merchantId.toString(), 'utf-8')
    const merchantPkBuf = Buffer.from(merchantPk, 'hex')
    const concat = Buffer.concat([merchantIdBuf, merchantPkBuf])

    const fullHash = createHash('sha256').update(concat).digest(); // Buffer(32)
    const truncatedHashBuf = fullHash.subarray(0, 31) // 31 bytes
    const truncatedHashHex = truncatedHashBuf.toString('hex')
    return { buf: truncatedHashBuf, hex: truncatedHashHex };
}

/**
 * Decodes an NFT commitment hex into its fields.
 * @param {string} hex
 * @returns {{ type: string, value: string }|null}
 */
export function decodeOwnershipCommitment(hex) {
    if (hex.length === 0) return null;
    const buf = Buffer.from(hex, 'hex');
    return {
      type: buf[0] === 1 ? 'cat' : 'pkh',
      value: reverseHex(buf.subarray(1, buf.length).toString('hex'))
    };
}

export function sha256(data='', encoding='utf8') {
  const _sha256 = createHash('sha256')
  _sha256.update(Buffer.from(data, encoding))
  return _sha256.digest().toString('hex')
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
