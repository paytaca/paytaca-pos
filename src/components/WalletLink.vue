<template>
  <div style="margin-top: -30px;">
    <q-img
      alt="Paytaca logo"
      src="~assets/paytaca-pos-icon.png"
      style="width: 250px; height: 250px"
    />
      <div
        :class="[
          'text-h4 text-center text-weight-medium',
          $q.dark.isActive ? '' : 'text-dark-page',
        ]"
        style="margin-top:-45px;letter-spacing: 0.18rem;"
      >
        Paytaca<span class="q-ml-sm" style="font-weight:575;">POS</span>
      </div>
    <q-card-actions v-if="!walletStore.walletHash" align="center" style="margin-top: 20px;">
      <q-btn color="primary" @click="toggleQrScanner">Link to Wallet</q-btn>
    </q-card-actions>
  </div>
  <QRCodeReader
    v-if="showQrScanner"
    text="Scan QR code for wallet link"
    :toggle="toggleQrScanner"
    @decode="onQrDecode"
    @error="onQrError"
  />
</template>
<script>
import { useWalletStore } from 'stores/wallet'
import { parseWalletLinkData } from 'src/wallet/utils'
import QRCodeReader from 'src/components/QRCodeReader.vue';
import { defineComponent, ref } from 'vue'
import { useQuasar } from 'quasar' 

export default defineComponent({
  components: {
    QRCodeReader,
  },
  setup() {
    const $q = useQuasar()

    const walletStore = useWalletStore()
    const showQrScanner = ref(false)
    function toggleQrScanner () {
      showQrScanner.value = !showQrScanner.value
    }
    function onQrDecode (content) {
      console.log('got data:', content)
      try {
        const data = parseWalletLinkData(content)
        if (data?.walletHash && data?.xPubKey && !isNaN(Number(data.posId))) {
          walletStore.$patch((walletStoreState) => {
            walletStoreState.walletHash = data.walletHash
            walletStoreState.xPubKey = data.xPubKey
            walletStoreState.posId = Number(data.posId)
          })
        } else {
          throw 'Invalid wallet link QR code data'
        }
      } catch(error) {
        console.error(error)
        let message = 'Error decoding wallet link QR code'
        if (typeof error === 'string') message = error
        $q.notify({ message: message })
      }
      toggleQrScanner()
    }
    function onQrError (error) {
      console.log(error)
      toggleQrScanner()
      $q.notify({
        message: 'QR Scanner error',
        caption: typeof error === 'string' ? error : '',
      })
    }

    return {
      walletStore,
      toggleQrScanner,
      showQrScanner,
      onQrDecode,
      onQrError,
    }
  },
})
</script>
