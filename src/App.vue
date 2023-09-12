<template>
  <router-view />
</template>

<script>
import { useQuasar } from 'quasar'
import { defineComponent, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useWalletStore } from './stores/wallet'
import { useNotificationsStore } from './stores/notifications'
import { pushNotificationsManager } from './boot/push-notifications'

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
    const $q = useQuasar()
    const walletStore = useWalletStore()
    const notificationsStore = useNotificationsStore()
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
          case 'unlink_request':
          case 'suspend':
          case 'unsuspend':
            walletStore.refetchDeviceInfo()
        }
      }
    }

    if ($rpc.client.onNotification.indexOf(rpcUpdateHandler) < 0) {
      $rpc.client.onNotification.push(rpcUpdateHandler)
    }

    const deviceSuspensionDialog = ref(null)
    watch(() => walletStore.deviceInfo.linkedDevice.isSuspended, () => checkSuspended())
    onMounted(() => checkSuspended())
    function checkSuspended() {
      if (walletStore.deviceInfo.linkedDevice.isSuspended) {
        deviceSuspensionDialog.value = $q.dialog({
          title: 'Suspended',
          message: 'POS Device is suspended, contact merchant to unsuspend device',
          persistent: true,
          ok: false,
          cancel: false,
        })
      } else {
        deviceSuspensionDialog.value?.hide?.() 
        deviceSuspensionDialog.value = null
      }
    }

    
    onMounted(() => {
      if (!pushNotificationsManager.isMobile) return
      pushNotificationsManager.events.addEventListener(
        'pushNotificationReceived', onPushNotification,
      )
    })
    onUnmounted(() => {
      pushNotificationsManager.events.removeEventListener(
        'pushNotificationReceived', onPushNotification,
      )
    })
    const onPushNotification = (notification) => {
      console.log('Notification:', notification)
      if (notification?.title || notification?.body) {
        let actions = [
          { icon: 'close', 'aria-label': 'Dismiss', color: 'white' }
        ]
        const route = notificationsStore.resolvePushNotificationRoute(notification)
        if (route) {
          actions = [
            {
              noCaps: true,
              label: 'Open',
              textColor: 'white',
              handler: () => {
                notificationsStore.setOpenedNotification(notification)
                notificationsStore.handleOpenedNotification()
              }
            },
            {
              noCaps: true,
              label: 'Close',
              textColor: 'white',
            },
          ]
        }

        $q.notify({
          color: 'brandblue',
          message: notification?.title,
          caption: notification?.body,
          multiLine: true,
          attrs: { style: 'word-break:break-all;' },
          actions: actions,
        })
      }
    }
  }
})
</script>
