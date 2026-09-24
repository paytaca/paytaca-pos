export const NFC_MAINTENANCE_STATUS_PATH = '/status/'
export const NFC_MAINTENANCE_WS_CODE = -32003
export const NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC = 120
export const NFC_MAINTENANCE_FETCH_TIMEOUT_MS = 8000

export class NfcMaintenanceError extends Error {
  constructor({ message, eta, retryAfterSec } = {}) {
    super(message || 'Card payments are temporarily unavailable due to maintenance.')
    this.name = 'NfcMaintenanceError'
    this.isNfcMaintenance = true
    this.maintenance = true
    if (eta !== undefined) this.eta = eta
    this.retryAfterSec = Number.isFinite(Number(retryAfterSec))
      ? Number(retryAfterSec)
      : NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC
  }
}

let cachedState = {
  active: false,
  message: '',
  eta: '',
  minAppVersion: '',
  retryAfterSec: NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC,
  checkedAt: 0,
  updateRequired: false,
}

export function getNfcMaintenanceState() {
  return { ...cachedState }
}

export function setNfcMaintenanceState(partial = {}) {
  cachedState = { ...cachedState, ...partial }
  return getNfcMaintenanceState()
}

export function clearNfcMaintenanceState() {
  cachedState = {
    active: false,
    message: '',
    eta: '',
    minAppVersion: '',
    retryAfterSec: NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC,
    checkedAt: 0,
    updateRequired: false,
  }
  return getNfcMaintenanceState()
}

export function parseRetryAfterSeconds(value) {
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function compareAppVersions(a, b) {
  const pa = String(a || '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = String(b || '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

export function isUpdateRequired(minAppVersion, appVersion) {
  if (!minAppVersion || !appVersion) return false
  return compareAppVersions(minAppVersion, appVersion) > 0
}

export function normalizeStatusPayload(data = {}) {
  return {
    active: data?.maintenance === true,
    message: data?.message || '',
    eta: data?.eta || '',
    minAppVersion: data?.min_app_version || data?.minAppVersion || '',
  }
}

export function isNfcMaintenanceError(error) {
  if (!error) return false
  if (error.isNfcMaintenance === true || error.maintenance === true) {
    if (error.name === 'NfcMaintenanceError') return true
  }
  if (error.code === NFC_MAINTENANCE_WS_CODE || error?.data?.code === NFC_MAINTENANCE_WS_CODE) return true
  const status = error.status ?? error.response?.status
  const serverCode = error.response?.data?.error ?? error.data?.error
  if (status === 503 && serverCode === 'MAINTENANCE') return true
  const message = String(error.message || error.msg || '')
  if (/^MAINTENANCE\b/.test(message.trim())) return true
  return false
}

export function toNfcMaintenanceError(rawError, fallback = {}) {
  if (rawError instanceof NfcMaintenanceError) return rawError
  const responseData = rawError?.response?.data || rawError?.data || {}
  const message = responseData.message || rawError?.message || fallback.message || 'Card payments are temporarily unavailable due to maintenance.'
  const eta = responseData.eta ?? fallback.eta ?? ''
  const retryAfterSec = parseRetryAfterSeconds(
    rawError?.response?.headers?.['retry-after'] ??
    rawError?.response?.headers?.['Retry-After'] ??
    fallback.retryAfterSec
  ) ?? NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC
  const err = new NfcMaintenanceError({ message, eta, retryAfterSec })
  if (rawError?.code !== undefined) err.code = rawError.code
  if (rawError?.response?.status !== undefined) err.status = rawError.response.status
  return err
}

export function nfcStageRequiresMaintenanceCheck(stage) {
  return stage === 'enter-tap' || stage === 'preimage'
}

export function shouldBlockQrForCardMaintenance() {
  return false
}

export function shouldBlockNfcTap(state = getNfcMaintenanceState(), appVersion) {
  if (!state?.active) {
    if (isUpdateRequired(state?.minAppVersion, appVersion)) {
      return { blocked: true, reason: 'update' }
    }
    return { blocked: false, reason: 'none' }
  }
  return { blocked: true, reason: 'maintenance' }
}

export function getNfcRetryDelayMs(state = getNfcMaintenanceState()) {
  const secs = Number.isFinite(Number(state?.retryAfterSec))
    ? Number(state.retryAfterSec)
    : NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC
  return secs * 1000
}

export function canRetryNfc(state = getNfcMaintenanceState(), nowMs = Date.now()) {
  if (!state?.active) return true
  if (!state?.blockedAt) return true
  return nowMs - state.blockedAt >= getNfcRetryDelayMs(state)
}

export async function fetchNfcMaintenanceStatus(fetcher, appVersion) {
  try {
    const response = await fetcher(NFC_MAINTENANCE_STATUS_PATH, {
      authorize: false,
      timeout: NFC_MAINTENANCE_FETCH_TIMEOUT_MS,
    })
    const payload = normalizeStatusPayload(response?.data ?? response)
    const retryAfterSec = parseRetryAfterSeconds(
      response?.headers?.['retry-after'] ?? response?.headers?.['Retry-After']
    ) ?? NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC
    const updateRequired = isUpdateRequired(payload.minAppVersion, appVersion)
    cachedState = {
      active: payload.active,
      message: payload.message,
      eta: payload.eta,
      minAppVersion: payload.minAppVersion,
      retryAfterSec,
      checkedAt: Date.now(),
      updateRequired,
      blockedAt: payload.active ? Date.now() : 0,
    }
    return { ...cachedState, fetchFailed: false }
  } catch (error) {
    return { ...cachedState, active: false, fetchFailed: true }
  }
}

export function applyNfcMaintenanceErrorToCache(error) {
  const maintenanceError = toNfcMaintenanceError(error, getNfcMaintenanceState())
  cachedState = {
    ...cachedState,
    active: true,
    message: maintenanceError.message,
    eta: maintenanceError.eta || cachedState.eta,
    retryAfterSec: maintenanceError.retryAfterSec,
    checkedAt: Date.now(),
    blockedAt: Date.now(),
  }
  return maintenanceError
}
