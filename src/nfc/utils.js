import {
  binToHex,
  hexToBin,
  decodePrivateKeyWif,
  hash256,
  instantiateSecp256k1,
  secp256k1
} from "@bitauth/libauth"

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
 * Note: This should run on the merchant frontend; it signs input preimages
 * for the spend transaction.
  * @param {Object} params
  * @param {Array} params.preimages - Array of objects containing inputIndex and preimage hex strings.
  * @param {string} params.wif - WIF encoded private key.
 * @returns {Array} - Array of objects containing inputIndex, merchantSigHex, and merchantPkHex.  
 */
export async function signPreimages({ preimages, wif }) {
  const decoded = decodePrivateKeyWif(wif);
  if (typeof decoded === 'string') throw new Error(decoded);

  const secp = await instantiateSecp256k1();
  const merchantPkBin = secp.derivePublicKeyCompressed(decoded.privateKey);
  const merchantPkHex = binToHex(merchantPkBin);

  return preimages.map(({ inputIndex, preimage }) => {
    const preimageBin = hexToBin(preimage);
    const messageHash = hash256(preimageBin);

    const sig64 = secp.signMessageHashSchnorr(decoded.privateKey, messageHash);
    const sigWithHashType = new Uint8Array([...sig64, HASHTYPE]); // 65 bytes

    return {
      inputIndex,
      merchantSigHex: binToHex(sigWithHashType),
      merchantPkHex
    };
  });
}