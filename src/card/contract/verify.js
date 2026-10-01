import { ContractVersionError, normalizeVersionHint } from './version.js'

/**
 * Server preimage/build verification.
 *
 * The card server only supplies a HINT (contract_version) and a prepared spend
 * (txHex, preimages, inputs). The resolved on-chain version and the locally
 * rebuilt preimages are authoritative. Any disagreement fails closed and the
 * caller must not sign.
 */

/**
 * Enforces that the version the server says it built for equals the version the
 * POS resolved on-chain.
 * @param {string|number|undefined} serverVersion - preimage payload contract_version
 * @param {number} activeVersion - resolved active version
 * @returns {number} the normalized server version
 */
export function assertServerVersionMatches(serverVersion, activeVersion) {
  const normalized = normalizeVersionHint(serverVersion)
  if (normalized === null || normalized !== activeVersion) {
    throw new ContractVersionError(
      `Server contract version ${JSON.stringify(serverVersion)} does not match resolved active version v${activeVersion}`
    )
  }
  return normalized
}

function normalizePreimageEntry(entry, fallbackIndex) {
  const preimage = entry?.preimage
  if (typeof preimage !== 'string') {
    throw new ContractVersionError('Server preimage entry is missing its preimage hex')
  }
  const rawIndex = entry?.inputIndex ?? entry?.input_index
  const inputIndex = rawIndex === undefined || rawIndex === null ? fallbackIndex : Number(rawIndex)
  if (!Number.isInteger(inputIndex)) {
    throw new ContractVersionError('Server preimage entry has an invalid input index')
  }
  return { inputIndex, preimage: preimage.replace(/^0x/i, '').toLowerCase() }
}

function normalizePreimageList(preimages, label) {
  if (!Array.isArray(preimages)) {
    throw new ContractVersionError(`${label} preimages were not a list`)
  }
  return preimages
    .map((entry, index) => normalizePreimageEntry(entry, index))
    .sort((a, b) => a.inputIndex - b.inputIndex)
}

/**
 * Byte-for-byte comparison of the server preimages against the local rebuild.
 * @param {Array<{inputIndex: number, preimage: string}>} serverPreimages
 * @param {Array<{inputIndex: number, preimage: string}>} expectedPreimages
 */
export function comparePreimages(serverPreimages, expectedPreimages) {
  const server = normalizePreimageList(serverPreimages, 'Server')
  const expected = normalizePreimageList(expectedPreimages, 'Local')
  if (server.length !== expected.length) {
    throw new ContractVersionError('Preimage validation failed: length mismatch')
  }
  for (let i = 0; i < server.length; i++) {
    if (server[i].inputIndex !== expected[i].inputIndex) {
      throw new ContractVersionError(`Preimage validation failed: input index mismatch at position ${i}`)
    }
    if (server[i].preimage !== expected[i].preimage) {
      throw new ContractVersionError(`Preimage validation failed at index ${server[i].inputIndex}`)
    }
  }
}

/**
 * Normalizes a UTXO/input reference to a stable "txid:vout" identity.
 * @param {string|Object} input
 * @returns {string}
 */
export function normalizeInputRef(input) {
  if (typeof input === 'string') {
    const parts = input.split(':')
    if (parts.length !== 2) throw new ContractVersionError('Malformed input reference')
    return `${parts[0].toLowerCase()}:${Number(parts[1])}`
  }
  const txid = input?.txid ?? input?.tx_hash ?? input?.txHash
  const vout = input?.vout ?? input?.tx_pos ?? input?.txPos
  if (!txid || vout === undefined || vout === null) {
    throw new ContractVersionError('Malformed input reference')
  }
  return `${String(txid).toLowerCase()}:${Number(vout)}`
}

/**
 * Set comparison of the server inputs against the local rebuild. Input ORDER is
 * allowed to differ (the covenant spend is order-independent across the BCH
 * funding inputs), but the referenced outpoints must match exactly.
 * @param {Array} serverInputs
 * @param {Array} expectedInputs
 */
export function compareInputs(serverInputs, expectedInputs) {
  if (!Array.isArray(serverInputs)) {
    throw new ContractVersionError('Input validation failed: server inputs were not a list')
  }
  if (!Array.isArray(expectedInputs)) {
    throw new ContractVersionError('Input validation failed: local rebuild inputs were not a list')
  }
  if (serverInputs.length !== expectedInputs.length) {
    throw new ContractVersionError('Input validation failed: length mismatch')
  }
  const server = serverInputs.map(normalizeInputRef).sort()
  const expected = expectedInputs.map(normalizeInputRef).sort()
  for (let i = 0; i < server.length; i++) {
    if (server[i] !== expected[i]) {
      throw new ContractVersionError(`Input validation failed at position ${i}`)
    }
  }
}

/**
 * Compares the server-built transaction hex against the local rebuild.
 * @param {string} serverTxHex
 * @param {string} expectedTxHex
 */
export function compareTxHex(serverTxHex, expectedTxHex) {
  if (typeof serverTxHex !== 'string' || typeof expectedTxHex !== 'string') {
    throw new ContractVersionError('Transaction validation failed: missing txHex')
  }
  const server = serverTxHex.replace(/^0x/i, '').toLowerCase()
  const expected = expectedTxHex.replace(/^0x/i, '').toLowerCase()
  if (server !== expected) {
    throw new ContractVersionError('Transaction validation failed: txHex mismatch')
  }
}

/**
 * Cross-checks the optional, non-authoritative server pointer-state hint against
 * the on-chain resolution. A contradiction fails closed; a missing/incomplete
 * hint is ignored because it is not authoritative.
 *
 * @param {Object} params
 * @param {Object} params.resolution - result of resolveActiveContract
 * @param {Object} params.pointerState - { origin_version, pointer_present, target_version, target_category }
 */
export function crossCheckPointerState({ resolution, pointerState }) {
  if (!pointerState || typeof pointerState !== 'object') return

  const originVersion = normalizeVersionHint(pointerState.origin_version)
  if (originVersion !== null && originVersion !== resolution.originVersion) {
    throw new ContractVersionError(
      `Server pointer-state origin v${originVersion} contradicts on-chain origin v${resolution.originVersion}`
    )
  }

  const pointerPresent = Boolean(pointerState.pointer_present)
  if (pointerPresent !== resolution.pointerPresent) {
    throw new ContractVersionError(
      `Server pointer-state pointer_present=${pointerPresent} contradicts on-chain pointer_present=${resolution.pointerPresent}`
    )
  }

  if (!resolution.pointerPresent) return

  const targetVersion = normalizeVersionHint(pointerState.target_version)
  if (targetVersion !== null && targetVersion !== resolution.activeVersion) {
    throw new ContractVersionError(
      `Server pointer-state target v${targetVersion} contradicts on-chain active v${resolution.activeVersion}`
    )
  }
  if (
    typeof pointerState.target_category === 'string' &&
    pointerState.target_category.toLowerCase() !== resolution.activeCategory.toLowerCase()
  ) {
    throw new ContractVersionError('Server pointer-state target category contradicts on-chain active category')
  }
}

/**
 * When the server supplies an `inputs` list it must match the local rebuild.
 * When it omits inputs, skip that check; preimages and txHex still have to match.
 * @param {Array|undefined|null} serverInputs
 * @param {Array} expectedInputs
 */
function compareInputSets(serverInputs, expectedInputs) {
  if (serverInputs === undefined || serverInputs === null) {
    if (!Array.isArray(expectedInputs)) {
      throw new ContractVersionError('Input validation failed: local rebuild inputs were not a list')
    }
    return
  }
  compareInputs(serverInputs, expectedInputs)
}

/**
 * Pre-sign verification: version must match, then preimages and txHex.
 * Inputs are compared only when the server includes them.
 *
 * @param {Object} params
 * @param {number} params.activeVersion - resolved on-chain active version
 * @param {Object} params.server - preimage payload ({ contract_version, preimages, inputs, txHex })
 * @param {Object} params.expected - local rebuild ({ preimages, inputs, txHex })
 * @returns {number} the validated version
 */
export function verifySpendBuild({ activeVersion, server, expected }) {
  const version = assertServerVersionMatches(server?.contract_version, activeVersion)
  comparePreimages(server?.preimages, expected?.preimages)
  compareInputSets(server?.inputs, expected?.inputs)
  compareTxHex(server?.txHex, expected?.txHex)
  return version
}
