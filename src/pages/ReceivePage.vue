<template>
  <q-page padding>
    <div class="text-center text-h4 q-my-lg">
      <div>Payment</div>
      <q-skeleton v-if="loading" type="text" width="5em" style="margin:auto;"/>
      <div v-else class="text-body1">#{{ addressSet?.index }}</div>
    </div>
    <div class="row items-center justify-center">
      <div class="qr-code-container" style="position:relative;" v-ripple @click="copyText(qrData, 'Copied payment URI')">
        <div v-if="loading">
          <q-skeleton height="200px" width="200px" />
        </div>
        <template v-else>
          <img src="~assets/paytaca_logo.png" height="50" class="qr-code-icon"/>
          <QRCode :text="qrData" color="#253933" :size="200" error-level="H" class="q-mb-sm"/>
        </template>
      </div>
    </div>
    <div v-if="!loading" class="text-center text-h5 q-my-lg q-px-lg full-width">
      <div v-if="receiveAmount">{{ receiveAmount }} BCH</div>
      <div v-else class="text-red">Set amount</div>
      <q-popup-edit v-model="receiveAmount" v-slot="scope">
        <q-input
          label="Amount"
          type="number"
          v-model.number="scope.value"
          dense
          suffix="BCH"
          autofocus
          @keyup.enter="scope.set"
        />
      </q-popup-edit>
    </div>
    <div class="text-center text-h6 text-weight-light q-mt-lg q-mx-md q-px-lg" style="word-break:break-all;">
      <q-skeleton v-if="loading" height="3rem"/>
      <div v-else style="position:relative;" v-ripple @click="copyText(addressSet?.receiving)">
        {{ addressSet?.receiving }}
      </div>
    </div>
    <div class="q-mt-lg q-px-md">
      <q-form @submit="verifyOtp()">
        <q-input
          outlined
          label="Confirmation OTP"
          inputmode="numeric"
          mask="#-#-#-#-#-#"
          unmasked-value
          v-model="otpInput"
          hint="Input OTP from payer"
          class="q-space"
        />
        <q-btn
          no-caps
          color="primary"
          label="Verify"
          type="submit"
          class="q-my-md"
        />
      </q-form>
    </div>
  </q-page>
</template>
<script>
import { useWalletStore } from 'stores/wallet'
import { useAddressesStore } from 'stores/addresses'
import { defineComponent, ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import QRCode from 'vue-qrcode-component'

export default defineComponent({
    name: "ReceivePage",
    components: {
      QRCode,
    },
    methods: {
      copyText(value, message='Copied address') {
        this.$copyText(value)
          .then(() => {
            this.$q.notify({
              message: message || 'Copied to clipboard',
              timeout: 800,
              icon: 'mdi-clipboard-check',
              color: 'blue-9'
            })
          })
          .catch(() => {})
      }
    },
    setup() {
      const $q = useQuasar()
      const walletStore = useWalletStore();
      const wallet = ref(walletStore.walletObj);

      const addressesStore = useAddressesStore()
      const generatingAddress = ref(false)
      onMounted(() => {
        generatingAddress.value = true
        addressesStore.fillAddressSets()
          .finally(() => {
            generatingAddress.value = false
          })
      })

      const addressSet = computed(() => addressesStore.currentAddressSet)
      const loading = computed(() => generatingAddress.value && !addressSet.value?.receiving)

      const paymentUriLabel = computed(() => {
        return `${wallet.value.walletHash}-${wallet.value.posId}`
      })

      const receiveAmount = ref(0)
      const qrData = computed(() => {
        // QR data is a BIP0021 compliant
        // BIP0021 is a URI scheme for bitcoin payments
        if (!addressSet.value?.receiving || !receiveAmount.value) return ''
        let paymentUri = addressSet.value?.receiving

        paymentUri += `?POS=${paymentUriLabel.value}`

        if (receiveAmount.value) paymentUri += `&amount=${receiveAmount.value}`
        return paymentUri
      })

      const otpInput = ref('')
      const verifyingOtp = ref(false)
      function verifyOtp() {
        if (otpInput.value.length < 6) return

        verifyingOtp.value = true
        wallet.value.checkOTP(otpInput.value)
          .then(response => {
            const match = response?.valid
            if (!match) console.log('OTP mismatch for ', otpInput.value, '. Valid otps:', response.otps)
            $q.dialog({
              title: 'OTP verification',
              message: match ? 'OTP match' : 'OTP incorrect',
            })
              .onDismiss(() => {
                if (match) {
                  otpInput.value = ''
                  receiveAmount.value = 0
                  addressesStore.dequeueAddress()
                  addressesStore.fillAddressSets()
                }
              })
          })
          .finally(() => {
            verifyOtp.value = false
          })
      }

      return {
        wallet,
        addressSet,
        loading,
        generatingAddress,
        receiveAmount,
        qrData,
        otpInput,
        verifyOtp,
      }
    },
})
</script>
<style scoped>
.qr-code-container {
  position:relative;

  display: flex;
  justify-content: center;
  align-content: center;

  border-radius: 16px;
  border: 4px solid #ed5f59;

  padding: 1.8rem 2.1rem;
}

.qr-code-container > .qr-code-icon {
  background-color: white;
  border-radius: 10000px;

  /* absolute center */
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}
</style>