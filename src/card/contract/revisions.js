import { binToHex, decodeCashAddress, CashAddressType } from '@bitauth/libauth'
import { ContractVersionError } from './version.js'
import { findAuthCategory, resolveActiveContract } from './resolution.js'

// Explicit local allowlist. Server responses cannot add code to this list.
export function supportedRevisions(version) {
  if (version === 1) return ['current', 'pre-mutate-v1']
  if (version === 2) return ['current']
  throw new ContractVersionError(
    `Unsupported TapToPay contract version: ${version}`
  )
}

function addressIdentity(address) {
  if (typeof address !== 'string')
    throw new ContractVersionError(
      'Missing contract_address in preimage response'
    )
  const decoded = decodeCashAddress(address)
  if (
    typeof decoded === 'string' ||
    decoded.prefix !== 'bitcoincash' ||
    ![CashAddressType.p2sh, CashAddressType.p2shWithTokens].includes(
      decoded.type
    )
  ) {
    throw new ContractVersionError('Invalid contract address')
  }
  return binToHex(decoded.payload)
}

export function selectContractRevision({ version, address, deriveAddress }) {
  const identity = addressIdentity(address)
  const matches = supportedRevisions(version).filter(
    (revision) => addressIdentity(deriveAddress(revision)) === identity
  )
  if (matches.length !== 1)
    throw new ContractVersionError(
      'Contract address does not identify one supported script revision'
    )
  return matches[0]
}

// Discover the origin independently before asking the server to build a spend.
// Do not mistake a historical origin for a migration or swallow chain errors.
export async function resolveSupportedContract({
  backendPk,
  category,
  originVersion,
  deriveTokenAddress,
  fetchTokenUtxos,
}) {
  const candidates = await Promise.all(
    supportedRevisions(originVersion).map(async (revision) => {
      const address = deriveTokenAddress({
        backendPk,
        category,
        version: originVersion,
        revision,
      })
      const utxos = await fetchTokenUtxos(category, address)
      if (!Array.isArray(utxos))
        throw new ContractVersionError('Token UTXO response was not a list')
      const ownership = utxos.filter(
        (utxo) =>
          utxo?.token?.category?.toLowerCase() === category.toLowerCase()
      )
      return { revision, address, ownership }
    })
  )
  const matches = candidates.filter((candidate) =>
    findAuthCategory(candidate.ownership)
  )
  if (matches.length !== 1)
    throw new ContractVersionError(
      'Unable to identify one supported origin contract from ownership tokens'
    )
  const origin = matches[0]
  const resolution = await resolveActiveContract({
    backendPk,
    category,
    originVersion,
    deriveTokenAddress: () => origin.address,
    fetchTokenUtxos: (tokenId, address) =>
      tokenId === category
        ? Promise.resolve(origin.ownership)
        : fetchTokenUtxos(tokenId, address),
  })
  supportedRevisions(resolution.activeVersion)
  return {
    ...resolution,
    originRevision: origin.revision,
    activeRevision: resolution.migrated ? 'current' : origin.revision,
  }
}
