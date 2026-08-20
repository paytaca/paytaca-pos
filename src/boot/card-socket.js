import { boot } from 'quasar/wrappers'
import { cardSocket } from 'src/card/socket'

/**
 * Opens the persistent card-backend WebSocket at app start so the connection
 * (and its handshake + auth) has already completed by the time a card is tapped.
 * Failures are non-fatal: the socket reconnects with backoff and payment falls
 * back to HTTPS when the socket is unavailable.
 */
export default boot(() => {
  cardSocket.init({
    enabled: true,
    format: process.env.CARD_SOCKET_FORMAT || 'json',
  })
  cardSocket.warmUp()
})
