import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  NfcMaintenanceError,
  isNfcMaintenanceError,
  toNfcMaintenanceError,
  fetchNfcMaintenanceStatus,
  getNfcMaintenanceState,
  clearNfcMaintenanceState,
  shouldBlockNfcTap,
  shouldBlockQrForCardMaintenance,
  nfcStageRequiresMaintenanceCheck,
  parseRetryAfterSeconds,
  isUpdateRequired,
  getNfcRetryDelayMs,
  canRetryNfc,
  applyNfcMaintenanceErrorToCache,
  NFC_MAINTENANCE_WS_CODE,
  NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC,
} from '../src/card/maintenance.js'

const maintenanceOn = {
  active: true,
  message: 'Card server upgrading, back soon',
  eta: '10 min',
  retryAfterSec: 120,
  blockedAt: Date.now(),
}

describe('NFC maintenance mode (card-server contract)', () => {
  it('(1) QR checkout keeps working with maintenance ON', async () => {
    assert.equal(shouldBlockQrForCardMaintenance(maintenanceOn), false)
    assert.equal(shouldBlockQrForCardMaintenance({ active: true }), false)
    clearNfcMaintenanceState()
    const failingFetcher = async () => { throw new Error('status endpoint down') }
    const state = await fetchNfcMaintenanceStatus(failingFetcher, '0.6.0')
    assert.equal(state.active, false)
    assert.equal(state.fetchFailed, true)
    assert.equal(shouldBlockQrForCardMaintenance(state), false)
  })

  it('(2) NFC tap is gated with server message + ETA', () => {
    const { blocked, reason } = shouldBlockNfcTap(maintenanceOn, '0.6.0')
    assert.equal(blocked, true)
    assert.equal(reason, 'maintenance')
    assert.equal(shouldBlockNfcTap({ active: false }, '0.6.0').blocked, false)

    const restError = new Error('Request failed with status code 503')
    restError.response = {
      status: 503,
      data: { error: 'MAINTENANCE', message: 'Card server upgrading, back soon', eta: '10 min' },
      headers: { 'retry-after': '120' },
    }
    assert.equal(isNfcMaintenanceError(restError), true)
    const mapped = toNfcMaintenanceError(restError, {})
    assert.ok(mapped instanceof NfcMaintenanceError)
    assert.equal(mapped.message, 'Card server upgrading, back soon')
    assert.equal(mapped.eta, '10 min')
    assert.equal(mapped.retryAfterSec, 120)

    const wsError = new Error('maintenance')
    wsError.code = NFC_MAINTENANCE_WS_CODE
    assert.equal(isNfcMaintenanceError(wsError), true)

    assert.equal(isNfcMaintenanceError(new Error('already being finalized by another request')), false)
    assert.equal(isNfcMaintenanceError(new Error('transaction not found or expired')), false)
  })

  it('(3) in-flight NFC spend completes when maintenance flips ON mid-tap', () => {
    assert.equal(nfcStageRequiresMaintenanceCheck('enter-tap'), true)
    assert.equal(nfcStageRequiresMaintenanceCheck('preimage'), true)
    assert.equal(nfcStageRequiresMaintenanceCheck('spend'), false)
    assert.equal(nfcStageRequiresMaintenanceCheck('broadcast'), false)

    clearNfcMaintenanceState()
    const wsMaintenance = new Error('maintenance')
    wsMaintenance.code = -32003
    const noticed = applyNfcMaintenanceErrorToCache(wsMaintenance)
    assert.ok(noticed instanceof NfcMaintenanceError)
    assert.equal(getNfcMaintenanceState().active, true)
    assert.equal(nfcStageRequiresMaintenanceCheck('spend'), false)
  })

  it('honors Retry-After and flags update-required in NFC pane only', () => {
    assert.equal(parseRetryAfterSeconds('120'), 120)
    assert.equal(parseRetryAfterSeconds('abc'), null)
    assert.equal(getNfcRetryDelayMs({ retryAfterSec: 120 }), 120000)
    assert.equal(getNfcRetryDelayMs({}), NFC_MAINTENANCE_DEFAULT_RETRY_AFTER_SEC * 1000)

    const blocked = { active: true, retryAfterSec: 120, blockedAt: Date.now() }
    assert.equal(canRetryNfc(blocked, blocked.blockedAt + 1000), false)
    assert.equal(canRetryNfc(blocked, blocked.blockedAt + 121000), true)
    assert.equal(canRetryNfc({ active: false }), true)

    assert.equal(isUpdateRequired('0.7.0', '0.6.0'), true)
    assert.equal(isUpdateRequired('0.6.0', '0.6.0'), false)
    assert.equal(shouldBlockNfcTap({ active: false, minAppVersion: '0.7.0' }, '0.6.0').reason, 'update')
  })
})
