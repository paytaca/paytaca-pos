/**
 * Card-server error plumbing.
 *
 * The server may respond with `{ error, message }` where `message` is the
 * human-readable text and `error` is a code (as with `{ error: "MAINTENANCE" }`),
 * or with just `{ error }`, or with a plain string. These helpers keep the
 * human message for display while preserving the raw payload for classification
 * (maintenance, retryable conflict, expired record).
 */

/**
 * Extracts the most human-readable message from a card-server payload.
 * Prefers `message`, then `error`, then the supplied fallback.
 */
export function extractServerMessage(data, fallback) {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim()
  }
  return fallback
}

/**
 * Builds an Error carrying the server payload so downstream classifiers can
 * inspect both the human message (`error.message`) and the raw code
 * (`error.serverCode`, `error.data.error`).
 */
export function serverError(data, fallback) {
  const error = new Error(extractServerMessage(data, fallback))
  if (data && typeof data === 'object') {
    error.data = data
    error.serverCode = data.error
  }
  return error
}

/** Combined lowercase text of an error for substring classification. */
export function errorTexts(error) {
  return [
    error?.message,
    error?.serverCode,
    error?.data?.error,
    error?.data?.message,
  ].filter((part) => typeof part === 'string').join(' ').toLowerCase()
}
