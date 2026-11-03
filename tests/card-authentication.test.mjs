import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.CARD_API_BASE_URL = 'https://card-mainnet.example/api'
const {
  normalizeCardBackendUrl,
  cardAuthStorageKey,
} = await import('../src/card/config.js')
const { createCardAuthStorage } = await import('../src/card/auth-storage.js')
const {
  isCardAuthenticationError,
  shouldReauthenticateCardRequest,
} = await import('../src/card/errors.js')

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    values,
    async get({ key }) {
      if (!values.has(key)) throw new Error('Item with given key does not exist')
      return { value: values.get(key) }
    },
    async set({ key, value }) {
      values.set(key, value)
      return { value }
    },
    async remove({ key }) {
      if (!values.has(key)) throw new Error('Item with given key does not exist')
      values.delete(key)
    },
  }
}

describe('card merchant authentication scoping', () => {
  it('uses a stable backend namespace while distinguishing environments', () => {
    assert.equal(
      normalizeCardBackendUrl('https://CARD-MAINNET.example/api/'),
      'https://card-mainnet.example/api',
    )
    assert.equal(
      cardAuthStorageKey('https://card-mainnet.example/api/'),
      cardAuthStorageKey('https://card-mainnet.example/api'),
    )
    assert.notEqual(
      cardAuthStorageKey('https://card-mainnet.example/api'),
      cardAuthStorageKey('https://card-staging.example/api'),
    )
  })

  it('does not reuse a session saved for another backend or the legacy key', async () => {
    const storage = fakeStorage({
      'card-auth-key': JSON.stringify({ token: 'legacy-session' }),
    })
    const mainnet = createCardAuthStorage(storage, 'https://card-mainnet.example/api')
    const staging = createCardAuthStorage(
      storage,
      'https://card-staging.example/api',
    )

    await mainnet.save({ token: 'mainnet-session' })
    assert.equal(await staging.getToken(), null)
    assert.notEqual(mainnet.key, 'card-auth-key')
  })

  it('only permits authentication recovery before preimage creation', () => {
    const forbidden = { response: { status: 403 } }
    assert.equal(isCardAuthenticationError(forbidden), true)
    assert.equal(shouldReauthenticateCardRequest('preimage', forbidden), true)
    assert.equal(shouldReauthenticateCardRequest('spend', forbidden), false)
    assert.equal(shouldReauthenticateCardRequest('finalization', forbidden), false)
  })
})
