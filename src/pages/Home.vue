<template>
  <q-page class="flex flex-center">
    <q-card :bordered="false" :flat="true" style="margin-top: -30px;">
      <q-img
        alt="Paytaca logo"
        src="~assets/paytaca-pos-logo.png"
        style="width: 200px; height: 200px"
      ></q-img>

      <q-card-actions align="center" style="margin-top: 20px;">
        <q-btn color="primary" @click="toggleQrScanner">Link to Wallet</q-btn>
      </q-card-actions>
    </q-card>
    <QRCodeReader v-if="showQrScanner" :toggle="toggleQrScanner" @decode="onQrDecode" @error="onQrError" />
  </q-page>
</template>

<script>
import { defineComponent } from 'vue'
import { ref } from 'vue'
import QRCodeReader from '../components/QRCodeReader.vue'

export default defineComponent({
  name: 'HomePage',
  components: {
    QRCodeReader
  },
  setup (props) {
    const showQrScanner = ref(false)

    function toggleQrScanner () {
      showQrScanner.value = !showQrScanner.value
    }

    function onQrDecode (content) {
      console.log(content)
      toggleQrScanner()
    }

    function onQrError (error) {
      console.log('Error:', error)
      toggleQrScanner()
    }

    return {
      showQrScanner,
      toggleQrScanner,
      onQrDecode,
      onQrError
    }
  }
})
</script>
