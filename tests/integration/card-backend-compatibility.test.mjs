import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { Contract as StoredContract } from '../../../nfc-card/nfc-card-server/contract-api/node_modules/@mainnet-cash/contract/dist/module/index.js'
import {
  Contract,
  SignatureTemplate,
} from '../../node_modules/cashscript0.11.5/dist/index.js'
import {
  binToHex,
  encodePrivateKeyWif,
  decodeTransaction,
  hexToBin,
} from '../../node_modules/@bitauth/libauth/build/index.js'
import { buildSpendPreimages } from '../../src/card/contract/spend.js'
import {
  signPreimages,
  pubkeyToPkHash,
  reverseHex,
  encodeCommitment,
} from '../../src/card/utils.js'
import { cashScriptOutputToLibauthOutput } from '../../node_modules/cashscript/dist/utils.js'
const state = vi.hoisted(() => ({
  records: new Map(),
  bch: [],
  ownership: [],
  auth: [],
  ft: [],
}))
vi.mock(
  '../../../nfc-card/nfc-card-server/contract-api/src/main/utils/local_utxo_client.js',
  () => ({
    getBchUtxos: async () => ({ utxos: state.bch }),
    getTokenUtxos: async (category) =>
      category === 'cd'.repeat(32)
        ? state.ownership
        : category === 'ef'.repeat(32)
        ? state.auth
        : state.ft,
    getAllTokenUtxos: async () => [],
    getFungibleTokenBalances: async () => [],
    reportOptimisticWrite: async () => {},
  })
)
vi.mock(
  '../../../nfc-card/nfc-card-server/contract-api/src/main/utils/payment_provider.js',
  () => ({ getFreshPaymentBlockHeight: async () => 800000 })
)
vi.mock(
  '../../../nfc-card/nfc-card-server/contract-api/src/main/utils/redis.js',
  () => ({
    MAX_PICK_RETRIES: 4,
    newTransactionId: () => 'test',
    saveTransaction: async (id, record) => state.records.set(id, record),
    getTransaction: async (id) => state.records.get(id),
    transitionTransaction: async () => 1,
    acquireReservations: async () => true,
    releaseReservations: async () => {},
    filterReleasedUtxos: async (utxos) => utxos,
    reservationKeyForUtxo: (u) => `${u.txid}:${u.vout}`,
    normalizeUtxoForStorage: (u) => u,
    normalizeUtxoForUse: (u) => u,
  })
)
const { TapToPayV1, TapToPayV2 } = await import(
  '../../../nfc-card/nfc-card-server/contract-api/src/main/tap-to-pay.js'
)
const root = new URL('../../', import.meta.url).pathname
const backendKey = new Uint8Array(32).fill(1),
  merchantKey = new Uint8Array(32).fill(2)
const backendPk = binToHex(new SignatureTemplate(backendKey).getPublicKey()),
  merchantPk = binToHex(new SignatureTemplate(merchantKey).getPublicKey())
const params = [pubkeyToPkHash(backendPk), reverseHex('cd'.repeat(32))]
const provider = {
  network: 'mainnet',
  getBlockHeight() {
    throw Error('unexpected height')
  },
}
const requireSdk = createRequire(
  root + 'node_modules/cashscript0.11.5/dist/index.js'
)
const { createVirtualMachineBch2025 } = await import(
  requireSdk.resolve('@bitauth/libauth')
)
for (const [version, revision, ftAmount, ftSats, bchSats] of [
  [1, 'current', null, 0n, 50000n],
  [1, 'pre-mutate-v1', null, 0n, 50000n],
  [2, 'current', null, 0n, 50000n],
  [2, 'current', 100n, 12000n, 0n],
  [2, 'current', 150n, 12000n, 0n],
  [2, 'current', 100n, 1000n, 50000n],
  [2, 'current', 150n, 1500n, 50000n],
]) {
  it(`backend/POS bytes, signatures and finalization agree: v${version}/${revision}, FT=${ftAmount}/${ftSats}, BCH=${bchSats}`, async () => {
    const artifact = JSON.parse(
      await readFile(
        root +
          `src/card/contract/tap-to-pay-v${version}${
            revision === 'pre-mutate-v1' ? '-pre-mutate' : ''
          }.artifact.json`,
        'utf8'
      )
    )
    const contract = new Contract(artifact, params, { provider })
    const Cls = version === 1 ? TapToPayV1 : TapToPayV2
    const payment = Cls.fromId(
      new StoredContract(artifact.source, params, 'mainnet', 1).toString()
    )
    const nft = (txid, category, commitment) => ({
      txid: txid.repeat(64),
      vout: 0,
      satoshis: 1000n,
      token: {
        category,
        amount: 0n,
        nft: { capability: 'mutable', commitment },
      },
    })
    state.ownership = [
      nft('c', 'cd'.repeat(32), '01' + reverseHex('ef'.repeat(32))),
    ]
    state.auth = [
      nft(
        'b',
        'ef'.repeat(32),
        encodeCommitment({ authorized: true, spendLimitSats: 100000 })
      ),
    ]
    state.ft =
      ftAmount == null
        ? []
        : [
            {
              txid: '3'.repeat(64),
              vout: 0,
              satoshis: ftSats,
              token: { category: '12'.repeat(32), amount: ftAmount },
            },
          ]
    state.bch =
      bchSats === 0n
        ? []
        : [{ txid: '5'.repeat(64), vout: 0, satoshis: bchSats }]
    const recipient = {
      address: contract.tokenAddress,
      amount: 1000n,
      ...(ftAmount == null
        ? {}
        : { token_category: '12'.repeat(32), token_amount: 100n }),
    }
    const merchant = { id: '938', pubkey: merchantPk }
    const server = await payment.generateSpendPreimages({
      backendWif: encodePrivateKeyWif(backendKey, 'mainnet'),
      merchant,
      recipient: { ...recipient },
    })
    const local = await buildSpendPreimages({
      contract,
      version,
      revision,
      backendPk,
      merchant,
      recipient,
      bchUtxos: state.bch,
      authOwnershipToken: state.ownership[0],
      authCategory: 'ef'.repeat(32),
      authTokenUtxos: state.auth,
      ftUtxos: state.ft,
      locktime: 800000,
    })
    expect(server.contract_address).toBe(contract.address)
    expect(server.txHex).toBe(local.txHex)
    expect(server.preimages).toEqual(local.preimages)
    const signatures = await signPreimages({
      preimages: local.preimages,
      wif: encodePrivateKeyWif(merchantKey, 'mainnet'),
    })
    if (revision === 'pre-mutate-v1') {
      const current = new TapToPayV1({
        params: { backendPkh: params[0], category: params[1] },
      })
      await expect(
        current.finalizeSpend({
          backendWif: encodePrivateKeyWif(backendKey, 'mainnet'),
          txId: server.txId,
          signatures,
          expectedMerchant: merchant,
          broadcast: false,
        })
      ).rejects.toThrow('Transaction does not belong to this contract')
    }
    const final = await payment.finalizeSpend({
      backendWif: encodePrivateKeyWif(backendKey, 'mainnet'),
      txId: server.txId,
      signatures,
      expectedMerchant: merchant,
      broadcast: false,
    })
    const transaction = decodeTransaction(hexToBin(final))
    const sourceOutputs = local.inputs.map((u) =>
      cashScriptOutputToLibauthOutput({
        to: u.token ? contract.tokenAddress : contract.address,
        amount: u.satoshis,
        token: u.token,
      })
    )
    const vm = createVirtualMachineBch2025()
    for (let inputIndex = 0; inputIndex < local.inputs.length; inputIndex++)
      expect(
        vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs, inputIndex }))
      ).toBe(true)
  })
}
