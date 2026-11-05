import { it } from 'node:test'
import assert from 'node:assert/strict'
import { createPreparedCardSession } from '../src/card/prepared-session.js'

it('shares an in-flight preparation with a tap instead of loading twice', async () => {
  let calls = 0
  let resolve
  const pending = new Promise(done => { resolve = done })
  const session = createPreparedCardSession(() => { calls++; return pending })
  session.warmUp('wallet-a')
  const tap = session.get('wallet-a')
  await Promise.resolve()
  assert.equal(calls, 1)
  const merchant = { id: 938 }
  resolve(merchant)
  assert.equal(await tap, merchant)
  assert.equal(await session.get('wallet-a'), merchant)
  assert.equal(calls, 1)
})

it('reloads when the wallet changes, preparation expires, or scanning stops', async t => {
  let now = 1000
  t.mock.method(Date, 'now', () => now)
  let calls = 0
  const session = createPreparedCardSession(async () => ++calls)
  assert.equal(await session.get('wallet-a'), 1)
  assert.equal(await session.get('wallet-b'), 2)
  now += 30000
  assert.equal(await session.get('wallet-b'), 3)
  session.clear()
  assert.equal(await session.get('wallet-b'), 4)
})

it('retries a failed warm-up when the card is tapped', async () => {
  let calls = 0
  const session = createPreparedCardSession(async () => {
    if (++calls === 1) throw new Error('offline')
    return { id: 938 }
  })
  session.warmUp('wallet-a')
  await assert.rejects(session.get('wallet-a'), /offline/)
  assert.deepEqual(await session.get('wallet-a'), { id: 938 })
  assert.equal(calls, 2)
})

it('an older failed lookup cannot discard a newer wallet preparation', async () => {
  let reject
  const old = new Promise((resolve, fail) => { reject = fail })
  let calls = 0
  const session = createPreparedCardSession(() => ++calls === 1 ? old : { id: 938 })
  const first = session.get('wallet-a')
  await Promise.resolve()
  await session.get('wallet-b')
  reject(new Error('offline'))
  await assert.rejects(first, /offline/)
  assert.deepEqual(await session.get('wallet-b'), { id: 938 })
  assert.equal(calls, 2)
})
