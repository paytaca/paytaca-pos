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
      console.error('[watchtower] Request failed', { status: res.status, statusText: res.statusText, responseText: text })
      const error = new Error(text || `HTTP ${res.status}`)
      error.status = res.status  // Attach status code to error object for better error handling
      
      // Try to parse JSON response to extract existing_data for comparison
      try {
        const jsonResponse = JSON.parse(text)
        if (jsonResponse.existing_data) {
          error.existingData = jsonResponse.existing_data
        }
        if (jsonResponse.error) {
          error.apiError = jsonResponse.error
        }
      } catch (e) {
        // Not JSON, ignore
      }
      
      throw error
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


