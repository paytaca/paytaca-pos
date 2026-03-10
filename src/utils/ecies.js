import crypto from 'crypto'
import * as secp from '@noble/secp256k1'

/**
 * Decrypt data with a private key (counterpart to encryptWithPublicKey)
 * 
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} encryptKey - 66-char hex ephemeral public key from encryption
 * @param {string} privateKey - 64-char hex private key
 * @param {{ parseJson?: boolean }} [opts]
 * @returns {string | any} Decrypted data as string by default; parsed JSON when parseJson=true
 */
export function decryptWithPrivateKey(encryptedData, encryptKey, privateKey, opts = {}) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Encrypted data must be a non-empty base64 string')
  }
  
  if (!encryptKey || typeof encryptKey !== 'string' || encryptKey.length !== 66) {
    throw new Error('Encrypt key must be a 66-char hex string')
  }
  
  if (!privateKey || typeof privateKey !== 'string' || !/^[0-9a-f]{64}$/i.test(privateKey)) {
    throw new Error('Private key must be a 64-char hex string')
  }

  const privBytes = secp.etc.hexToBytes(privateKey)
  const ephemeralPubBytes = secp.etc.hexToBytes(encryptKey)
  const sharedPoint = secp.getSharedSecret(privBytes, ephemeralPubBytes)
  const sharedSecret = sharedPoint.slice(1, 33)
  
  const ivSource = crypto.createHash('sha256')
    .update(ephemeralPubBytes)
    .digest()
  const iv = ivSource.slice(0, 16)
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(sharedSecret), iv)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, 'base64')),
    decipher.final()
  ])

  const output = decrypted.toString('utf8')
  if (!opts?.parseJson) return output

  try {
    return JSON.parse(output)
  } catch {
    throw new Error('Decrypted payload is not valid JSON')
  }
}