import * as secp from '@noble/secp256k1'

function normalizeBase64(input = '') {
  if (typeof input !== 'string') return ''
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  if (!padding) return normalized
  return normalized + '='.repeat(4 - padding)
}

function decodeBase64ToBytes(input = '') {
  const normalized = normalizeBase64(input)
  const binaryString = atob(normalized)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

function parseEncryptedPayload(payload = '') {
  if (typeof payload !== 'string' || !payload) {
    return { ciphertextB64: '' }
  }

  const trimmed = payload.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { ciphertextB64: trimmed }
  }

  try {
    const parsed = JSON.parse(trimmed)
    return {
      ciphertextB64: parsed?.ciphertext || parsed?.encryptedData || parsed?.data || '',
      ivB64: parsed?.iv || parsed?.nonce || '',
      tagB64: parsed?.tag || parsed?.authTag || '',
    }
  } catch {
    return { ciphertextB64: trimmed }
  }
}

export async function decryptWithPrivateKey(encryptedData, encryptKey, privateKey, opts = {}) {
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

  const payload = parseEncryptedPayload(encryptedData)
  if (!payload.ciphertextB64) {
    throw new Error('Encrypted payload is missing ciphertext')
  }

  const ivSource = new Uint8Array(await crypto.subtle.digest('SHA-256', ephemeralPubBytes))
  const gcmFallbackIv = ivSource.slice(0, 12)
  const cbcFallbackIv = ivSource.slice(0, 16)

  const ciphertext = decodeBase64ToBytes(payload.ciphertextB64)
  let gcmCiphertext = ciphertext
  if (payload.tagB64) {
    const tagBytes = decodeBase64ToBytes(payload.tagB64)
    gcmCiphertext = new Uint8Array(ciphertext.length + tagBytes.length)
    gcmCiphertext.set(ciphertext)
    gcmCiphertext.set(tagBytes, ciphertext.length)
  }

  let gcmIv = gcmFallbackIv
  if (payload.ivB64) {
    const candidateIv = decodeBase64ToBytes(payload.ivB64)
    if (candidateIv.length >= 12) {
      gcmIv = candidateIv.slice(0, 12)
    }
  }

  const gcmKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  let decrypted
  // Try new format first: iv (12) + authTag (16) + ciphertext, all base64
  if (!payload.ivB64 && !payload.tagB64 && ciphertext.length >= 28) {
    const newFormatIv = ciphertext.slice(0, 12)
    const newFormatTag = ciphertext.slice(12, 28)
    const newFormatCiphertext = ciphertext.slice(28)
    const newFormatGcmData = new Uint8Array(newFormatCiphertext.length + 16)
    newFormatGcmData.set(newFormatCiphertext)
    newFormatGcmData.set(newFormatTag, newFormatCiphertext.length)

    try {
      decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: newFormatIv },
        gcmKey,
        newFormatGcmData
      )
    } catch {
      // Continue to fallback
    }
  }

  if (!decrypted) {
    try {
      decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: gcmIv },
        gcmKey,
        gcmCiphertext
      )
    } catch {
      // Backward compatibility for payloads encrypted with AES-CBC.
      let cbcIv = cbcFallbackIv
      if (payload.ivB64) {
        const candidateIv = decodeBase64ToBytes(payload.ivB64)
        if (candidateIv.length >= 16) {
          cbcIv = candidateIv.slice(0, 16)
        }
      }

      const cbcKey = await crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      )

      try {
        decrypted = await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: cbcIv },
          cbcKey,
          ciphertext
        )
      } catch {
        throw new Error('Unable to decrypt payload. Link code may be expired or generated for a different encryption key.')
      }
    }
  }

  const output = new TextDecoder().decode(decrypted)
  if (!opts?.parseJson) return output

  try {
    return JSON.parse(output)
  } catch {
    throw new Error('Decrypted payload is not valid JSON')
  }
}