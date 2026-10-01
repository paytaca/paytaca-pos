import { encodeVersionPointer } from '../../src/card/contract/version.js'
import { reverseHex } from '../../src/card/utils.js'

// 33-byte compressed pubkey hex (66 chars) and 32-byte category hex (64 chars).
export const BACKEND_PK = '02' + '11'.repeat(32)
export const ORIGIN_CATEGORY = 'cd'.repeat(32)
// Deliberately non-palindromic so a missed reverse-hex would be caught.
export const TARGET_CATEGORY = 'a1b2c3d4'.repeat(8)
// The auth-token category is discovered from an ownership token's 0x01 ('cat')
// commitment. The version pointer NFT is parked under THIS category, not the
// NDEF ownership category.
export const AUTH_CATEGORY = 'ef'.repeat(32)

export const NDEF_TEXT_FIXTURES = Object.freeze({
  versionAbsent: `${BACKEND_PK}:${ORIGIN_CATEGORY}`,
  versionOne: `${BACKEND_PK}:${ORIGIN_CATEGORY}:1`,
  versionTwo: `${BACKEND_PK}:${ORIGIN_CATEGORY}:2`,
  versionTen: `${BACKEND_PK}:${ORIGIN_CATEGORY}:A`,
  versionThirtyFive: `${BACKEND_PK}:${ORIGIN_CATEGORY}:Z`,
})

// 0x02 || 0x02 || reverseHex(TARGET_CATEGORY)
export const VERSION_POINTER_V2 = encodeVersionPointer({
  targetVersion: 2,
  targetCategory: TARGET_CATEGORY,
})

export const VERSION_POINTER_V2_HEX =
  '0202d4c3b2a1d4c3b2a1d4c3b2a1d4c3b2a1d4c3b2a1d4c3b2a1d4c3b2a1d4c3b2a1'

/**
 * An ownership token (category = NDEF ownership category) whose 0x01 ('cat')
 * commitment carries the card's auth-token category. The version pointer NFT is
 * discovered by first reading this value and then scanning that category.
 */
export function ownershipAuthToken({
  category = ORIGIN_CATEGORY,
  authCategory = AUTH_CATEGORY,
  capability = 'mutable',
  txid = 'cc'.repeat(32),
  vout = 0,
} = {}) {
  return {
    txid,
    vout,
    satoshis: 1000n,
    token: {
      category,
      amount: 0n,
      nft: {
        capability,
        commitment: '01' + reverseHex(authCategory),
      },
    },
  }
}

/**
 * Builds a mutable NFT UTXO shaped like the watchtower ct-utxo response. The
 * pointer lives under the auth category (AUTH_CATEGORY), not the ownership one.
 */
export function pointerUtxo({
  category = AUTH_CATEGORY,
  targetVersion = 2,
  targetCategory = TARGET_CATEGORY,
  capability = 'mutable',
  commitment,
  txid = 'aa'.repeat(32),
  vout = 0,
} = {}) {
  return {
    txid,
    vout,
    satoshis: 1000n,
    token: {
      category,
      amount: 0n,
      nft: {
        capability,
        commitment: commitment ?? encodeVersionPointer({ targetVersion, targetCategory }),
      },
    },
  }
}

export function nonPointerNft({ category = AUTH_CATEGORY, commitment = '00' + 'ab'.repeat(20) } = {}) {
  return {
    txid: 'bb'.repeat(32),
    vout: 1,
    satoshis: 1000n,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
  }
}
