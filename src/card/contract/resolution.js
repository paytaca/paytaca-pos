import {
  ContractVersionError,
  COMMITMENT_MARKER_VERSION_POINTER,
  decodeVersionPointer,
} from './version.js'
import { decodeOwnershipCommitment } from '../utils.js'

/**
 * On-chain contract version resolution.
 *
 * A card's NDEF always presents the ORIGIN contract parameters. When the card's
 * owner has migrated funds to a higher-version contract, the wallet parks a
 * mutable "version pointer" NFT (commitment 0x02) at the ORIGIN token address.
 * That pointer — not the server — is authoritative for the active version.
 *
 * The pointer does NOT live under the NDEF (ownership) category. The NDEF
 * category only identifies the card's ownership tokens; one of those ownership
 * tokens carries a 0x01 ('cat') commitment holding the AUTH-token category, and
 * the version pointer is parked under THAT auth category. Resolution therefore
 * derives the auth category from the ownership tokens before scanning for the
 * pointer.
 *
 * This module performs no network access itself: the token address derivation
 * and the origin-address UTXO fetch are injected so the algorithm is unit
 * testable and so callers control caching/error policy.
 */

export function isMutableNft(utxo) {
  const capability = utxo?.token?.nft?.capability
  return typeof capability === 'string' && capability.toLowerCase() === 'mutable'
}

export function commitmentMarker(utxo) {
  const commitment = utxo?.token?.nft?.commitment
  if (typeof commitment !== 'string') return null
  const hex = commitment.replace(/^0x/i, '')
  if (hex.length < 2) return null
  return Number.parseInt(hex.slice(0, 2), 16)
}

function sameCategory(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Derives the card's auth-token category from its ownership tokens. The NDEF
 * category identifies ownership tokens; the one whose commitment decodes to
 * type 'cat' stores the auth category (canonical order). This is the category
 * the version pointer NFT is parked under.
 * @param {Array} ownershipUtxos
 * @returns {string|null}
 */
export function findAuthCategory(ownershipUtxos = []) {
  for (const utxo of ownershipUtxos) {
    const commitment = utxo?.token?.nft?.commitment
    if (typeof commitment !== 'string' || commitment.length === 0) continue
    let decoded
    try {
      decoded = decodeOwnershipCommitment(commitment)
    } catch (_) {
      continue
    }
    if (decoded && decoded.type === 'cat' && typeof decoded.value === 'string' && decoded.value) {
      return decoded.value
    }
  }
  return null
}

/**
 * Identifies NFT UTXOs that look like a version pointer: a mutable NFT whose
 * commitment marker is 0x02. Category is validated separately so a pointer
 * parked under the wrong category fails closed instead of being ignored.
 */
export function findVersionPointerCandidates(utxos = []) {
  return utxos.filter(
    (utxo) => isMutableNft(utxo) && commitmentMarker(utxo) === COMMITMENT_MARKER_VERSION_POINTER
  )
}

/**
 * Resolves the active contract for a card.
 *
 * @param {Object} params
 * @param {string} params.backendPk
 * @param {string} params.category - origin ownership category from the NDEF TEXT record
 * @param {number} params.originVersion - origin version from the NDEF TEXT record
 * @param {(params: {backendPk: string, category: string, version: number}) => string} params.deriveTokenAddress
 * @param {(tokenId: string, tokenAddress: string) => Promise<Array>} params.fetchTokenUtxos - called first with the ownership category, then with the derived auth category
 * @returns {Promise<{
 *   originVersion: number,
 *   pointerPresent: boolean,
 *   migrated: boolean,
 *   activeVersion: number,
 *   activeCategory: string,
 *   authCategory: string,
 *   originTokenAddress: string,
 *   pointer: ({ targetVersion: number, targetCategory: string }|null)
 * }>}
 */
export async function resolveActiveContract({
  backendPk,
  category,
  originVersion,
  deriveTokenAddress,
  fetchTokenUtxos,
}) {
  if (!backendPk || !category) {
    throw new ContractVersionError('Cannot resolve contract without backend_pk and category')
  }
  if (!Number.isInteger(originVersion) || originVersion < 1) {
    throw new ContractVersionError(`Invalid origin version: ${originVersion}`)
  }
  if (typeof deriveTokenAddress !== 'function') {
    throw new ContractVersionError('A token address derivation function is required')
  }
  if (typeof fetchTokenUtxos !== 'function') {
    throw new ContractVersionError('A token UTXO fetcher is required')
  }

  const originTokenAddress = deriveTokenAddress({ backendPk, category, version: originVersion })
  if (!originTokenAddress) {
    throw new ContractVersionError('Failed to derive the origin token address')
  }

  // 1) Ownership tokens (NDEF category) at the origin token address. One of
  //    them stores the auth category the version pointer lives under.
  const ownershipUtxos = (await fetchTokenUtxos(category, originTokenAddress)) || []
  if (!Array.isArray(ownershipUtxos)) {
    throw new ContractVersionError('Token UTXO response was not a list')
  }

  const authCategory = findAuthCategory(ownershipUtxos)
  if (!authCategory) {
    // Without the auth category we cannot look for a pointer, so we cannot prove
    // the card is un-migrated. Fail closed rather than silently staying on V1.
    throw new ContractVersionError(
      'Unable to derive the auth category from the origin ownership tokens'
    )
  }

  // 2) Version pointer scan under the auth category (NOT the NDEF category).
  const pointerUtxos = (await fetchTokenUtxos(authCategory, originTokenAddress)) || []
  if (!Array.isArray(pointerUtxos)) {
    throw new ContractVersionError('Token UTXO response was not a list')
  }

  const candidates = findVersionPointerCandidates(pointerUtxos)

  // A pointer must live under the card's auth category. A 0x02 commitment under
  // any other category is a corruption/attack signal, never silently ignored.
  for (const candidate of candidates) {
    if (!sameCategory(candidate?.token?.category, authCategory)) {
      throw new ContractVersionError('Version pointer category mismatch')
    }
  }

  if (candidates.length > 1) {
    throw new ContractVersionError('Multiple version pointers found for the card; refusing to guess')
  }

  if (candidates.length === 0) {
    return {
      originVersion,
      pointerPresent: false,
      migrated: false,
      activeVersion: originVersion,
      activeCategory: category,
      authCategory,
      originTokenAddress,
      pointer: null,
    }
  }

  const pointer = decodeVersionPointer(candidates[0].token.nft.commitment)

  if (pointer.targetVersion <= originVersion) {
    throw new ContractVersionError(
      `Version pointer target v${pointer.targetVersion} is not above origin v${originVersion}`
    )
  }

  return {
    originVersion,
    pointerPresent: true,
    migrated: true,
    activeVersion: pointer.targetVersion,
    activeCategory: pointer.targetCategory,
    authCategory,
    originTokenAddress,
    pointer,
  }
}
