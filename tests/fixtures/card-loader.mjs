import { readFile } from 'node:fs/promises'

// Test-only loader: run the actual payment orchestrator/class without native
// storage, live HTTP, Electrum or WebSocket access. Never load app configuration.
const sourceRoot = new URL('../../src/', import.meta.url)
const stub = (code) => ({
  url: `data:text/javascript,${encodeURIComponent(code)}`,
  shortCircuit: true,
})
export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL || ''
  if (parent.endsWith('/src/card/payment.js')) {
    if (specifier === './user')
      return stub(
        `export const getPrivateKeyWif = async () => globalThis.cardTest.wif; export const reauthenticateCardMerchant = async () => {};`
      )
    if (specifier === './backend')
      return stub(
        `export const backend = {get: async () => ({data: {active: false}}), post: async (path, payload) => globalThis.cardTest.post(path, payload)};`
      )
    if (specifier === './socket')
      return stub(
        `export const cardSocket = {isReady: false, ensureConnected: async () => false}; export const delay = async () => {};`
      )
  }
  if (specifier === 'watchtower-cash-js0.3.1')
    return stub(
      `export default class { constructor() { this.BCH = { getBchUtxos: (...args) => globalThis.cardTest.bch(...args), _api: { get: (...args) => globalThis.cardTest.tokens(...args) } }; } }`
    )
  if (
    parent.endsWith('/src/card/contract/taptopay.js') &&
    specifier === './provider.js'
  ) {
    return stub(
      `export const cardElectrumProvider = {network: 'mainnet', getBlockHeight() { throw new Error('Unexpected live height lookup'); }};`
    )
  }
  if (specifier.startsWith('src/card/'))
    return {
      url: new URL(specifier.slice(4), sourceRoot).href,
      shortCircuit: true,
    }
  if (
    specifier.startsWith('.') &&
    parent.includes('/src/card/') &&
    !/\.[a-z0-9]+$/i.test(specifier)
  ) {
    return { url: new URL(specifier + '.js', parent).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(sourceRoot.href) && url.endsWith('.json')) {
    return {
      format: 'module',
      source: `export default ${await readFile(new URL(url), 'utf8')}`,
      shortCircuit: true,
    }
  }
  return nextLoad(url, context)
}
