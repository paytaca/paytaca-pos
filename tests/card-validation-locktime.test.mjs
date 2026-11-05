import { readFile } from 'node:fs/promises'
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { Contract, placeholderSignature } from 'cashscript0.11.5'
import { binToHex, hexToBin, utf8ToBin, encodeTransaction } from '@bitauth/libauth'
import { scriptToBytecode } from '@cashscript/utils'
import { createSighashPreimage, cashScriptOutputToLibauthOutput } from 'cashscript/dist/utils.js'
import { decodeServerTransaction, buildWithServerLocktime } from '../src/card/contract/locktime.js'
import { verifySpendBuild } from '../src/card/contract/verify.js'
import { pubkeyToPkHash, reverseHex, encodeCommitment } from '../src/card/utils.js'
import { BACKEND_PK, ORIGIN_CATEGORY, ownershipAuthToken, nonPointerNft } from './fixtures/card-contract-fixtures.mjs'

const artifact = JSON.parse(await readFile(new URL('../src/card/contract/tap-to-pay-v2.artifact.json', import.meta.url), 'utf8'))
const inputs = [
  ownershipAuthToken(),
  nonPointerNft({ commitment: encodeCommitment({ authorized: true, spendLimitSats: 100000 }) }),
  { txid: 'ab'.repeat(32), vout: 0, satoshis: 50000n },
]

function fixture() {
  let heightReads = 0
  const provider = {
    network: 'mainnet',
    async getBlockHeight() { heightReads++; return 800001 },
    async getUtxos() { throw new Error('Inputs must be supplied independently') },
  }
  const contract = new Contract(artifact, [pubkeyToPkHash(BACKEND_PK), reverseHex(ORIGIN_CATEGORY)], { provider })
  const recipient = new Contract(artifact, [pubkeyToPkHash(BACKEND_PK), '12'.repeat(32)], { provider }).address
  async function build(locktime) {
    // Inputs, outputs, token returns, fees and change are constructed from the
    // fixture's independent data; only the locktime is taken from the response.
    const tx = contract.functions.spend(
      utf8ToBin('938'), placeholderSignature(), BACKEND_PK, placeholderSignature(), BACKEND_PK,
    ).from(inputs).to([
      ...inputs.slice(0, 2).map(input => ({
        to: contract.tokenAddress, amount: input.satoshis, token: input.token,
      })),
      { to: recipient, amount: 2815n },
    ])
    const txHex = await buildWithServerLocktime(tx, locktime)
    const decoded = decodeServerTransaction(txHex)
    const sourceOutputs = inputs.map(input => cashScriptOutputToLibauthOutput({
      to: input.token ? contract.tokenAddress : contract.address,
      amount: input.satoshis, token: input.token,
    }))
    const preimages = inputs.map((input, inputIndex) => ({
      inputIndex,
      preimage: binToHex(createSighashPreimage(decoded, sourceOutputs, inputIndex, scriptToBytecode(contract.redeemScript), 0x41)),
    }))
    return { txHex, preimages, inputs, contract_version: 'v2' }
  }
  async function validate(server) {
    const serverTx = decodeServerTransaction(server.txHex)
    const expected = await build(serverTx.locktime)
    return verifySpendBuild({ activeVersion: 2, server, expected })
  }
  return { build, validate, provider, heightReads: () => heightReads }
}

it('validates server height 800000 with POS height 800001 without requesting height during validation', async () => {
  const f = fixture()
  assert.equal(await f.provider.getBlockHeight(), 800001)
  const server = await f.build(800000)
  assert.equal(decodeServerTransaction(server.txHex).locktime, 800000)
  assert.equal(await f.validate(server), 2)
  assert.equal(f.heightReads(), 1, 'only the explicit test probe may read height')
})

it('does not request block height even when the server locktime is zero', async () => {
  const f = fixture()
  const server = await f.build(0)
  assert.equal(await f.validate(server), 2)
  assert.equal(f.heightReads(), 0)
})

for (const mutation of ['amount', 'recipient', 'token', 'change', 'fee', 'input']) {
  it(`rejects an altered ${mutation} in the server transaction`, async () => {
    const f = fixture()
    const server = await f.build(800000)
    const decoded = decodeServerTransaction(server.txHex)
    if (mutation === 'amount') decoded.outputs[2].valueSatoshis++
    if (mutation === 'recipient') decoded.outputs[2].lockingBytecode = decoded.outputs[0].lockingBytecode.slice()
    if (mutation === 'token') decoded.outputs[0].token.nft.commitment[0] ^= 1
    if (mutation === 'change') decoded.outputs[3].lockingBytecode = decoded.outputs[2].lockingBytecode.slice()
    if (mutation === 'fee') decoded.outputs[3].valueSatoshis--
    if (mutation === 'input') decoded.inputs[2].outpointIndex++
    server.txHex = binToHex(encodeTransaction(decoded))
    await assert.rejects(f.validate(server), /txHex mismatch/)
    assert.equal(f.heightReads(), 0)
  })
}

it('rejects altered preimages even when the transaction hex matches', async () => {
  const f = fixture()
  const server = await f.build(800000)
  const bytes = hexToBin(server.preimages[0].preimage)
  bytes[0] ^= 1
  server.preimages[0].preimage = binToHex(bytes)
  await assert.rejects(f.validate(server), /Preimage validation failed/)
})

it('still rejects the wrong contract version', async () => {
  const f = fixture()
  const server = await f.build(800000)
  server.contract_version = 'v1'
  await assert.rejects(f.validate(server), /does not match/)
})

it('rejects malformed hex and malformed transaction bytes', async () => {
  const f = fixture()
  const valid = (await f.build(800000)).txHex
  for (const txHex of [undefined, null, 123, '', '0x', 'zz', '0g', 'abc', '00', valid.slice(0, -2), valid + '00']) {
    assert.throws(() => decodeServerTransaction(txHex), /Malformed server transaction/)
  }
  assert.equal(decodeServerTransaction('0x' + valid.toUpperCase()).locktime, 800000)
})

it('rejects missing or invalid locktime before CashScript can fetch a height', () => {
  const transaction = { withTime() { assert.fail('Invalid locktime must not reach the builder') } }
  for (const locktime of [undefined, null, -1, 1.5, NaN, '800000', 0x100000000]) {
    assert.throws(() => buildWithServerLocktime(transaction, locktime), /Invalid server transaction locktime/)
  }
})
