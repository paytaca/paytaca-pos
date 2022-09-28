<template>
  <q-page class="flex flex-center">
    <q-card :bordered="false" :flat="true" style="margin-top: -30px;">
      <q-img
        alt="Paytaca logo"
        src="~assets/paytaca-pos-logo.png"
        style="width: 200px; height: 200px"
      ></q-img>

      <q-card-actions v-if="!store.walletHash" align="center" style="margin-top: 20px;">
        <q-btn color="primary" @click="toggleQrScanner">Link to Wallet</q-btn>
      </q-card-actions>
    </q-card>
    <QRCodeReader v-if="showQrScanner" :toggle="toggleQrScanner" @decode="onQrDecode" @error="onQrError" />
    <div v-if="qrScanError" style="width: 100%; position: fixed; bottom: 0;">
      <q-banner dense inline-actions class="text-white bg-red">
        {{ qrScanError }}
        <template v-slot:action>
          <q-icon name="close" @click="() => { qrScanError = null }"></q-icon>
        </template>
      </q-banner>
    </div>
  </q-page>
</template>

<script>
import { ref } from 'vue'
import { defineComponent } from 'vue'
import { useWalletStore } from 'stores/wallet'
import QRCodeReader from '../components/QRCodeReader.vue'

export default defineComponent({
  name: 'HomePage',
  components: {
    QRCodeReader
  },
  setup (props) {
    const showQrScanner = ref(false)
    const qrScanError = ref(null)

    function toggleQrScanner () {
      showQrScanner.value = !showQrScanner.value
      if (showQrScanner.value === true) {
        qrScanError.value = null
      }
    }

    function isJsonString(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    function onQrDecode (content) {
      let walletData
      if (isJsonString(content)) {
        console.log(content)
      } else {
        qrScanError.value = 'Invalid QR code'
      }
      toggleQrScanner()
    }

    function onQrError (error) {
      qrScanError.value = error
      toggleQrScanner()
    }

    const store = useWalletStore()

    return {
      showQrScanner,
      qrScanError,
      toggleQrScanner,
      onQrDecode,
      onQrError,
      store
    }
  }
})
</script>
