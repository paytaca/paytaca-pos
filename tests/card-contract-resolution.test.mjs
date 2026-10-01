import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  ContractVersionError,
  decodeBase36VersionField,
  encodeBase36VersionField,
  normalizeVersionHint,
  parseContractParams,
  decodeVersionPointer,
  VERSION_POINTER_COMMITMENT_BYTES,
} from '../src/card/contract/version.js'
import {
  resolveActiveContract,
  findVersionPointerCandidates,
} from '../src/card/contract/resolution.js'
import {
  assertServerVersionMatches,
  comparePreimages,
  compareInputs,
  compareTxHex,
  verifySpendBuild,
  crossCheckPointerState,
} from '../src/card/contract/verify.js'
import {
  BACKEND_PK,
  ORIGIN_CATEGORY,
  AUTH_CATEGORY,
  TARGET_CATEGORY,
  NDEF_TEXT_FIXTURES,
  VERSION_POINTER_V2_HEX,
  pointerUtxo,
  nonPointerNft,
  ownershipAuthToken,
} from './fixtures/card-contract-fixtures.mjs'

const DERIVE_TOKEN_ADDRESS = () => 'bitcoincash:zptestoriginaddress'
const noUtxos = async () => []

function resolver(utxos) {
  return async () => utxos
}

async function resolveOrigin(textRecord, utxos = []) {
  const { backendPk, category, originVersion } = parseContractParams(textRecord)
  return resolveActiveContract({
    backendPk,
    category,
    originVersion,
    deriveTokenAddress: DERIVE_TOKEN_ADDRESS,
    fetchTokenUtxos: resolver(utxos),
  })
}

describe('NDEF contract parameter parsing (fixtures)', () => {
  it('parses a version-less record as V1', () => {
    const parsed = parseContractParams(NDEF_TEXT_FIXTURES.versionAbsent)
    assert.deepEqual(parsed, {
      backendPk: BACKEND_PK,
      category: ORIGIN_CATEGORY,
      originVersion: 1,
      versionPresent: false,
    })
  })

  it('parses explicit Base36 versions', () => {
    assert.equal(parseContractParams(NDEF_TEXT_FIXTURES.versionOne).originVersion, 1)
    assert.equal(parseContractParams(NDEF_TEXT_FIXTURES.versionTwo).originVersion, 2)
    assert.equal(parseContractParams(NDEF_TEXT_FIXTURES.versionTen).originVersion, 10)
    assert.equal(parseContractParams(NDEF_TEXT_FIXTURES.versionThirtyFive).originVersion, 35)
  })

  it('round-trips the Base36 version codec', () => {
    for (let v = 1; v <= 35; v++) {
      assert.equal(decodeBase36VersionField(encodeBase36VersionField(v)), v)
    }
    assert.equal(encodeBase36VersionField(2), '2')
    assert.equal(encodeBase36VersionField(10), 'A')
    assert.equal(encodeBase36VersionField(35), 'Z')
  })

  it('fails closed on unparseable or malformed records', () => {
    const bad = [
      `${BACKEND_PK}:${ORIGIN_CATEGORY}:0`,      // '0' is not a valid version
      `${BACKEND_PK}:${ORIGIN_CATEGORY}:a`,      // lowercase not in mapping
      `${BACKEND_PK}:${ORIGIN_CATEGORY}:2x`,     // two chars
      `${BACKEND_PK}:${ORIGIN_CATEGORY}:`,       // empty version field
      `${BACKEND_PK}:${ORIGIN_CATEGORY}:2:3`,    // four fields
      `${BACKEND_PK}:`,                          // missing category
      `:${ORIGIN_CATEGORY}`,                     // missing backend_pk
      `${BACKEND_PK}`,                           // one field
      `${'11'.repeat(32)}:${ORIGIN_CATEGORY}`,   // backend_pk not compressed
      `${BACKEND_PK}:${'11'.repeat(20)}`,        // category wrong length
      `${BACKEND_PK}:${ORIGIN_CATEGORY}:@`,      // not Base36
    ]
    for (const record of bad) {
      assert.throws(() => parseContractParams(record), ContractVersionError, record)
    }
  })
})

describe('version pointer commitment (fixtures)', () => {
  it('decodes 0x02 || version || reverseHex(category)', () => {
    const decoded = decodeVersionPointer(VERSION_POINTER_V2_HEX)
    assert.equal(decoded.targetVersion, 2)
    assert.equal(decoded.targetCategory, TARGET_CATEGORY)
  })

  it('fails closed on wrong marker, length or version', () => {
    assert.throws(() => decodeVersionPointer('00' + '02' + 'ab'.repeat(32)), ContractVersionError)
    assert.throws(() => decodeVersionPointer('0202'), ContractVersionError)
    assert.throws(() => decodeVersionPointer('0200' + 'ab'.repeat(32)), ContractVersionError)
    assert.throws(() => decodeVersionPointer(null), ContractVersionError)
    assert.equal(VERSION_POINTER_V2_HEX.length, VERSION_POINTER_COMMITMENT_BYTES * 2)
  })
})

describe('on-chain active contract resolution', () => {
  it('version absent => V1, no pointer, active V1', async () => {
    const result = await resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [ownershipAuthToken()])
    assert.equal(result.originVersion, 1)
    assert.equal(result.pointerPresent, false)
    assert.equal(result.migrated, false)
    assert.equal(result.activeVersion, 1)
    assert.equal(result.activeCategory, ORIGIN_CATEGORY)
    assert.equal(result.authCategory, AUTH_CATEGORY)
  })

  it('version present => V2, no pointer, active V2', async () => {
    const result = await resolveOrigin(NDEF_TEXT_FIXTURES.versionTwo, [ownershipAuthToken()])
    assert.equal(result.originVersion, 2)
    assert.equal(result.pointerPresent, false)
    assert.equal(result.activeVersion, 2)
    assert.equal(result.activeCategory, ORIGIN_CATEGORY)
  })

  it('V1 + pointer to V2 => active V2 target category', async () => {
    const result = await resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [
      ownershipAuthToken(),
      pointerUtxo({ targetVersion: 2, targetCategory: TARGET_CATEGORY }),
    ])
    assert.equal(result.pointerPresent, true)
    assert.equal(result.migrated, true)
    assert.equal(result.activeVersion, 2)
    assert.equal(result.activeCategory, TARGET_CATEGORY)
  })

  it('scans the auth category from the ownership token, not the NDEF category', async () => {
    const calls = []
    const result = await resolveActiveContract({
      backendPk: BACKEND_PK,
      category: ORIGIN_CATEGORY,
      originVersion: 1,
      deriveTokenAddress: DERIVE_TOKEN_ADDRESS,
      fetchTokenUtxos: async (tokenId) => {
        calls.push(tokenId)
        if (tokenId.toLowerCase() === AUTH_CATEGORY.toLowerCase()) {
          return [pointerUtxo({ targetVersion: 2, targetCategory: TARGET_CATEGORY })]
        }
        return [ownershipAuthToken()]
      },
    })
    assert.equal(result.authCategory, AUTH_CATEGORY)
    assert.equal(result.activeVersion, 2)
    assert.deepEqual(calls, [ORIGIN_CATEGORY, AUTH_CATEGORY])
  })

  it('fails closed when no ownership token carries the auth category', async () => {
    await assert.rejects(
      resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [nonPointerNft({ category: ORIGIN_CATEGORY })]),
      /auth category/
    )
  })

  it('pointer missing => stays on origin', async () => {
    const result = await resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [
      ownershipAuthToken(),
      nonPointerNft(),
    ])
    assert.equal(result.pointerPresent, false)
    assert.equal(result.activeVersion, 1)
  })

  it('pointer conflict (>1) fails closed', async () => {
    await assert.rejects(
      resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [
        ownershipAuthToken(),
        pointerUtxo({ vout: 0 }),
        pointerUtxo({ vout: 1 }),
      ]),
      ContractVersionError
    )
  })

  it('targetVersion <= originVersion fails closed', async () => {
    await assert.rejects(
      resolveOrigin(NDEF_TEXT_FIXTURES.versionTwo, [
        ownershipAuthToken(),
        pointerUtxo({ targetVersion: 2, targetCategory: TARGET_CATEGORY }),
      ]),
      ContractVersionError
    )
    await assert.rejects(
      resolveOrigin(NDEF_TEXT_FIXTURES.versionTwo, [
        ownershipAuthToken(),
        pointerUtxo({ targetVersion: 1, targetCategory: TARGET_CATEGORY }),
      ]),
      ContractVersionError
    )
  })

  it('pointer under the wrong category fails closed', async () => {
    await assert.rejects(
      resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [
        ownershipAuthToken(),
        pointerUtxo({ category: 'ff'.repeat(32), targetVersion: 2 }),
      ]),
      /category mismatch/
    )
  })

  it('a chain-read failure propagates instead of defaulting to V1', async () => {
    await assert.rejects(
      resolveActiveContract({
        backendPk: BACKEND_PK,
        category: ORIGIN_CATEGORY,
        originVersion: 1,
        deriveTokenAddress: DERIVE_TOKEN_ADDRESS,
        fetchTokenUtxos: async () => { throw new Error('watchtower down') },
      }),
      /watchtower down/
    )
  })

  it('finds only mutable 0x02 commitments as pointer candidates', () => {
    const candidates = findVersionPointerCandidates([
      pointerUtxo(),
      nonPointerNft(),
      pointerUtxo({ capability: 'none', vout: 9 }),
    ])
    assert.equal(candidates.length, 1)
  })
})

describe('server hint + preimage verification', () => {
  it('server version mismatch fails closed; matching hints pass', () => {
    assert.throws(() => assertServerVersionMatches('v1', 2), ContractVersionError)
    assert.throws(() => assertServerVersionMatches(undefined, 1), ContractVersionError)
    assert.throws(() => assertServerVersionMatches('garbage', 1), ContractVersionError)
    assert.equal(assertServerVersionMatches('v2', 2), 2)
    assert.equal(assertServerVersionMatches('2', 2), 2)
    assert.equal(assertServerVersionMatches(2, 2), 2)
    assert.equal(normalizeVersionHint('B'), 11)
    assert.equal(normalizeVersionHint('v10'), 10)
    assert.equal(normalizeVersionHint('1'), 1)
  })

  it('preimage mismatch fails closed, identical preimages pass', () => {
    const preimages = [
      { inputIndex: 0, preimage: 'aa'.repeat(4) },
      { inputIndex: 1, preimage: 'bb'.repeat(4) },
    ]
    assert.doesNotThrow(() => comparePreimages(preimages, preimages))
    assert.throws(
      () => comparePreimages(
        [{ inputIndex: 0, preimage: 'aa'.repeat(4) }],
        [{ inputIndex: 0, preimage: 'cc'.repeat(4) }]
      ),
      /Preimage validation failed at index 0/
    )
    assert.throws(
      () => comparePreimages(preimages, [preimages[0]]),
      /length mismatch/
    )
  })

  it('input and txHex mismatches fail closed', () => {
    const inputs = [
      { txid: 'aa'.repeat(32), vout: 0 },
      { txid: 'bb'.repeat(32), vout: 1 },
    ]
    assert.doesNotThrow(() => compareInputs(inputs, [...inputs].reverse()))
    assert.throws(
      () => compareInputs(inputs, [{ txid: 'cc'.repeat(32), vout: 0 }, inputs[1]]),
      /Input validation failed/
    )
    assert.doesNotThrow(() => compareTxHex('AABB', 'aabb'))
    assert.throws(() => compareTxHex('aabb', 'aacc'), /txHex mismatch/)
  })

  it('pointer-state hint is non-authoritative but contradiction fails closed', async () => {
    const migrated = await resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [
      ownershipAuthToken(),
      pointerUtxo({ targetVersion: 2, targetCategory: TARGET_CATEGORY }),
    ])
    assert.doesNotThrow(() => crossCheckPointerState({ resolution: migrated, pointerState: undefined }))
    assert.doesNotThrow(() => crossCheckPointerState({
      resolution: migrated,
      pointerState: { origin_version: 1, pointer_present: true, target_version: 2, target_category: TARGET_CATEGORY },
    }))
    assert.throws(() => crossCheckPointerState({
      resolution: migrated,
      pointerState: { pointer_present: false },
    }), /contradicts/)
    assert.throws(() => crossCheckPointerState({
      resolution: migrated,
      pointerState: { pointer_present: true, target_version: 3 },
    }), /contradicts/)
    assert.throws(() => crossCheckPointerState({
      resolution: migrated,
      pointerState: { pointer_present: true, target_version: 2, target_category: 'ff'.repeat(32) },
    }), /contradicts/)

    const unmigrated = await resolveOrigin(NDEF_TEXT_FIXTURES.versionAbsent, [ownershipAuthToken()])
    assert.throws(() => crossCheckPointerState({
      resolution: unmigrated,
      pointerState: { pointer_present: true, target_version: 2 },
    }), /contradicts/)
  })

  it('verifySpendBuild enforces version before the rebuild', () => {
    const server = {
      contract_version: 'v2',
      preimages: [{ inputIndex: 0, preimage: 'aa'.repeat(4) }],
      inputs: [{ txid: 'aa'.repeat(32), vout: 0 }],
      txHex: 'deadbeef',
    }
    const expected = {
      preimages: [{ inputIndex: 0, preimage: 'aa'.repeat(4) }],
      inputs: [{ txid: 'aa'.repeat(32), vout: 0 }],
      txHex: 'deadbeef',
    }
    assert.equal(verifySpendBuild({ activeVersion: 2, server, expected }), 2)
    assert.equal(
      verifySpendBuild({ activeVersion: 2, server: { ...server, inputs: undefined }, expected }),
      2
    )
    assert.throws(
      () => verifySpendBuild({ activeVersion: 2, server: { ...server, inputs: { 0: server.inputs[0] } }, expected }),
      /server inputs were not a list/
    )
    assert.throws(
      () => verifySpendBuild({ activeVersion: 1, server, expected }),
      /does not match resolved active version v1/
    )
    assert.throws(
      () => verifySpendBuild({
        activeVersion: 2,
        server,
        expected: { ...expected, preimages: [{ inputIndex: 0, preimage: 'cc'.repeat(4) }] },
      }),
      /Preimage validation failed at index 0/
    )
  })
})
