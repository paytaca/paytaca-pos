<template>
  <div style="margin-top: -130px;">
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
    <q-card-actions v-if="displayLinkButton || !walletStore.walletHash" vertical align="center" class="q-gutter-y-sm q-mt-md">
      <div class="text-h6 text-weight-light">{{ $t('LinkToWallet') }}</div>
      <q-btn
        color="primary"
        icon="mdi-link-variant"
        class="full-width q-mb-xs"
        :label="$t('InputLink')"
        @click="linkCodePrompt()"
      />

      <q-btn
        color="primary"
        icon="mdi-qrcode-scan"
        class="full-width q-mb-xs"
        :label="$t('Scan')"
        @click="toggleQrScanner"
      />
    </q-card-actions>
  </div>
  <QRCodeReader
    v-model="showQrScanner"
    :text="$t('ScanQrCodeForWalletLink')"
    @decode="onQrDecode"
    @error="onQrError"
  />
</template>
<script>
import Watchtower from 'watchtower-cash-js';
import { useWalletStore } from 'stores/wallet'
import { useAddressesStore } from 'src/stores/addresses';
import { aes, getPubkeyAt } from 'src/wallet/utils'
import QRCodeReader from 'src/components/QRCodeReader.vue';
import { Device } from '@capacitor/device'
import { defineComponent, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
    const { t } = useI18n()
    const watchtower = new Watchtower()

    const walletStore = useWalletStore()
    const addressesStore = useAddressesStore()
    function parseLinkCode(value) {
      let linkCode = ''
      try {
        let url = new URL(value)
        linkCode = url.searchParams.get('code') || ''
      } catch(error) {
        console.error(error)
        linkCode = value
      }

      try {
        return atob(linkCode)
      } catch(error) {
        console.error(error)
      }
    }

    function linkCodePrompt() {
      $q.dialog({
        title: t('WalletLink'),
        message: t('InputWalletLinkCode'),
        prompt: { outlined: true },
        // ok: { color: 'brandblue', flat: true },
        position: 'bottom',
        color: 'brandblue',
      })
        .onOk(data => {
          if(data) onQrDecode(data)
        })
    }

    const showQrScanner = ref(false)
    function toggleQrScanner () {
      showQrScanner.value = !showQrScanner.value
    }

    function onQrError (error) {
      $q.notify({
        type: 'negative',
        message: t('QrScannerError'),
        caption: typeof error === 'string' ? error : '',
      })
    }

    function linkToWallet(content='') {
      return onQrDecode(content)
    }

    function onQrDecode(content='') {
      showQrScanner.value = false
      const dialog = $q.dialog({
        title: t('LinkDevice'),
        message:t('LinkingDevice'),
        persistent: true,
        progress: true,
        color: 'brandblue',
      })

      return Promise.resolve(content)
        .then(content => {
          return parseLinkCode(content) || content
        })
        .then(content => {
            dialog.update({ message: t('DecodingContent') })
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
          dialog.update({ title: t('LinkDeviceError'), message: t('UnableToDecodeQrData') })
          return { skip: true }
        })
        // encryptedData = xpubkey
        .then(async (qrCodeData) => {
          if (qrCodeData?.skip) return { skip: true }
          dialog.update({ message: t('RetrievingLinkCodeData') })
          const response = await watchtower.BCH._api.get(
            `paytacapos/devices/link_code_data/`,
            { params: { code: qrCodeData.code }
          })
          return { qrCodeData, encryptedData: response?.data }
        })
        .catch(error => {
          console.error(error)
          let message = t('LinkCodeDataInvalid')
          if (error?.response.status === 400) message = t('LinkCodeDataNotFound')
          dialog.update({ title: t('LinkDeviceError'), message: message })
          return { skip: true }
        })
        .then(({ skip, qrCodeData, encryptedData }) => {
          if (skip) return { skip }
          dialog.update({ message: t('DecryptingXpubkey') })

          let xpubkey = aes.decrypt(
            encryptedData,
            qrCodeData.decryptKey.password,
            qrCodeData.decryptKey.iv
          )

          return { qrCodeData, encryptedData, xpubkey }
        })
        .catch(error => {
          console.error(error)
          dialog.update({ title: t('LinkDeviceError'), message: t('UnableToDecryptXpubkey') })
          return { skip: true }
        })
        .then(({ skip, qrCodeData, xpubkey }) => {
          if (skip) return { skip }
          dialog.update({ message: t('GeneratingVerifyingXpubkey') })
          const verifyingPubkey = getPubkeyAt(xpubkey, qrCodeData.nonce)
          return { qrCodeData, xpubkey, verifyingPubkey }
        })
        .catch(error => {
          console.error(error)
          dialog.update({ title: t('LinkDeviceError'), message: 'Unable to generate verifying pubkey' })
          return { skip: true }
        })
        .then(async ({ skip, qrCodeData, xpubkey, verifyingPubkey }) => {  
          if (skip) return { skip }
          dialog.update({ persistent: true, progress: true, message: 'Retrieving device information' })
          const deviceInfo = await Device.getInfo()
          deviceInfo.uuid = (await Device.getId())?.uuid
          return { qrCodeData, xpubkey, verifyingPubkey, deviceInfo }
        })
        .catch(error => {
          console.error(error)
          dialog.update({ title: t('LinkDeviceError'), message: t('FailedToRetrieveDeviceInformation') })
          return { skip: true }
        })
        .then(async ({ skip, qrCodeData, xpubkey, verifyingPubkey, deviceInfo }) => {
          if (skip) return { skip }
          dialog.update({ message: t('UpdatingServer') })
          const data = {  
            link_code: qrCodeData.code,
            verifying_pubkey: verifyingPubkey,
            name: deviceInfo?.name,
            device_model: deviceInfo?.model,
            os: deviceInfo?.operatingSystem,
            device_id: deviceInfo?.uuid,
          }
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
          dialog.update({ title: t('DeviceLinked'), message: t('PosDeviceLinkedSuccessfully')})
        })
        .catch(error => {
          console.error(error)
          let message = t('FailedToUpdateServer')
          if (Array.isArray(error?.response?.data?.non_field_errors) && error?.response?.data?.non_field_errors?.length) {
            message = error?.response?.data?.non_field_errors.join('<br/>')
          }
          dialog.update({ title: t('LinkDeviceError'), message: message, html: true })
        })
        .then(() => {
          addressesStore.fillAddressSets()
        })
        .finally(() => dialog.update({ persistent: false, progress: false }))
    }

    return {
      walletStore,
      linkCodePrompt,
      toggleQrScanner,
      showQrScanner,
      linkToWallet,
      onQrDecode,
      onQrError,
    }
  },
})
</script>
