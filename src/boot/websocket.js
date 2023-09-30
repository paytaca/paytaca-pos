import { boot } from 'quasar/wrappers'
import { RpcWebSocketClient } from 'rpc-websocket-client';
import { computed, ref, watch } from 'vue';
import Watchtower from 'watchtower-cash-js';

const watchtower = new Watchtower()
const watchtowerUrl = new URL(watchtower.BCH._api.defaults.baseURL)
const host = watchtowerUrl.host
const scheme = watchtowerUrl.protocol === 'https:' ? 'wss' : 'ws'

export default boot(({ app, store }) => {
  const $rpc = {
    RECONNECT_INTERVAL: 5 * 1000,
    enableReconnection: ref(true),
    client: new RpcWebSocketClient(),
    url: computed(() => {
      if (!store.state.value?.wallet?.walletHash) return ''
      return `${scheme}://${host}/ws/paytacapos/updates/${store.state.value?.wallet?.walletHash}/${store.state.value?.wallet?.posId}/`
    }),

    rpcReconnectTimeout: null,
    connectRpcClient() {
      this.client?.ws?.close?.()
      this.client.connect(this.url.value)
        .then(response => {
          clearTimeout(this.rpcReconnectTimeout)
      })
    }
  }

  watch($rpc.url, () => {
    if (!$rpc.url.value) return
    $rpc.connectRpcClient()
  })

  $rpc.client.onClose(error => {
    console.error('RPC Client connection error:', error)
    if ($rpc.enableReconnection.value) {
      console.debug('Reconnecting after', $rpc.RECONNECT_INTERVAL/1000, 'second/s',)
      clearTimeout($rpc.rpcReconnectTimeout)
      $rpc.rpcReconnectTimeout = setTimeout(
        () => $rpc.connectRpcClient(),
        $rpc.RECONNECT_INTERVAL,
      )
    } else {
      console.debug('Skipping reconnection')
    }
  })

  window.c = $rpc
  watch($rpc.enableReconnection, () => {
    if(!$rpc.enableReconnection) clearTimeout($rpc.rpcReconnectTimeout)
  })
  app.config.globalProperties.$rpc = $rpc
  app.provide('$rpc', $rpc)
})
