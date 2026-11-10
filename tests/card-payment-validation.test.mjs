import { register } from 'node:module'
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { SignatureTemplate } from 'cashscript0.11.5'
import {
  binToHex,
  encodePrivateKeyWif,
  encodeTransaction,
} from '@bitauth/libauth'
import { encodeCommitment } from '../src/card/utils.js'
import {
  ownershipAuthToken,
  nonPointerNft,
  ORIGIN_CATEGORY,
  AUTH_CATEGORY,
  pointerUtxo,
  TARGET_CATEGORY,
} from './fixtures/card-contract-fixtures.mjs'
import { decodeServerTransaction } from '../src/card/contract/locktime.js'
import {
  resolveSupportedContract,
  selectContractRevision,
} from '../src/card/contract/revisions.js'

register('./fixtures/card-loader.mjs', import.meta.url)
const { TapToPayContract } = await import('../src/card/contract/taptopay.js')
const { payWithCard } = await import('../src/card/payment.js')
const merchantKey = new Uint8Array(32).fill(2)
const backendPk = binToHex(
  new SignatureTemplate(new Uint8Array(32).fill(1)).getPublicKey()
)
const merchantPk = binToHex(new SignatureTemplate(merchantKey).getPublicKey())
const ftCategory = '12'.repeat(32)
const wif = encodePrivateKeyWif(merchantKey, 'mainnet')
const timing = { stage: async (_, operation) => operation(), finish() {} }

function fixture({
  version = 2,
  revision = 'current',
  ftAmounts = [150n],
  ftSats = 1500n,
  bch = [50000n],
  tokenAmount = '100',
} = {}) {
  const wrapper = new TapToPayContract(
    backendPk,
    ORIGIN_CATEGORY,
    version,
    revision
  )
  const contract = wrapper.getRawContract()
  const ownership = ownershipAuthToken()
  const auth = nonPointerNft({
    commitment: encodeCommitment({ authorized: true, spendLimitSats: 100000 }),
  })
  const ft = ftAmounts.map((amount, index) => ({
    txid: String(index + 3).repeat(64),
    vout: 0,
    satoshis: ftSats,
    token: { category: ftCategory, amount },
  }))
  const bchUtxos = bch.map((satoshis, index) => ({
    txid: String(index + 5).repeat(64),
    vout: 0,
    satoshis,
  }))
  const recipient = {
    address: contract.tokenAddress,
    amount: 1000,
    ...(tokenAmount != null
      ? { token_category: ftCategory, token_amount: tokenAmount }
      : {}),
  }
  const merchant = { id: '938', pubkey: merchantPk }
  const state = {
    wif,
    spent: [],
    signed: false,
    async bch(address) {
      assert.equal(address, contract.address)
      return {
        cumulativeValue: 50000,
        utxos: bchUtxos.map((u) => ({
          tx_hash: u.txid,
          tx_pos: u.vout,
          value: u.satoshis,
        })),
      }
    },
    async tokens(path, options) {
      const address = path.split('/')[2]
      const category = path.split('/')[3]
      let utxos = []
      if (address === contract.tokenAddress) {
        if (category === ORIGIN_CATEGORY) utxos = [ownership]
        if (category === AUTH_CATEGORY) utxos = [auth]
        if (category === ftCategory) {
          assert.equal(options.params.is_cashtoken_nft, false)
          utxos = ft
        }
      }
      return {
        data: {
          utxos: utxos.map((u) => ({
            txid: u.txid,
            vout: u.vout,
            value: String(u.satoshis),
            tokenid: u.token.category,
            amount: String(u.token.amount),
            capability: u.token.nft?.capability,
            commitment: u.token.nft?.commitment,
          })),
        },
      }
    },
    async post(path, payload) {
      if (path === '/cards/preimage/') return { data: state.server }
      state.spent.push(payload)
      return { data: { success: true, txid: 'dummy-not-broadcast' } }
    },
  }
  globalThis.cardTest = state
  const pay = () =>
    payWithCard({
      uid: 'dummy',
      merchantId: merchant.id,
      receivingAddress: recipient.address,
      amountSats: recipient.amount,
      url: 'https://card.example/?e=dummy&c=dummy',
      contractParameters: { backendPk, category: ORIGIN_CATEGORY, version },
      ...(tokenAmount != null
        ? { tokenCategory: ftCategory, tokenAmount }
        : {}),
      timing,
    })
  const prepare = async () => {
    const expected = await wrapper.generateSpendPreimages({
      merchant,
      recipient,
      locktime: 800000,
    })
    state.server = {
      ...expected,
      tx_id: 'dummy-record',
      contract_version: `v${version}`,
      contract_address: contract.address,
    }
    return expected
  }
  return {
    wrapper,
    contract,
    ownership,
    auth,
    ft,
    bchUtxos,
    recipient,
    merchant,
    state,
    prepare,
    pay,
  }
}

for (const [version, revision] of [
  [1, 'current'],
  [1, 'pre-mutate-v1'],
  [2, 'current'],
]) {
  it(`BCH v${version}/${revision}: real payment flow resolves, validates, signs and submits only mocked spend`, async () => {
    const f = fixture({ version, revision, tokenAmount: null })
    await f.prepare()
    assert.equal((await f.pay()).success, true)
    assert.equal(f.state.spent.length, 1)
    assert.equal(f.state.spent[0].signatures.length, 3)
  })
}

for (const options of [
  { ftAmounts: [100n], ftSats: 12000n, bch: [] },
  { ftAmounts: [150n], ftSats: 12000n, bch: [] },
  { ftAmounts: [40n, 60n], ftSats: 1000n, bch: [2000n, 15000n, 50000n] },
  { ftAmounts: [150n], ftSats: 1500n, bch: [50000n] },
]) {
  it(`FT independently rebuilds and signs ${JSON.stringify(
    options,
    (_, value) => (typeof value === 'bigint' ? String(value) : value)
  )}`, async () => {
    const f = fixture(options)
    await f.prepare()
    assert.equal((await f.pay()).success, true)
    assert.equal(f.state.spent.length, 1)
    assert.equal(
      f.state.spent[0].signatures.length,
      f.state.server.inputs.length
    )
  })
}

for (const mutation of [
  'amount',
  'recipient',
  'category',
  'ft-change',
  'bch-change',
  'input',
  'preimage',
  'address',
  'missing-address',
  'version',
]) {
  it(`FT refuses ${mutation} tampering before any signing or spend`, async () => {
    const f = fixture()
    await f.prepare()
    const server = f.state.server
    const tx = decodeServerTransaction(server.txHex)
    if (mutation === 'amount') tx.outputs[2].token.amount++
    if (mutation === 'recipient')
      tx.outputs[2].lockingBytecode = new Uint8Array([0x51])
    if (mutation === 'category') tx.outputs[2].token.category[0] ^= 1
    if (mutation === 'ft-change')
      tx.outputs.find((o, i) => i > 2 && o.token).token.amount++
    if (mutation === 'bch-change') tx.outputs.at(-1).valueSatoshis--
    if (mutation === 'input') tx.inputs[2].outpointIndex++
    if (mutation === 'preimage') server.preimages[0].preimage = '00'
    if (mutation === 'address')
      server.contract_address = new TapToPayContract(
        backendPk,
        'aa'.repeat(32),
        2
      ).getRawContract().address
    if (mutation === 'missing-address') delete server.contract_address
    if (mutation === 'version') server.contract_version = 'v1'
    server.txHex = binToHex(encodeTransaction(tx))
    // Validation needs the merchant public key, but must never reach signing.
    let signingStages = 0
    const stage = timing.stage
    timing.stage = async (name, operation) => {
      if (name === 'signing') signingStages++
      return stage(name, operation)
    }
    try {
      await assert.rejects(f.pay())
    } finally {
      timing.stage = stage
    }
    assert.equal(signingStages, 0)
    assert.equal(f.state.spent.length, 0)
  })
}

it('rejects unsupported addresses and never interprets V2 as an older V1 artifact', () => {
  const old = new TapToPayContract(
    backendPk,
    ORIGIN_CATEGORY,
    1,
    'pre-mutate-v1'
  ).getRawContract()
  assert.equal(
    selectContractRevision({
      version: 1,
      address: old.address,
      deriveAddress: (revision) =>
        new TapToPayContract(
          backendPk,
          ORIGIN_CATEGORY,
          1,
          revision
        ).getRawContract().address,
    }),
    'pre-mutate-v1'
  )
  assert.throws(
    () =>
      selectContractRevision({
        version: 2,
        address: old.address,
        deriveAddress: () =>
          new TapToPayContract(backendPk, ORIGIN_CATEGORY, 2).getRawContract()
            .address,
      }),
    /supported script/
  )
  assert.throws(
    () => new TapToPayContract(backendPk, ORIGIN_CATEGORY, 2, 'pre-mutate-v1'),
    /Unsupported/
  )
})

it('rejects a supported V1 address when it contradicts independent ownership discovery', async () => {
  const f = fixture({ version: 1, tokenAmount: null })
  await f.prepare()
  f.state.server.contract_address = new TapToPayContract(
    backendPk,
    ORIGIN_CATEGORY,
    1,
    'pre-mutate-v1'
  ).getRawContract().address
  await assert.rejects(f.pay(), /disagrees with on-chain script resolution/)
  assert.equal(f.state.spent.length, 0)
})

it('resolves a historical V1 origin pointer to current V2 without trusting a server address', async () => {
  const f = fixture({
    version: 1,
    revision: 'pre-mutate-v1',
    tokenAmount: null,
  })
  const resolution = await resolveSupportedContract({
    backendPk,
    category: ORIGIN_CATEGORY,
    originVersion: 1,
    deriveTokenAddress: ({ category, version, revision }) =>
      new TapToPayContract(
        backendPk,
        category,
        version,
        revision
      ).getTokenAddress(),
    fetchTokenUtxos: async (category, address) =>
      address !== f.contract.tokenAddress
        ? []
        : category === ORIGIN_CATEGORY
        ? [f.ownership]
        : [pointerUtxo()],
  })
  assert.equal(resolution.originRevision, 'pre-mutate-v1')
  assert.equal(resolution.activeVersion, 2)
  assert.equal(resolution.activeRevision, 'current')
  assert.equal(resolution.activeCategory, TARGET_CATEGORY)
})

it('rejects ambiguous origins and propagates candidate chain-read failures', async () => {
  const params = {
    backendPk,
    category: ORIGIN_CATEGORY,
    originVersion: 1,
    deriveTokenAddress: ({ revision }) => revision,
    fetchTokenUtxos: async () => [ownershipAuthToken()],
  }
  await assert.rejects(resolveSupportedContract(params), /one supported origin/)
  await assert.rejects(
    resolveSupportedContract({
      ...params,
      fetchTokenUtxos: async () => {
        throw new Error('offline')
      },
    }),
    /offline/
  )
})

it('V1 FT, missing token fields, insufficient balances and disabled authorization fail closed', async () => {
  await assert.rejects(fixture({ version: 1 }).prepare(), /require a V2/)
  await assert.rejects(
    fixture({ ftAmounts: [1n] }).prepare(),
    /Insufficient fungible/
  )
  await assert.rejects(
    fixture({ ftSats: 1000n, bch: [] }).prepare(),
    /Insufficient BCH/
  )
  const f = fixture()
  f.auth.token.nft.commitment = encodeCommitment({
    authorized: false,
    spendLimitSats: 100000,
  })
  await assert.rejects(f.prepare(), /No valid authentication/)
})

it('preserves the historical global authorization ceiling while current V1 uses its encoded limit', async () => {
  for (const revision of ['pre-mutate-v1', 'current']) {
    const f = fixture({
      version: 1,
      revision,
      tokenAmount: null,
      bch: [300000n],
    })
    f.recipient.amount = 100001
    f.auth.token.nft.commitment = encodeCommitment({
      authorized: true,
      spendLimitSats: 200000,
    })
    if (revision === 'pre-mutate-v1')
      await assert.rejects(f.prepare(), /authorization limit/)
    else await f.prepare()
  }
})

it('never consumes an immutable NFT as a fungible funding input', async () => {
  const f = fixture()
  f.ft[0].token.nft = { capability: 'none', commitment: '' }
  await assert.rejects(f.prepare(), /Insufficient fungible/)
})

it('rejects partial token fields and invalid token quantities', async () => {
  for (const tokenAmount of ['0', '-1', '1.5', 'NaN']) {
    await assert.rejects(fixture({ tokenAmount }).prepare(), /Invalid fungible/)
  }
  const f = fixture()
  delete f.recipient.token_amount
  await assert.rejects(f.prepare(), /Both token category and amount/)
})

it('rejects malformed independent UTXO responses instead of treating them as empty', async () => {
  const f = fixture()
  f.state.tokens = async () => ({ data: {} })
  await assert.rejects(f.pay(), /Malformed token UTXO response/)
  assert.equal(f.state.spent.length, 0)
})
