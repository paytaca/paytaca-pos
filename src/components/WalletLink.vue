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
    <q-card-actions v-if="displayLinkButton || !walletStore.walletHash" align="center" style="margin-top: 20px;">
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
import Watchtower from 'watchtower-cash-js';
import { useWalletStore } from 'stores/wallet'
import { aes, getPubkeyAt } from 'src/wallet/utils'
import QRCodeReader from 'src/components/QRCodeReader.vue';
import { Device } from '@capacitor/core'
import { defineComponent, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar' 

export default defineComponent({
  components: {
    QRCodeReader,
  },
  emits: [
    'device-linked',
  ],
  props: {
    displayLinkButton: Boolean,
  },
  setup(props, { emit }) {
    const $q = useQuasar()
    const watchtower = new Watchtower()

    const walletStore = useWalletStore()
    const showQrScanner = ref(false)
    function toggleQrScanner () {
      showQrScanner.value = !showQrScanner.value
    }

    function onQrError (error) {
      console.log(error)
      toggleQrScanner()
      $q.notify({
        message: 'QR Scanner error',
        caption: typeof error === 'string' ? error : '',
      })
    }

    function onQrDecode(content='') {
      showQrScanner.value = false
      const dialog = $q.dialog({
        title: 'Link device',
        message:'Linking device',
        persistent: true,
        progress: true,
      })

      return Promise.resolve(content)
        .then(content => {
            dialog.update({ message: 'Decoding content'})
            const decodedContent = JSON.parse(content)
            const code = decodedContent.code
            const decryptKey = {
              password: decodedContent.decryptKey.split('.')[0],
              iv: decodedContent.decryptKey.split('.')[1],
            }
            const nonce = decodedContent.nonce
            return { code, decryptKey, nonce }
        })
        .catch(error => {
          console.error(error)
          dialog.update({ title: 'Link device error', message: 'Unable to decode QR data' })
          return { skip: true }
        })
        .then(async (qrCodeData) => {
          if (qrCodeData?.skip) return { skip: true }
          dialog.update({ message: 'Retrieving link code data' })
          const response = await watchtower.BCH._api.get(`paytacapos/devices/link_code_data/`, { params: { code: qrCodeData.code } })
          return { qrCodeData, encryptedXpubkey: response?.data }
        })
        .catch(error => {
          console.error(error)
          let message = 'Link code data invalid'
          if (error?.response.status === 400) message = 'Link code data not found'
          dialog.update({ title: 'Link device error', message: message })
          return { skip: true }
        })
        .then(({ skip, qrCodeData, encryptedXpubkey }) => {
          if (skip) return { skip }
          dialog.update({ message: 'Decrypting xpubkey' })
          const xpubkey = aes.decrypt(
            encryptedXpubkey, qrCodeData.decryptKey.password, qrCodeData.decryptKey.iv)

          return { qrCodeData, encryptedXpubkey, xpubkey }
        })
        .catch(error => {
          console.error(error)
          dialog.update({ title: 'Link device error', message: 'Unable to decrypt xpubkey' })
          return { skip: true }
        })
        .then(({ skip, qrCodeData, xpubkey }) => {
          if (skip) return { skip }
          dialog.update({ message: 'Generating verifying xpubkey' })
          const verifyingPubkey = getPubkeyAt(xpubkey, qrCodeData.nonce)
          return { qrCodeData, xpubkey, verifyingPubkey }
        })
        .catch(error => {
          console.error(error)
          dialog.update({ title: 'Link device error', message: 'Unable to generate verifying pubkey' })
          return { skip: true }
        })
        .then(async ({ skip, qrCodeData, xpubkey, verifyingPubkey }) => {  
          if (skip) return { skip }
          dialog.update({ persistent: true, progress: true, message: 'Retrieving device information' })
          const deviceInfo = await Device.getInfo()
          return { qrCodeData, xpubkey, verifyingPubkey, deviceInfo }
        })
        .catch(error => {
          console.error(error)
          dialog.update({ title: 'Link device error', message: 'Failed to retrieve device information' })
          return { skip: true }
        })
        .then(async ({ skip, qrCodeData, xpubkey, verifyingPubkey, deviceInfo }) => {
          if (skip) return { skip }
          dialog.update({ message: 'Updating server' })
          const data = {  
            link_code: qrCodeData.code,
            verifying_pubkey: verifyingPubkey,
            name: deviceInfo?.name,
            device_model: deviceInfo?.model,
            os: deviceInfo?.operatingSystem,
            device_id: deviceInfo?.uuid,
          }
          console.log(data)
          const response = await watchtower.BCH._api.post('paytacapos/devices/redeem_link_device_code/', data)
          walletStore.$patch((walletStoreState) => {
            if (response?.data?.wallet_hash) {
              walletStoreState.walletHash = response?.data?.wallet_hash
              walletStoreState.xPubKey = xpubkey
              walletStoreState.posId = Number(response?.data?.posid)
              walletStoreState.linkCode = data.link_code
            }
          })

          console.log(emit('device-linked'))
          dialog.update({ title: 'Device Linked', message: 'POS device linked successfully!'})
        })
        .catch(error => {
          console.error(error)
          let message = 'Failed to update server'
          if (Array.isArray(error?.response?.data?.non_field_errors) && error?.response?.data?.non_field_errors?.length) {
            message = error?.response?.data?.non_field_errors.join('<br/>')
          }
          dialog.update({ title: 'Link device error', message: message, html: true })
        })
        .finally(() => dialog.update({ persistent: false, progress: false }))
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
