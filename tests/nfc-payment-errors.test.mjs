import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractServerMessage,
  serverError,
  errorTexts,
} from '../src/card/errors.js'

describe('card-server error message plumbing', () => {
  it('prefers the human message over the error code', () => {
    assert.equal(
      extractServerMessage({ error: 'INSUFFICIENT_BALANCE', message: 'Insufficient card balance' }, 'fallback'),
      'Insufficient card balance'
    )
    assert.equal(extractServerMessage({ error: 'Something broke' }, 'fallback'), 'Something broke')
    assert.equal(extractServerMessage('plain text', 'fallback'), 'plain text')
    assert.equal(extractServerMessage(undefined, 'fallback'), 'fallback')
    assert.equal(extractServerMessage({ error: '   ' }, 'fallback'), 'fallback')
  })

  it('carries the display message and raw code on the thrown error', () => {
    const err = serverError(
      { error: 'INSUFFICIENT_BALANCE', message: 'Insufficient card balance' },
      'Failed to get preimages'
    )
    assert.equal(err.message, 'Insufficient card balance')
    assert.equal(err.serverCode, 'INSUFFICIENT_BALANCE')
    assert.equal(err.data.error, 'INSUFFICIENT_BALANCE')
  })

  it('keeps retryable/expired classification text intact', () => {
    const conflict = serverError(
      { error: 'already being finalized by another request', message: 'Please retry' },
      'fallback'
    )
    assert.match(errorTexts(conflict), /already being finalized by another request/)

    const expired = serverError({ error: 'transaction not found or expired' }, 'fallback')
    assert.match(errorTexts(expired), /transaction not found or expired/)
  })

  it('still recognizes a maintenance payload (code + message)', () => {
    const maintenance = serverError(
      { error: 'MAINTENANCE', message: 'Card server upgrading', eta: '10 min' },
      'fallback'
    )
    assert.equal(maintenance.message, 'Card server upgrading')
    assert.equal(maintenance.data.error, 'MAINTENANCE')
    assert.equal(maintenance.data.eta, '10 min')
  })
})
