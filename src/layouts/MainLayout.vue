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
    const reconnectTimeout = ref(null)

    onMounted(() => setupListener())

    const voucherClaimerAddress = computed(() => walletStore.merchantInfo?.vault?.receiving?.address)

    watch(voucherClaimerAddress, () => {
      if (voucherClaimerAddress.value) {
        setupListener()
      }
    })

    watch(isOnline, () => {
      if (isOnline.value && voucherClaimerAddress.value) {
        setupListener()
      } else {
        receiveWebsocket.value?.close()
        receiveWebsocket.value = null // for reactivity
      }
    })


    function setupListener() {
      if (!voucherClaimerAddress.value) return

      const url = `${process.env.WATCHTOWER_WEBSOCKET}/vouchers/${voucherClaimerAddress.value}/`

      console.log('Connecting ws:', url)
      const websocket = new WebSocket(url)

      websocket.addEventListener('close', () => {
        console.log('Listener closed: ', url)

        if (!enableReconnect.value) return console.log('Skipping reconnection: ', url)
        const reconnectInterval =  5000
        const reconnectIntervalSeconds = reconnectInterval / 1000

        console.log(`Attempting reconnection for (${url}) after`, reconnectIntervalSeconds, 'seconds.')

        clearTimeout(reconnectTimeout.value)
        reconnectTimeout.value = setTimeout(() => setupListener(), reconnectInterval)
      })

      websocket.addEventListener('message', message => {
        const data = JSON.parse(message.data)
        onWebsocketReceive(data)
      })

      websocket.addEventListener('open', () => {
        receiveWebsocket.value = markRaw(websocket)
      })
    }
    function onWebsocketReceive(data) {
      if (!data.voucher) return

      const merchantReceiverPk = vault.value?.receiving?.pubkey

      const params = {
        params: {
          merchantReceiverPk,
        },
        options: { network: 'mainnet' }
      }

      const __vault = new Vault(params)
      const contract = __vault.getContract()
      __vault.refund({
        category: data.voucher,
        voucherClaimerAddress: vault.value?.receiving?.address
      }).then(
        txn => console.log('Refund Txn: ', txn)
      )
    }
  }
})
</script>
