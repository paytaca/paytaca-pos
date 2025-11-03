export async function postOutputFiatAmounts({ txid, outputFiatAmounts, endpoint = 'https://watchtower.cash/api/broadcast/output-fiat-amounts/', retries = 1 }) {
  if (!txid || !outputFiatAmounts || typeof outputFiatAmounts !== 'object') {
    return Promise.reject(new Error('Invalid arguments'))
  }

  const body = { txid, output_fiat_amounts: outputFiatAmounts }

  async function attempt() {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json().catch(() => ({}))
  }

  try {
    return await attempt()
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000))
      return attempt()
    }
    throw e
  }
}


