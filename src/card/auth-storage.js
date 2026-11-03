import { cardAuthStorageKey } from './config.js'

export const LEGACY_CARD_AUTH_STORAGE_KEY = 'card-auth-key'

function parseStoredValue(rawValue) {
  if (rawValue == null) return null
  try {
    return JSON.parse(rawValue)
  } catch {
    return rawValue
  }
}

function isMissingStorageKeyError(error) {
  return String(error?.message || '').includes('Item with given key does not exist')
}

/**
 * Provides backend-scoped card-session storage while keeping the native
 * storage implementation injectable for tests.
 */
export function createCardAuthStorage(storage, apiBaseUrl) {
  const key = cardAuthStorageKey(apiBaseUrl)

  return {
    key,

    async getSession() {
      try {
        const result = await storage.get({ key })
        return parseStoredValue(result?.value)
      } catch (_) {
        return null
      }
    },

    async getToken() {
      const session = await this.getSession()
      if (session == null) return null
      return typeof session === 'object' ? session.token ?? null : session
    },

    async save(value) {
      const storedValue = typeof value === 'string' ? value : JSON.stringify(value)
      const result = await storage.set({ key, value: storedValue })
      return result?.value
    },

    async clear() {
      try {
        await storage.remove({ key })
      } catch (error) {
        if (!isMissingStorageKeyError(error)) throw error
      }
    },
  }
}
