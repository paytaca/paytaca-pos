import { cborEncode, cborDecode, normalizeBytesToHex, hexToBytes } from './binary'

const DEV_FALLBACK_API_BASE_URL = 'http://localhost:8002/api'
const API_BASE_URL =
  process.env.CARD_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? DEV_FALLBACK_API_BASE_URL : '')

const DEFAULT_WS_PATH = process.env.CARD_SOCKET_PATH || '/ws/cards/'

/**
 * Derives the card backend WebSocket URL from CARD_API_BASE_URL, mirroring the
 * pattern used by the marketplace RPC wrapper.
 * @returns {string} e.g. "wss://card-server.paytaca.com/ws/cards/"
 */
export function deriveCardSocketUrl() {
  if (!API_BASE_URL) {
    throw new Error('CARD_API_BASE_URL is required outside development builds')
  }
  const parsed = new URL(API_BASE_URL)
  const scheme = parsed.protocol === 'https:' ? 'wss' : 'ws'
  const path = DEFAULT_WS_PATH.startsWith('/') ? DEFAULT_WS_PATH : `/${DEFAULT_WS_PATH}`
  return `${scheme}://${parsed.host}${path}`
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toError(error) {
  if (error instanceof Error) return error
  const message = (error && (error.message || error.msg)) || 'Card socket RPC error'
  const err = new Error(message)
  err.code = error && error.code
  return err
}

/**
 * Persistent WebSocket client for the card backend.
 *
 * Responsibilities:
 * - Holds a single long-lived connection opened at app/session start.
 * - `ensureConnected()` gates work on the connection being open, triggering a
 *   (re)connect and waiting instead of assuming readiness.
 * - Heartbeat pings + a stale watchdog detect silently-dropped idle connections.
 * - Reconnects with exponential backoff after drops.
 * - JSON-RPC request/response with per-request timeout.
 * - Optional CBOR binary framing, defaulting to JSON until the server supports it.
 */
export class CardSocket {
  constructor(opts = {}) {
    this.url = opts.url || deriveCardSocketUrl()
    this.enabled = opts.enabled !== false
    this.format = opts.format === 'cbor' ? 'cbor' : 'json'
    this.binaryEnabled = this.format === 'cbor'

    this.ws = null
    this.connectionPhase = 'closed'

    this._ctr = 0
    this._pending = new Map()
    this._reconnectAttempts = 0
    this._reconnectTimeout = null
    this._connectPromise = null
    this._heartbeatTimer = null
    this._staleTimer = null
    this._lastMessageAt = 0
    this._notificationHandlers = new Set()
    this._auth = { token: null, publicKey: null }
    this._authPromise = null
    this._authenticated = false
    this._cleanup = null

    this.connectTimeout = opts.connectTimeout || 5000
    this.authTimeout = opts.authTimeout || 3000
    this.requestTimeout = opts.requestTimeout || 60000
    this.heartbeatInterval = opts.heartbeatInterval || 15000
    this.staleTimeout = opts.staleTimeout || 45000
    this.backoff = {
      base: opts.baseBackoff || 1000,
      factor: opts.exponentialBackoff || 2,
      max: opts.maxBackoff || 30000,
      maxAttempts: opts.maxReconnectAttempts || 0,
    }
  }

  /**
   * Applies runtime configuration (e.g. from the boot file) and returns this
   * instance for chaining.
   */
  init(opts = {}) {
    if (opts.url) this.url = opts.url
    if (opts.format) {
      this.format = opts.format === 'cbor' ? 'cbor' : 'json'
      this.binaryEnabled = this.format === 'cbor'
    }
    if (opts.enabled !== undefined) this.enabled = opts.enabled
    if (opts.auth) this._auth = { ...this._auth, ...opts.auth }
    return this
  }

  get isConnected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * True when the connection is open and its authentication message has been
   * sent. `_authenticated` is reset per connection attempt in `_open()`.
   */
  /**
   * True when the connection is open and its authentication message has been
   * sent. Note: this is set *optimistically* right after `_sendRaw` for the
   * `authenticate` frame (not after a server ack), because WS frames are
   * processed in order. The server is expected to close the connection on auth
   * failure; if that changes, this should await a server response instead.
   */
  get isReady() {
    return this.isConnected && this._authenticated === true
  }

  get connectionState() {
    if (!this.ws) return 'closed'
    if (this.ws.readyState === WebSocket.OPEN) return 'open'
    if (this.ws.readyState === WebSocket.CONNECTING) return 'connecting'
    return 'closed'
  }

  /**
   * Opens the persistent connection. Resolves when the socket is open (or
   * already open). Safe to call repeatedly - concurrent calls share one attempt.
   */
  connect() {
    if (this.isConnected) return Promise.resolve(true)
    if (this._connectPromise) return this._connectPromise
    this._connectPromise = this._open()
      .then(() => true)
      .catch((error) => {
        console.warn('[cardSocket] Connection attempt failed:', error.message)
        throw error
      })
      .finally(() => {
        this._connectPromise = null
      })
    return this._connectPromise
  }

  /**
   * Non-blocking warm-up: kicks off the connection without waiting.
   */
  warmUp() {
    return this.connect().catch(() => {})
  }

  /**
   * Connection-state gate. Resolves `true` once the socket is open AND its
   * authentication has been sent, triggering a (re)connect if needed.
   * Resolves `false` if the connection could not be established or
   * authenticated within `timeout`. Callers may fall back to HTTPS in that case.
   * @param {Object} [opts]
   * @param {number} [opts.timeout] - Max milliseconds to wait for an open socket.
   * @returns {Promise<boolean>}
   */
  async ensureConnected({ timeout } = {}) {
    if (this.isConnected) {
      return this.ensureAuthenticated({ timeout: timeout || this.authTimeout })
    }
    const waitFor = timeout || this.connectTimeout
    this.connect().catch(() => {})
    const start = Date.now()
    while (!this.isConnected) {
      if (Date.now() - start >= waitFor) return this.isConnected
      await delay(100)
    }
    const remaining = Math.max(waitFor - (Date.now() - start), 200)
    return this.ensureAuthenticated({ timeout: remaining })
  }

  /**
   * Waits until the authentication message for the current connection has been
   * sent (or skipped because no credentials are available). WebSocket frames
   * are processed in order, so sending `authenticate` before any RPC guarantees
   * the server sees it first and prevents spurious "Not authenticated" errors.
   * @param {Object} [opts]
   * @param {number} [opts.timeout] - Max milliseconds to wait for auth readiness.
   * @returns {Promise<boolean>}
   */
  async ensureAuthenticated({ timeout } = {}) {
    if (!this.isConnected) return false
    if (this._authenticated) return true
    const authPromise = this._authPromise
    if (!authPromise) return false
    const waitFor = timeout || this.authTimeout
    let timer
    try {
      const settled = await Promise.race([
        authPromise,
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(false), waitFor)
        })
      ])
      return settled === true
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Sends a JSON-RPC request and resolves with the `result` payload, gated on
   * the connection being authenticated so requests never race the handshake.
   * @param {string} method - RPC method name.
   * @param {Object} [params] - RPC params.
   * @param {Object} [opts]
   * @param {number} [opts.timeout] - Per-request timeout in milliseconds.
   * @returns {Promise<*>}
   */
  async request(method, params = {}, { timeout } = {}) {
    const authenticated = await this.ensureAuthenticated()
    if (!authenticated) {
      const reason = this.isConnected ? 'is not authenticated' : 'is not connected'
      throw new Error(`Card socket ${reason} (cannot call ${method})`)
    }
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error(`Card socket is not connected (cannot call ${method})`))
        return
      }
      const id = ++this._ctr
      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new Error(`Card socket request timed out: ${method}`))
      }, timeout || this.requestTimeout)
      this._pending.set(id, { resolve, reject, timer })
      try {
        this._sendRaw({ jsonrpc: '2.0', id, method, params })
      } catch (error) {
        clearTimeout(timer)
        this._pending.delete(id)
        reject(error)
      }
    })
  }

  /**
   * Registers a handler for server-initiated notifications.
   * @param {(message: Object) => void} handler
   * @returns {() => void} Unsubscribe function.
   */
  onNotification(handler) {
    this._notificationHandlers.add(handler)
    return () => this._notificationHandlers.delete(handler)
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (enabled) {
      this.warmUp()
    } else {
      this.disconnect()
    }
  }

  /**
   * Closes the connection and disables reconnection.
   */
  disconnect() {
    this.enabled = false
    this._stopHeartbeat()
    clearTimeout(this._reconnectTimeout)
    this._reconnectTimeout = null
    if (this.ws) {
      try {
        this.ws.close()
      } catch (_) {
        // already closed
      }
      this.ws = null
    }
    this._rejectAllPending(new Error('Card socket disconnected'))
  }

  // ======================= internal =======================

  _open() {
    return new Promise((resolve, reject) => {
      let ws
      try {
        ws = new WebSocket(this.url)
      } catch (error) {
        reject(error)
        return
      }
      this.ws = ws
      ws.binaryType = 'arraybuffer'
      this.connectionPhase = 'connecting'

      let settled = false
      const onOpen = () => {
        settled = true
        this.connectionPhase = 'open'
        this._ctr = 0
        this._reconnectAttempts = 0
        this._lastMessageAt = Date.now()
        this._authenticated = false
        this._startHeartbeat()
        this._authPromise = this._sendAuth()
        resolve()
      }
      const onError = () => {
        if (settled) return
        settled = true
        this.connectionPhase = 'closed'
        reject(new Error('Card socket connection failed'))
      }
      const onClose = () => {
        if (!settled) {
          settled = true
          this.connectionPhase = 'closed'
          reject(new Error('Card socket closed before opening'))
        }
        this._handleClose()
      }
      const onMessage = (event) => this._onMessage(event)

      ws.addEventListener('open', onOpen)
      ws.addEventListener('error', onError)
      ws.addEventListener('close', onClose)
      ws.addEventListener('message', onMessage)

      this._cleanup = () => {
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('error', onError)
        ws.removeEventListener('close', onClose)
        ws.removeEventListener('message', onMessage)
      }
    })
  }

  _handleClose() {
    if (this._cleanup) {
      this._cleanup()
      this._cleanup = null
    }
    this.ws = null
    this.connectionPhase = 'closed'
    this._stopHeartbeat()
    this._authPromise = null
    this._rejectAllPending(new Error('Card socket closed'))
    this._scheduleReconnect()
  }

  _scheduleReconnect() {
    if (!this.enabled) return
    const { maxAttempts } = this.backoff
    this._reconnectAttempts += 1
    if (maxAttempts > 0 && this._reconnectAttempts > maxAttempts) {
      console.warn('[cardSocket] Max reconnect attempts reached')
      return
    }
    const delayMs = this._nextBackoff()
    clearTimeout(this._reconnectTimeout)
    console.log(
      `[cardSocket] Reconnecting in ${delayMs}ms (attempt ${this._reconnectAttempts})`
    )
    this._reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {})
    }, delayMs)
  }

  _nextBackoff() {
    const { base, factor, max } = this.backoff
    const capped = Math.min(this._reconnectAttempts, 10)
    const delayMs = base * factor ** capped
    const jittered = delayMs * (0.85 + Math.random() * 0.3)
    return Math.round(Math.min(jittered, max))
  }

  _startHeartbeat() {
    this._stopHeartbeat()
    this._heartbeatTimer = setInterval(() => this._sendHeartbeat(), this.heartbeatInterval)
    this._staleTimer = setInterval(() => this._checkStale(), 5000)
  }

  _stopHeartbeat() {
    clearInterval(this._heartbeatTimer)
    clearInterval(this._staleTimer)
    this._heartbeatTimer = null
    this._staleTimer = null
  }

  _sendHeartbeat() {
    if (!this.isConnected) return
    try {
      this._sendRaw({ jsonrpc: '2.0', method: 'ping' })
    } catch (error) {
      console.warn('[cardSocket] Heartbeat send failed:', error.message)
    }
  }

  _checkStale() {
    if (!this.isConnected) return
    if (Date.now() - this._lastMessageAt > this.staleTimeout) {
      console.warn(
        `[cardSocket] No data received in ${this.staleTimeout}ms, connection considered stale. Reconnecting.`
      )
      try {
        this.ws.close()
      } catch (_) {
        // ignore
      }
    }
  }

  _sendRaw(envelope) {
    if (!this.isConnected) throw new Error('Card socket is not connected')
    if (this.binaryEnabled) {
      this.ws.send(cborEncode(this._toBinaryEnvelope(envelope)).buffer)
    } else {
      this.ws.send(JSON.stringify(envelope))
    }
  }

  _toBinaryEnvelope(envelope) {
    const params = { ...envelope.params }
    if (typeof params.picc_data === 'string') params.picc_data = hexToBytes(params.picc_data)
    if (typeof params.cmac === 'string') params.cmac = hexToBytes(params.cmac)
    if (Array.isArray(params.signatures)) {
      params.signatures = params.signatures.map((sig) => {
        if (!sig || typeof sig !== 'object') return sig
        const out = { ...sig }
        if (typeof out.merchantSigHex === 'string') out.merchantSigHex = hexToBytes(out.merchantSigHex)
        if (typeof out.merchantPkHex === 'string') out.merchantPkHex = hexToBytes(out.merchantPkHex)
        return out
      })
    }
    return { ...envelope, params }
  }

  _onMessage(event) {
    this._lastMessageAt = Date.now()
    let message
    try {
      if (typeof event.data === 'string') {
        message = JSON.parse(event.data)
      } else {
        message = normalizeBytesToHex(cborDecode(event.data))
      }
    } catch (error) {
      console.warn('[cardSocket] Failed to parse incoming message:', error)
      return
    }
    if (message && message.id !== undefined && this._pending.has(message.id)) {
      const pending = this._pending.get(message.id)
      this._pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) pending.reject(toError(message.error))
      else pending.resolve(message.result)
      return
    }
    this._emitNotification(message)
  }

  _emitNotification(message) {
    for (const handler of this._notificationHandlers) {
      try {
        handler(message)
      } catch (error) {
        console.error('[cardSocket] Notification handler error:', error)
      }
    }
  }

  async _sendAuth() {
    try {
      const { getAuthToken } = await import('./user')
      const { useWalletStore } = await import('src/stores/wallet')
      const walletStore = useWalletStore()
      const token = this._auth.token || (await getAuthToken())
      const publicKey = this._auth.publicKey || walletStore.authPublicKey
      const params = {}
      if (token) params.token = token
      if (publicKey) params.public_key = publicKey
      if (Object.keys(params).length === 0) {
        // No credentials to send; assume the server does not require auth so
        // the connection is treated as request-ready.
        this._authenticated = true
        return true
      }
      this._sendRaw({ jsonrpc: '2.0', method: 'authenticate', params })
      // Optimistically mark as authenticated: WS guarantees ordered delivery,
      // so the server will see this frame before any RPC. The server closes the
      // connection on auth failure; if that behaviour changes, switch to
      // awaiting a server acknowledgement before setting this flag.
      this._authenticated = true
      return true
    } catch (error) {
      this._authenticated = false
      console.warn('[cardSocket] Authentication message not sent:', error.message)
      return false
    }
  }

  _rejectAllPending(error) {
    if (this._pending.size === 0) return
    for (const [id, pending] of this._pending.entries()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this._pending.clear()
  }
}

/**
 * Singleton instance used across the app.
 */
export const cardSocket = new CardSocket()
