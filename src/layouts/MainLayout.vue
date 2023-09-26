<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { useWalletStore } from 'stores/wallet'
import { Vault } from 'src/contracts/purelypeer/vault'
import {
  defineComponent,
  ref,
  onMounted,
  watch,
  inject,
  markRaw,
  computed,
} from 'vue'


export default defineComponent({
  setup (props) {
    const isOnline = inject('$isOnline')
    const walletStore = useWalletStore()

    let vault = ref(walletStore.merchantInfo?.vault)
    const receiveWebsocket = ref({ readyState: 0 })
    const enableReconnect = ref(true)
    const reconnectAttempts = ref(100)
    const reconnectTimeout = ref(null)

    // onMounted(() => setupListener())

    watch(isOnline, () => {
      if (isOnline.value) {
        setupListener({ resetAttempts: true })
      } else {
        receiveWebsocket.value?.close()
        receiveWebsocket.value = null // for reactivity
      }
    })

    const receivingAddress = computed(() => walletStore.merchantInfo?.vault?.receiving?.address)
    watch(receivingAddress, () => setupListener({ resetAttempts: true }))

    function setupListener(opts) {
      vault = ref(walletStore.merchantInfo?.vault)

      receiveWebsocket.value?.close?.()
      receiveWebsocket.value = null // for reactivity

      const merchantReceivingAddress = vault.value?.receiving?.address
      const url = `wss://watchtower.cash/ws/vouchers/${merchantReceivingAddress}/`

      console.log('Connecting ws:', url)
      const websocket = new WebSocket(url)
      if (opts?.resetAttempts) reconnectAttempts.value = 100

      websocket.addEventListener('close', () => {
        console.log('setupListener:', 'Listener closed')
        if (!enableReconnect.value) return console.log('setupListener:', 'Skipping reconnection')
        if (reconnectAttempts.value <= 0) return console.log('setupListener:', 'Reached reconnection attempts limit')
        reconnectAttempts.value--;
        const reconnectInterval = 5000
        console.log('setupListener:', 'Attempting reconnection after', reconnectInterval / 1000, 'seconds. retries left:', reconnectAttempts.value)
        clearTimeout(reconnectTimeout.value)
        reconnectTimeout.value = setTimeout(() => setupListener(), reconnectInterval)
      })

      websocket.addEventListener('message', message => {
        const data = JSON.parse(message.data)
        onWebsocketReceive(data)
      })

      websocket.addEventListener('open', () => {
        // close existing websocket in case it exists
        receiveWebsocket.value?.close?.()
        receiveWebsocket.value = null // for reactivity
        receiveWebsocket.value = markRaw(websocket)
      })
    }
    function onWebsocketReceive(data) {
      if (!data.voucher) return

      const merchantReceiverPk = vault.value?.receiving?.pubkey
      const merchantSignerPk = vault.value?.signer?.pubkey

      const params = {
        params: {
          merchantReceiverPk,
          merchantSignerPk,
        },
        options: { network: 'mainnet' },
        // TODO: do not use this when voucher is from paytaca
        feeFunder: {
          address: process.env.PURELYPEER_FEE_FUNDER_ADDR,
          wif: process.env.PURELYPEER_FEE_FUNDER_WIF,
        }
      }

      const __vault = new Vault(params)
      const contract = __vault.getContract()
      __vault.refund({
        category: data.voucher,
        merchantReceivingAddress: vault.value?.receiving?.address
      }).then(
        txn => console.log('Refund Txn: ', txn)
      )
    }
  }
})
</script>
