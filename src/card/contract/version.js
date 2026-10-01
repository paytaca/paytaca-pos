import { hexToBin, binToHex } from '@bitauth/libauth'
import { reverseHex } from '../utils.js'

/**
 * Card contract version resolution primitives.
 *
 * This module is intentionally free of network access and of the CashScript
 * contract artifact so it can be unit tested in isolation. It owns:
 *   - the NDEF TEXT record parser ("backend_pk:category[:version]")
 *   - the single Base36 version character codec
 *   - the on-chain version pointer (0x02 commitment) decoder
 *   - the server version hint normalizer
 *
 * Anything that cannot be parsed or decoded throws (fail closed). Callers must
 * never fall back to a default when a value is malformed.
 */

// Versions represented by a single Base36 character: '1'-'9' => 1-9,
// 'A'-'Z' => 10-35. '0' and lowercase letters are NOT valid.
const BASE36_VERSION_CHARS = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const MIN_CONTRACT_VERSION = 1
export const MAX_CONTRACT_VERSION = BASE36_VERSION_CHARS.length // 35
export const DEFAULT_ORIGIN_VERSION = 1

// Commitments are prefixed with a one-byte marker that identifies their kind.
export const COMMITMENT_MARKER_OWNERSHIP = 0x00
export const COMMITMENT_MARKER_AUTH = 0x01
export const COMMITMENT_MARKER_VERSION_POINTER = 0x02

export const VERSION_POINTER_COMMITMENT_BYTES = 34
export const BACKEND_PK_HEX_LENGTH = 66
export const CATEGORY_HEX_LENGTH = 64

/**
 * Error raised whenever a card's contract version cannot be resolved safely.
 * Every failure path must surface one of these (or a subclass) instead of
 * silently defaulting to a version.
 */
export class ContractVersionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ContractVersionError'
  }
}

/**
 * Decodes a single Base36 version character.
 * @param {string} field
 * @returns {number} 1..35
 */
export function decodeBase36VersionField(field) {
  if (typeof field !== 'string' || field.length !== 1) {
    throw new ContractVersionError(`Invalid contract version field: ${JSON.stringify(field)}`)
  }
  const index = BASE36_VERSION_CHARS.indexOf(field)
  if (index === -1) {
    throw new ContractVersionError(`Invalid contract version field: ${JSON.stringify(field)}`)
  }
  return index + 1
}

/**
 * Encodes a version number into its single Base36 character.
 * @param {number} version
 * @returns {string}
 */
export function encodeBase36VersionField(version) {
  if (!Number.isInteger(version) || version < MIN_CONTRACT_VERSION || version > MAX_CONTRACT_VERSION) {
    throw new ContractVersionError(`Contract version out of range: ${version}`)
  }
  return BASE36_VERSION_CHARS[version - 1]
}

/**
 * Normalizes a server-reported version hint ("v2", "2", 2, "B") to a number.
 * Returns null when the value cannot be interpreted; callers must treat null as
 * a mismatch rather than a default.
 * @param {string|number|undefined|null} version
 * @returns {number|null}
 */
export function normalizeVersionHint(version) {
  if (version === undefined || version === null || version === '') return null
  if (typeof version === 'number') {
    return Number.isInteger(version) && version >= MIN_CONTRACT_VERSION ? version : null
  }
  const raw = String(version).trim()
  if (raw === '') return null
  const stripped = raw.toLowerCase().startsWith('v') ? raw.slice(1) : raw
  if (/^[0-9]+$/.test(stripped)) {
    const parsed = Number.parseInt(stripped, 10)
    return parsed >= MIN_CONTRACT_VERSION ? parsed : null
  }
  if (stripped.length === 1) {
    try {
      return decodeBase36VersionField(stripped.toUpperCase())
    } catch (_) {
      return null
    }
  }
  return null
}

/**
 * Parses the NDEF TEXT record carrying the contract parameters.
 *
 * Format: backend_pk ":" category [ ":" version ]
 *   backend_pk : 33-byte pubkey hex (66 chars)
 *   category   : 32-byte token category hex (64 chars)
 *   version    : OPTIONAL single Base36 character; absent means V1
 *
 * @param {string} textRecord
 * @returns {{ backendPk: string, category: string, originVersion: number, versionPresent: boolean }}
 */
export function parseContractParams(textRecord) {
  if (typeof textRecord !== 'string') {
    throw new ContractVersionError('Missing NDEF contract parameters')
  }

  const fields = textRecord.split(':')
  if (fields.length !== 2 && fields.length !== 3) {
    throw new ContractVersionError(`Invalid NDEF contract parameter field count: ${fields.length}`)
  }

  const [backendPk, category, versionField] = fields
  if (!backendPk) throw new ContractVersionError('NDEF contract parameters missing backend_pk')
  if (!category) throw new ContractVersionError('NDEF contract parameters missing category')

  if (!new RegExp(`^[0-9a-fA-F]{${BACKEND_PK_HEX_LENGTH}}$`).test(backendPk)) {
    throw new ContractVersionError('NDEF backend_pk must be a 33-byte hex public key')
  }
  if (!new RegExp(`^[0-9a-fA-F]{${CATEGORY_HEX_LENGTH}}$`).test(category)) {
    throw new ContractVersionError('NDEF category must be a 32-byte hex category')
  }

  let originVersion = DEFAULT_ORIGIN_VERSION
  const versionPresent = fields.length === 3
  if (versionPresent) {
    if (!versionField) {
      throw new ContractVersionError('NDEF contract version field is empty')
    }
    originVersion = decodeBase36VersionField(versionField)
  }

  return { backendPk, category, originVersion, versionPresent }
}

/**
 * Decodes a version pointer NFT commitment.
 *
 * Layout (34 bytes): 0x02 || targetVersion (1 byte) || targetCategory (32 bytes)
 * The target category is stored reverse-hex (the byte order the covenant uses
 * for its category parameter), so it is reversed back to the canonical order.
 *
 * @param {string} commitmentHex
 * @returns {{ targetVersion: number, targetCategory: string }}
 */
export function decodeVersionPointer(commitmentHex) {
  if (typeof commitmentHex !== 'string') {
    throw new ContractVersionError('Missing version pointer commitment')
  }
  const hex = commitmentHex.replace(/^0x/i, '').toLowerCase()
  if (!/^[0-9a-f]+$/.test(hex) || hex.length !== VERSION_POINTER_COMMITMENT_BYTES * 2) {
    throw new ContractVersionError('Version pointer commitment must be 34 bytes')
  }

  const bytes = hexToBin(hex)
  if (bytes[0] !== COMMITMENT_MARKER_VERSION_POINTER) {
    throw new ContractVersionError(`Version pointer commitment marker must be 0x02 (got 0x${bytes[0].toString(16).padStart(2, '0')})`)
  }

  const targetVersion = bytes[1]
  if (targetVersion < MIN_CONTRACT_VERSION) {
    throw new ContractVersionError(`Version pointer target version out of range: ${targetVersion}`)
  }
  if (targetVersion > MAX_CONTRACT_VERSION) {
    throw new ContractVersionError(`Version pointer target version out of range: ${targetVersion}`)
  }

  const targetCategory = reverseHex(binToHex(bytes.subarray(2, VERSION_POINTER_COMMITMENT_BYTES)))
  return { targetVersion, targetCategory }
}

/**
 * Encodes a version pointer commitment. Used by fixtures/tests and mirrors the
 * wallet's pointer layout exactly.
 * @param {{ targetVersion: number, targetCategory: string }} param0
 * @returns {string} 68-char hex commitment
 */
export function encodeVersionPointer({ targetVersion, targetCategory }) {
  if (
    !Number.isInteger(targetVersion) ||
    targetVersion < MIN_CONTRACT_VERSION ||
    targetVersion > MAX_CONTRACT_VERSION
  ) {
    throw new ContractVersionError(`Version pointer target version out of range: ${targetVersion}`)
  }
  if (typeof targetCategory !== 'string' || !/^[0-9a-fA-F]{64}$/.test(targetCategory)) {
    throw new ContractVersionError('Version pointer target category must be 32-byte hex')
  }
  const versionHex = targetVersion.toString(16).padStart(2, '0')
  return `${COMMITMENT_MARKER_VERSION_POINTER.toString(16).padStart(2, '0')}${versionHex}${reverseHex(targetCategory)}`
}
