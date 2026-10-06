/**
 * Minimal CBOR (RFC 8949) encoder/decoder used for the optional compact-binary
 * card socket payloads.
 *
 * This is intentionally small and dependency-free. It supports the data shapes
 * exchanged with the card backend (integers, floats, strings, byte strings,
 * booleans, null, arrays and maps). Tags are read through (their inner value is
 * returned) and unknown simple values are returned verbatim.
 */

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/**
 * Encodes an arbitrary JS value into a CBOR byte string.
 * @param {*} value - The value to encode.
 * @returns {Uint8Array} The CBOR-encoded bytes.
 */
export function cborEncode(value) {
  const out = []
  encodeValue(value, out)
  return Uint8Array.from(out)
}

/**
 * Decodes a CBOR byte string into a JS value.
 * @param {ArrayBuffer|Uint8Array} data - The CBOR-encoded bytes.
 * @returns {*} The decoded value.
 */
export function cborDecode(data) {
  const decoder = new CborDecoder(data instanceof Uint8Array ? data : new Uint8Array(data))
  return decoder.decodeValue()
}

/**
 * Converts a hex string into bytes.
 * @param {string} hex - Hex string (may contain colons, e.g. "AA:BB").
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
  const clean = String(hex).replace(/[^0-9a-fA-F]/g, '')
  if (clean.length % 2 !== 0) throw new Error('Invalid hex string length')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Converts bytes into a lowercase hex string.
 * @param {ArrayBuffer|Uint8Array|number[]} bytes
 * @returns {string}
 */
export function bytesToHex(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let hex = ''
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Recursively converts Uint8Array values into hex strings. Used to normalize
 * CBOR-decoded responses so the rest of the app only ever sees hex strings.
 * @param {*} value
 * @returns {*}
 */
export function normalizeBytesToHex(value) {
  if (value instanceof Uint8Array) return bytesToHex(value)
  if (Array.isArray(value)) return value.map(normalizeBytesToHex)
  if (value && typeof value === 'object') {
    const normalized = {}
    for (const key of Object.keys(value)) {
      normalized[key] = normalizeBytesToHex(value[key])
    }
    return normalized
  }
  return value
}

function encodeValue(value, out) {
  if (value === undefined) {
    out.push(0xf7)
  } else if (value === null) {
    out.push(0xf6)
  } else if (value === true) {
    out.push(0xf5)
  } else if (value === false) {
    out.push(0xf4)
  } else if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0) {
      encodeHead(0, value, out)
    } else if (Number.isInteger(value) && value < 0) {
      encodeHead(1, -1 - value, out)
    } else {
      encodeFloat64(value, out)
    }
  } else if (typeof value === 'bigint') {
    if (value >= 0n) encodeHead(0, value, out)
    else encodeHead(1, -1n - value, out)
  } else if (typeof value === 'string') {
    const bytes = textEncoder.encode(value)
    encodeHead(3, bytes.length, out)
    for (let i = 0; i < bytes.length; i++) out.push(bytes[i])
  } else if (value instanceof Uint8Array) {
    encodeHead(2, value.length, out)
    for (let i = 0; i < value.length; i++) out.push(value[i])
  } else if (Array.isArray(value)) {
    encodeHead(4, value.length, out)
    for (const item of value) encodeValue(item, out)
  } else if (typeof value === 'object') {
    const keys = Object.keys(value)
    encodeHead(5, keys.length, out)
    for (const key of keys) {
      encodeValue(key, out)
      encodeValue(value[key], out)
    }
  } else {
    throw new Error(`Unsupported CBOR value type: ${typeof value}`)
  }
}

function encodeHead(major, addInfo, out) {
  // Coerce BigInt values to Number when safe; otherwise encode directly as
  // 8-byte to avoid mixing BigInt with Number in comparisons / bitwise ops.
  if (typeof addInfo === 'bigint') {
    if (addInfo <= Number.MAX_SAFE_INTEGER) {
      addInfo = Number(addInfo)
    } else {
      out.push((major << 5) | 27)
      for (let i = 7; i >= 0; i--) {
        out.push(Number((addInfo >> BigInt(i * 8)) & 0xffn))
      }
      return
    }
  }
  if (addInfo < 24) {
    out.push((major << 5) | addInfo)
  } else if (addInfo < 0x100) {
    out.push((major << 5) | 24, addInfo)
  } else if (addInfo < 0x10000) {
    out.push((major << 5) | 25, (addInfo >> 8) & 0xff, addInfo & 0xff)
  } else if (addInfo < 0x100000000) {
    out.push((major << 5) | 26)
    out.push(
      (addInfo >>> 24) & 0xff,
      (addInfo >>> 16) & 0xff,
      (addInfo >>> 8) & 0xff,
      addInfo & 0xff
    )
  } else {
    const wide = BigInt(addInfo)
    out.push((major << 5) | 27)
    for (let i = 7; i >= 0; i--) {
      out.push(Number((wide >> BigInt(i * 8)) & 0xffn))
    }
  }
}

function encodeFloat64(value, out) {
  const buffer = new ArrayBuffer(8)
  new DataView(buffer).setFloat64(0, value)
  out.push(0xfb)
  for (let i = 0; i < 8; i++) out.push(new Uint8Array(buffer)[i])
}

class CborDecoder {
  constructor(data) {
    this.data = data
    this.pos = 0
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  readHead() {
    const b = this.data[this.pos++]
    const major = b >> 5
    const info = b & 0x1f
    let value = info
    if (info === 24) {
      value = this.data[this.pos++]
    } else if (info === 25) {
      if (major === 7) {
        value = decodeFloat16(this.view.getUint16(this.pos, false))
      } else {
        value = this.view.getUint16(this.pos, false)
      }
      this.pos += 2
    } else if (info === 26) {
      if (major === 7) {
        value = this.view.getFloat32(this.pos, false)
      } else {
        value = this.view.getUint32(this.pos, false)
      }
      this.pos += 4
    } else if (info === 27) {
      if (major === 7) {
        value = this.view.getFloat64(this.pos, false)
      } else {
        value = this.readU64()
      }
      this.pos += 8
    }
    return { major, info, value }
  }

  readU64() {
    const hi = this.view.getUint32(this.pos, false)
    const lo = this.view.getUint32(this.pos + 4, false)
    if (hi === 0) return lo
    return (BigInt(hi) << 32n) | BigInt(lo)
  }

  decodeValue() {
    const { major, info, value } = this.readHead()
    switch (major) {
      case 0:
        return typeof value === 'bigint' ? Number(value) : value
      case 1:
        return typeof value === 'bigint' ? -1n - value : -1 - value
      case 2: {
        const bytes = this.data.slice(this.pos, this.pos + value)
        this.pos += value
        return bytes
      }
      case 3: {
        const text = textDecoder.decode(this.data.subarray(this.pos, this.pos + value))
        this.pos += value
        return text
      }
      case 4: {
        const array = []
        for (let i = 0; i < value; i++) array.push(this.decodeValue())
        return array
      }
      case 5: {
        const object = {}
        for (let i = 0; i < value; i++) {
          const key = this.decodeValue()
          object[String(key)] = this.decodeValue()
        }
        return object
      }
      case 6:
        return this.decodeValue()
      case 7:
        if (info === 20) return false
        if (info === 21) return true
        if (info === 22) return null
        if (info === 23) return undefined
        return value
      default:
        throw new Error(`Unsupported CBOR major type: ${major}`)
    }
  }
}

function decodeFloat16(half) {
  const sign = half & 0x8000 ? -1 : 1
  const exponent = (half >> 10) & 0x1f
  const mantissa = half & 0x3ff
  if (exponent === 0) return sign * 2 ** -14 * (mantissa / 1024)
  if (exponent === 31) return mantissa === 0 ? sign * Infinity : NaN
  return sign * 2 ** (exponent - 15) * (1 + mantissa / 1024)
}
