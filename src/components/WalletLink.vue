<template>
  <q-card :bordered="false" :flat="true" style="margin-top: -30px;">
    <q-img
      alt="Paytaca logo"
      src="~assets/paytaca-pos-logo.png"
      style="width: 200px; height: 200px"
    />
    <q-card-actions v-if="!walletStore.walletHash" align="center" style="margin-top: 20px;">
      <q-btn color="primary" @click="toggleQrScanner">Link to Wallet</q-btn>
    </q-card-actions>
  </q-card>
  <QRCodeReader v-if="showQrScanner" :toggle="toggleQrScanner" @decode="onQrDecode" @error="onQrError" />
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
