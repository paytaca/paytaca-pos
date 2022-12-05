<template>
  <router-view />
</template>

<script>
import { defineComponent, inject, onMounted, onUnmounted, ref } from 'vue'
import { useWalletStore } from './stores/wallet'

export default defineComponent({
  name: 'App',
  created() {
    const theme = localStorage.getItem('app_theme')
    let darkMode = 'auto'
    switch(theme) {
      case 'true':
        darkMode = true
        break
      case 'false':
        darkMode = false
        break
      default:
        darkMode = 'auto'
    }
    this.$q.dark.set(darkMode)
  },
  watch: {
    '$q.dark.isActive': function () {
      localStorage.setItem('app_theme', this.$q.dark.isActive)
    }
  },
  setup() {
    const walletStore = useWalletStore()
    const $rpc = inject('$rpc')
    const pingIntervalId = ref(null)
    onMounted(() => {
      clearInterval(pingIntervalId.value)
      pingIntervalId.value = setInterval(() => {
        if ($rpc?.client?.ws?.readyState !== WebSocket.OPEN) return
        $rpc?.client?.call('ping')
      }, 30 * 1000)
      $rpc?.client?.onOpen(() => $rpc.client.call('ping'))
    })
    onUnmounted(() => clearInterval(pingIntervalId.value))

    /**
     * @param {Object} rpcResult 
     * @param {Object} rpcResult.result
     * @param {Object} rpcResult.result.update
     * @param {String} rpcResult.result.update.resource
     * @param {String} rpcResult.result.update.action
     * @param {Object} [rpcResult.result.update.object]
     * @param {Object} [rpcResult.result.update.data]
    */
    const rpcUpdateHandler = (rpcResult) => {
      console.debug(rpcResult)
      const updateData = rpcResult?.result?.update
      if (!updateData) return
      if (updateData?.resource === 'pos_device' && updateData?.object?.wallet_hash == walletStore.walletHash && updateData?.object?.posid === walletStore.posId) {
        switch(updateData?.action) {
          case 'update':
          case 'link':
          case 'unlink':
            walletStore.refetchDeviceInfo()
            break
        }
      }
    }

    if ($rpc.client.onNotification.indexOf(rpcUpdateHandler) < 0) {
      $rpc.client.onNotification.push(rpcUpdateHandler)
    }
  }
})
</script>
