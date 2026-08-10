# Card backend WebSocket protocol (NFC payments)

This document describes the persistent WebSocket connection the POS client uses
for card (tap-to-pay) payments. The goal is to avoid the per-tap HTTPS round
trips for `/cards/preimage/` and `/cards/{uid}/spend/`.

The client implementation lives in `src/card/socket.js`. The client is designed
to **fall back to HTTPS** whenever the socket is unavailable or a request fails,
so the server can be enabled incrementally without breaking existing taps.

## Connection

- URL: derived from `CARD_API_BASE_URL`. For
  `https://card-server.paytaca.com/api` this becomes
  `wss://card-server.paytaca.com/ws/cards/` (`ws` when the API is served over http).
  Overridable with `CARD_SOCKET_PATH`.
- The client opens one long-lived connection at app start and keeps it alive
  for the session.
- Same origin/credentials model as the REST API — the server should enforce the
  same auth as `/cards/*`.

## Authentication

The HTTP API authenticates with `Authorization: Token <token>` and a
`public-key` header. WebSocket browsers cannot set arbitrary headers, so the
client sends the credentials as the first application message:

```json
{ "jsonrpc": "2.0", "method": "authenticate", "params": { "token": "...", "public_key": "..." } }
```

The server should validate and, on failure, close the connection (or reject the
following RPC calls with an auth error).

## Heartbeat

The client sends a periodic ping and treats the connection as stale (forcing a
reconnect) if it receives **no message at all** within `staleTimeout`
(default 45s, ping every 15s). The server should reply to pings so the client
can distinguish a healthy idle connection from a silently-dropped one:

```json
{ "jsonrpc": "2.0", "method": "ping" }            // client -> server
{ "jsonrpc": "2.0", "method": "pong" }            // server -> client (optional but recommended)
```

## RPC method: `cards.preimage`

Replaces `POST /cards/preimage/`.

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "cards.preimage",
  "params": {
    "merchant_id": "...",
    "to_address": "...",
    "amount_sats": 1000,
    "picc_data": "aabbcc...",
    "cmac": "deadbeef..."
  }
}
```

Response (mirrors the REST response body):

```json
{ "jsonrpc": "2.0", "id": 1, "result": { "preimages": [...], "txHex": "...", "inputs": [...] } }
```

Error (either JSON-RPC error or `success: false` in the result, matching current
REST semantics):

```json
{ "jsonrpc": "2.0", "id": 1, "error": { "code": -32000, "message": "..." } }
```

## RPC method: `cards.spend`

Replaces `POST /cards/{uid}/spend/`.

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "cards.spend",
  "params": {
    "merchant_id": "...",
    "tx": { "hex": "...", "signatures": [...], "inputs": [...] }
  }
}
```

Response:

```json
{ "jsonrpc": "2.0", "id": 2, "result": { "success": true, ... } }
```

## Binary framing (optional, opt-in)

Payloads default to JSON (`CARD_SOCKET_FORMAT=json`). To enable compact binary
framing, set `CARD_SOCKET_FORMAT=cbor`. In that mode every message frame is a
CBOR-encoded JSON-RPC envelope instead of JSON text. `hex`-style fields that are
typically large (e.g. `tx.hex`, and `picc_data`/`cmac`) are sent as CBOR byte
strings rather than hex text. Responses returned by the server should use byte
strings for the same fields; the client normalizes any byte string back to a hex
string before it reaches the payment logic, so the wire format is transparent to
the rest of the app.

Only enable CBOR once the server has been updated to decode CBOR frames, since
the client does not negotiate per-message.

## Client-side reliability

- The socket is opened at app start (`src/boot/card-socket.js`).
- Before processing a tap, `payWithCard` calls `ensureConnected()`, which waits
  for/triggers a reconnect if the socket is not yet open.
- Heartbeat pings + a stale watchdog detect idle dropped connections and recover
  before the next tap.
- Reconnects use exponential backoff (1s base, doubling, capped ~30s, with
  jitter).
- If the socket is unavailable or a request fails, the client transparently
  falls back to the existing HTTPS endpoints.