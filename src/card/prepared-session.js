// Keep preparation short-lived and scoped to the active wallet. Never retain a
// failed lookup: tapping after a warm-up failure must retry the normal flow.
export function createPreparedCardSession(load, { maxAgeMs = 30000 } = {}) {
  let prepared = null

  function get(walletHash) {
    if (prepared?.walletHash === walletHash && Date.now() - prepared.startedAt < maxAgeMs) {
      return prepared.promise
    }
    const entry = { walletHash, startedAt: Date.now(), promise: null }
    entry.promise = Promise.resolve().then(load).catch(error => {
      if (prepared === entry) prepared = null
      throw error
    })
    prepared = entry
    return entry.promise
  }

  return {
    get,
    warmUp(walletHash) { get(walletHash).catch(() => {}) },
    clear() { prepared = null },
  }
}
