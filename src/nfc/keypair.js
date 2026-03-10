
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { decodePrivateKeyWif, binToHex, secp256k1, utf8ToBin, sha256, hexToBin } from '@bitauth/libauth'
import crypto from 'crypto'
import * as secp from '@noble/secp256k1'

// -------------------- Signer Class -------------------

export class Signer {

  constructor (wif) {
    this.wif = wif
  }

  static fromWIF (wif) {
    return new Signer(wif)
  }

  /**
   * Get the key pair.
   * @returns {Object} The key pair.
   */
  keypair () {
    const privateKeyWif = this.privkey()
    const publicKey = this.pubkey()
    return {
      privateKey: privateKeyWif,
      publicKey: publicKey
    }
  }

  /**
   * Get the public key.
   * @returns {string} The public key.
   */
  pubkey () {
    // Decode the WIF to get the private key bytes
    const decoded = decodePrivateKeyWif(this.wif)
    if (typeof decoded === 'string') {
      throw new Error('Invalid WIF: ' + decoded)
    }
    
    const privateKeyBin = decoded.privateKey
    
    // Derive the public key from the private key
    const publicKeyBin = secp256k1.derivePublicKeyCompressed(privateKeyBin)
    if (typeof publicKeyBin === 'string') {
      throw new Error('Public key derivation failed: ' + publicKeyBin)
    }
    
    // Convert to hex string
    const publicKeyHex = binToHex(publicKeyBin)
    return publicKeyHex
  }

  /**
   * Get the private key in WIF format.
   * @returns {string} The private key in WIF format.
   */
  privkey () {
    return this.wif
  }

  /**
   * Sign a message.
   * @param {string} message - The message to sign.
   * @param {string} [wif=null] - The private key in WIF format.
   * @param {number} [timestamp=null] - The timestamp.
   * @returns {string} The signature.
   */
  signMessage (message, timestamp = null) {
    const wif = this.privkey()
    message = timestamp ? [message, timestamp].join('::') : message
    const messageHash = sha256.hash(utf8ToBin(message))
    const privateKeyBin = decodePrivateKeyWif(wif).privateKey
    if (typeof privateKeyBin === 'string') throw (new Error("Invalid WIF: " + wif))
    const signatureBin = secp256k1.signMessageHashDER(privateKeyBin, messageHash)
    if (typeof signatureBin === 'string') throw new Error(signatureBin)
    const signature = binToHex(signatureBin)
    return signature
  }

  /**
   * Verify a signed message.
   * @param {string} message - The message to verify.
   * @param {string} signature - The signature.
   * @param {number} [timestamp=null] - The timestamp.
   * @returns {boolean} Whether the signature is valid.
   */
  verifyMessage (message, signature, timestamp = null) {
    const publicKey = this.pubkey()
    message = timestamp ? [message, timestamp].join('::') : message
    const messageHash = sha256.hash(utf8ToBin(message))
    const publicKeyBin = hexToBin(publicKey)
    const signatureBin = hexToBin(signature)
    const isValid = secp256k1.verifySignatureDERLowS(signatureBin, publicKeyBin, messageHash)
    if (typeof isValid === 'string') throw new Error(isValid)
    return isValid
  }

}

export function loadSignerFromWIF (wif) {
  return Signer.fromWIF(wif)
}

// ------------------- Encryption Keypair Generation -------------------
// Randomly generated keypair for encrypting the authorization signer privateKey during
// Wallet linking. Not derived from wallet and not used for signing transactions.

const ENCRYPTION_KEYPAIR_STORAGE_KEY = 'wallet_encryption_keypair'

export async function getEncryptionKeypair () {
  try {
    const keypair = await getEncryptionKeypairFromStorage()
    return keypair
  } catch (error) {
    console.log('No encryption keypair found:', error)
  }
}

export async function getOrGenerateEncryptionKeypair () {
  console.log('Retrieving encryption keypair from secure storage...')
  try {
    const keypair = await getEncryptionKeypairFromStorage()
    return keypair
  } catch (error) {
    console.log('No encryption keypair found, generating new one...')
    const newKeypair = generateEncryptionKeypair()
    await saveEncryptionKeypairToStorage(newKeypair)
    console.log('New encryption keypair generated and stored.')
    return newKeypair
  }
}

/**
 * Generate a random secp256k1 encryption keypair.
 *
 * @param {Object} [opts]
 * @param {string} [opts.seed=''] Optional seed for deterministic generation.
 * @returns {{ privkey: string, pubkey: string }} 32-byte privkey and 33-byte compressed pubkey as hex.
 */
function generateEncryptionKeypair (opts = {}) {
  const seed = opts?.seed

  let privBytes
  if (seed && typeof seed === 'string') {
    privBytes = sha256.hash(utf8ToBin(seed))
  } else {
    privBytes = crypto.randomFillSync(new Uint8Array(32))
  }

  const pubBytes = secp.getPublicKey(privBytes, true)

  return {
    privkey: binToHex(privBytes),
    pubkey: secp.etc.bytesToHex(pubBytes)
  }
}

async function getEncryptionKeypairFromStorage () {
    return SecureStoragePlugin.get({ key: ENCRYPTION_KEYPAIR_STORAGE_KEY })
        .then(result => {
            if (result.value) {
              return JSON.parse(result.value)
            } else {
              throw new Error('No encryption keypair found in storage')
            }
        })
        .catch(error => {
            console.error('Failed to retrieve encryption keypair from storage:', error)
            throw error
        })
}

async function saveEncryptionKeypairToStorage (keypair) {
    return SecureStoragePlugin.set({
        key: ENCRYPTION_KEYPAIR_STORAGE_KEY,
        value: JSON.stringify(keypair)
    })
    .then(() => {
        console.log('Encryption keypair saved to storage')
    })
    .catch(error => {
        console.error('Failed to save encryption keypair to storage:', error)
    })
}