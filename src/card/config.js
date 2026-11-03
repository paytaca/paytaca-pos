const DEV_FALLBACK_API_BASE_URL = 'http://localhost:8002/api'

export const CARD_API_BASE_URL = process.env.CARD_API_BASE_URL || (
  process.env.NODE_ENV === 'development' ? DEV_FALLBACK_API_BASE_URL : ''
)

export const CARD_SOCKET_PATH = process.env.CARD_SOCKET_PATH || '/ws/cards/'

if (!CARD_API_BASE_URL) {
  throw new Error('CARD_API_BASE_URL is required outside development builds')
}

/**
 * Returns the canonical value used to scope card credentials.
 * The API path is intentionally retained because two card backends may share
 * a host while serving different environments under different paths.
 */
export function normalizeCardBackendUrl(value = CARD_API_BASE_URL) {
  const parsed = new URL(value)
  const pathname = parsed.pathname.replace(/\/+$/, '')
  return `${parsed.protocol}//${parsed.host}${pathname}`
}

// Storage keys must be short and contain no URL punctuation. This is a
// namespace identifier, not a security hash; the token itself is never part
// of the key or any diagnostic output.
function hashBackendScope(value) {
  let first = 0x811c9dc5
  let second = 0x01000193
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ (code + index), 0x811c9dc5)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

export function cardAuthStorageKey(apiBaseUrl = CARD_API_BASE_URL) {
  return `card-auth-key-${hashBackendScope(normalizeCardBackendUrl(apiBaseUrl))}`
}
