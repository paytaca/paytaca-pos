import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { Contract, SignatureTemplate, placeholderSignature } from 'cashscript0.11.5'
import { binToHex, hexToBin, utf8ToBin, encodePrivateKeyWif } from '@bitauth/libauth'
import { scriptToBytecode } from '@cashscript/utils'
import { createSighashPreimage, cashScriptOutputToLibauthOutput } from 'cashscript/dist/utils.js'
import { resolveActiveContract } from '../src/card/contract/resolution.js'
import { assertServerVersionMatches, verifySpendBuild } from '../src/card/contract/verify.js'
import { decodeServerTransaction } from '../src/card/contract/locktime.js'
import { pubkeyToPkHash, reverseHex, encodeCommitment, signPreimages } from '../src/card/utils.js'
import { ownershipAuthToken, nonPointerNft } from './fixtures/card-contract-fixtures.mjs'

const readArtifact = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const historical = await readArtifact('./fixtures/pre-mutate-v1.artifact.json')
const v1 = await readArtifact('../src/card/contract/tap-to-pay-v1.artifact.json')
const v2 = await readArtifact('../src/card/contract/tap-to-pay-v2.artifact.json')
const supportedHistorical = await readArtifact('../src/card/contract/tap-to-pay-v1-pre-mutate.artifact.json')
it('pins the production historical artifact to the verified source and bytecode', () => {
  assert.equal(supportedHistorical.source, historical.source)
  assert.equal(supportedHistorical.bytecode, historical.bytecode)
})
// Use the VM bundled with the installed CashScript SDK, including P2SH32 support.
const sdkRequire = createRequire(import.meta.resolve('cashscript0.11.5'))
const { createVirtualMachineBch2025 } = await import(sdkRequire.resolve('@bitauth/libauth'))
const provider = {
  network: 'mainnet',
  async getBlockHeight() { assert.fail('Tests must supply locktime') },
  async getUtxos() { assert.fail('Tests must supply local UTXOs') },
}
const makeContract = (artifact, params) => new Contract(artifact, params, { provider })

// Exact constructor field of the serialized ID supplied by the user for
// contract 61/card 66. This is not database ID 61 or a newly generated ID.
const constructorField = 'Tmpsa1pEQTVPVFEwTUdFMU5EWXdaRGcyWXpBM1lXUXdPRFpsTTJGak5UQTNZelpqTkRjd05BPT06TnpVeE1HTTVabU14WVRnek1EazJNR1l3T1RSa056azBNRGhpTWpWa05EVmtZek5qWWpoak16TmpZbVUwWmpaa04ySmtOREZsWlRVMU1UZGlNMkZrTUE9PQ=='
const decodeBase64 = value => Buffer.from(value, 'base64').toString('utf8')
const originalParams = decodeBase64(constructorField).split(':').map(decodeBase64)
const originalAddress = 'bitcoincash:pd78tqvzy7fxgc0lav8dqd08ywd50wwfl3fawjlshyjhxtcp70mdzahfkdqvv'
const substitutedAddress = 'bitcoincash:pvwlwn6p6qkp4jtkudwll6tah8p4uttz0xljfxmsy2t4ty5cs84ny6c42ww59'

it('reproduces both contract-61 addresses with the supplied ID parameters', () => {
  assert.equal(makeContract(historical, originalParams).address, originalAddress)
  assert.equal(makeContract(v1, originalParams).address, substitutedAddress)
  assert.notEqual(historical.bytecode, v1.bytecode)
  assert.equal(assertServerVersionMatches('v1', 1), 1, 'a version hint cannot distinguish these scripts')
})

it('demonstrates why version-only derivation misses historical ownership NFTs', async () => {
  const category = reverseHex(originalParams[1])
  const old = makeContract(historical, originalParams)
  const current = makeContract(v1, originalParams)
  const calls = []
  await assert.rejects(resolveActiveContract({
    backendPk: 'unused-by-injected-derivation', category, originVersion: 1,
    deriveTokenAddress: () => current.tokenAddress,
    fetchTokenUtxos: async (tokenId, address) => {
      calls.push(address)
      return address === old.tokenAddress && tokenId === category ? [ownershipAuthToken({ category })] : []
    },
  }), /Unable to derive the auth category from the origin ownership tokens/)
  assert.deepEqual(calls, [current.tokenAddress])
})

const backendKey = new Uint8Array(32).fill(1)
const merchantKey = new Uint8Array(32).fill(2)
const backendSigner = new SignatureTemplate(backendKey)
const merchantSigner = new SignatureTemplate(merchantKey)
const backendPk = binToHex(backendSigner.getPublicKey())
const merchantPk = binToHex(merchantSigner.getPublicKey())
const dummyParams = [pubkeyToPkHash(backendPk), originalParams[1]]
const inputs = [
  ownershipAuthToken({ category: reverseHex(dummyParams[1]) }),
  nonPointerNft({ commitment: encodeCommitment({ authorized: true, spendLimitSats: 100000 }) }),
  { txid: 'ab'.repeat(32), vout: 0, satoshis: 50000n },
]

async function build(artifact, version = 'v1') {
  const contract = makeContract(artifact, dummyParams)
  const txHex = await contract.functions.spend(
    utf8ToBin('938'), placeholderSignature(), merchantPk, placeholderSignature(), backendPk,
  ).from(inputs).to([
    ...inputs.slice(0, 2).map(input => ({ to: contract.tokenAddress, amount: input.satoshis, token: input.token })),
    { to: contract.address, amount: 2815n },
  ]).withTime(800000).build()
  const transaction = decodeServerTransaction(txHex)
  const sourceOutputs = inputs.map(input => cashScriptOutputToLibauthOutput({
    to: input.token ? contract.tokenAddress : contract.address, amount: input.satoshis, token: input.token,
  }))
  const preimages = inputs.map((_, inputIndex) => ({
    inputIndex,
    preimage: binToHex(createSighashPreimage(transaction, sourceOutputs, inputIndex, scriptToBytecode(contract.redeemScript), 0x41)),
  }))
  return { contract, transaction, sourceOutputs, txHex, preimages, inputs, contract_version: version }
}

it('rejects historical BCH preimages against the bundled V1 rebuild even with matching version labels', async () => {
  const server = await build(historical)
  const expected = await build(v1)
  assert.notEqual(server.txHex, expected.txHex)
  assert.notEqual(server.preimages[0].preimage, expected.preimages[0].preimage)
  assert.throws(() => verifySpendBuild({ activeVersion: 1, server, expected }), /Preimage validation failed/)
})

for (const [label, artifact, version] of [['historical V1', historical, 1], ['current V1', v1, 1], ['current V2', v2, 2]]) {
  it(`${label}: POS signatures spend the matching script locally and reject a substituted redeem script`, async () => {
    const built = await build(artifact, `v${version}`)
    assert.equal(verifySpendBuild({ activeVersion: version, server: built, expected: await build(artifact, `v${version}`) }), version)
    const signatures = await signPreimages({
      preimages: built.preimages, wif: encodePrivateKeyWif(merchantKey, 'mainnet'),
    })
    const vm = createVirtualMachineBch2025()
    function unlockWith(contract) {
      built.transaction.inputs.forEach((input, inputIndex) => {
        input.unlockingBytecode = contract.unlock.spend(
          utf8ToBin('938'), hexToBin(signatures[inputIndex].merchantSigHex), merchantPk, backendSigner, backendPk,
        ).generateUnlockingBytecode({ transaction: built.transaction, sourceOutputs: built.sourceOutputs, inputIndex })
      })
      return built.transaction.inputs.map((_, inputIndex) => vm.stateSuccess(vm.evaluate({
        transaction: built.transaction, sourceOutputs: built.sourceOutputs, inputIndex,
      })))
    }
    assert.deepEqual(unlockWith(built.contract), [true, true, true])
    const other = makeContract(artifact === v1 ? historical : v1, dummyParams)
    assert.ok(unlockWith(other).every(result => result !== true), 'different script must fail against original P2SH32 outputs')
  })
}
