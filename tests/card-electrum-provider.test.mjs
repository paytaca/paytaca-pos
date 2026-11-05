import { it } from 'node:test'
import assert from 'node:assert/strict'
import { Contract } from 'cashscript0.11.5'
import { CardElectrumProvider } from '../src/card/contract/provider.js'

function fakeElectrum() {
  return {
    connected: false,
    connections: 0,
    disconnects: 0,
    requests: [],
    height: 900000,
    async connect() {
      if (!this.connected) this.connections++
      this.connected = true
    },
    async disconnect() {
      this.disconnects++
      this.connected = false
    },
    async request(name, ...parameters) {
      assert.equal(this.connected, true)
      this.requests.push({ name, parameters })
      return { height: this.height }
    },
  }
}

it('shares warm-up with a chain read and keeps the connection open', async () => {
  const electrum = fakeElectrum()
  let resolveConnection
  electrum.connect = () => {
    electrum.connections++
    return new Promise(resolve => {
      resolveConnection = () => { electrum.connected = true; resolve() }
    })
  }
  const provider = new CardElectrumProvider(undefined, { electrum })
  const warming = provider.warmUp()
  const height = provider.getBlockHeight()
  assert.equal(electrum.connections, 1)
  resolveConnection()
  await warming
  assert.equal(await height, 900000)
  assert.equal(electrum.disconnects, 0)
})

it('reads a fresh height each time and reconnects after a dropped connection', async () => {
  const electrum = fakeElectrum()
  const provider = new CardElectrumProvider(undefined, { electrum })
  assert.equal(await provider.getBlockHeight(), 900000)
  electrum.height++
  assert.equal(await provider.getBlockHeight(), 900001)
  assert.equal(electrum.connections, 1)
  electrum.connected = false
  assert.equal(await provider.getBlockHeight(), 900001)
  assert.equal(electrum.connections, 2)
  assert.equal(electrum.requests.length, 3)
  assert.equal(electrum.disconnects, 0)
})

it('retries failed preparation and propagates a chain-read connection failure', async t => {
  t.mock.method(console, 'warn', () => {})
  const electrum = fakeElectrum()
  const connect = electrum.connect.bind(electrum)
  electrum.connect = async () => { throw new Error('offline') }
  const provider = new CardElectrumProvider(undefined, { electrum })
  await provider.warmUp()
  await assert.rejects(provider.getBlockHeight(), /offline/)
  assert.equal(electrum.requests.length, 0)
  electrum.connect = connect
  assert.equal(await provider.getBlockHeight(), 900000)
})

it('explicit independently fetched locktime builds the same transaction as the implicit lookup', async () => {
  const electrum = fakeElectrum()
  const provider = new CardElectrumProvider(undefined, { electrum })
  const artifact = {
    contractName: 'BuildTest',
    constructorInputs: [],
    abi: [{ name: 'spend', inputs: [] }],
    bytecode: 'OP_1',
    compiler: { name: 'cashc', version: '0.11.5' },
  }
  const contract = new Contract(artifact, [], { provider })
  const makeTransaction = () => contract.functions.spend()
    .from({ txid: 'ab'.repeat(32), vout: 0, satoshis: 10000n })
    .to(contract.address, 2000n)
  const implicit = await makeTransaction().build()
  const height = await provider.getBlockHeight()
  const explicit = await makeTransaction().withTime(height).build()
  assert.equal(explicit, implicit)
  assert.equal(electrum.requests.length, 2)
  assert.equal(electrum.connections, 1)
})
