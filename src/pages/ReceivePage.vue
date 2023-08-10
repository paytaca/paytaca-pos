<template>
  <q-page padding>
    <MainHeader :title="title"/>
    <div class="text-center text-h4 q-mb-lg">
      <q-skeleton v-if="loading" type="text" width="5em" style="margin:auto;"/>
      <div v-if="!loading && !voucher" class="text-h6">#{{ addressSet?.index }}</div>
    </div>
    <q-banner v-if="paymentFrom !== 'paytaca' && !isOnline" class="bg-red text-white q-pa-md q-mx-md q-mb-md rounded-borders">
      <q-icon name="info" class="" size="1.5em">
        <q-popup-proxy :breakpoint="0">
          <div class="q-pa-md">
            Confirmation OTP might be unavailable for payments received from non-paytaca wallets.
          </div>
        </q-popup-proxy>
      </q-icon>
      Detected offline, confirming payments might be unavailable
    </q-banner>
    <div class="row items-center justify-center">
      <div class="qr-code-container" style="position:relative;" v-ripple @click="copyText(qrData, 'Copied payment URI')">
        <div v-if="loading"><q-skeleton height="200px" width="200px" /></div>
        <template v-else>
          <img src="~assets/bch-logo.png" height="50" class="qr-code-icon"/>
          <QRCode
            :text="qrData"
            color="#253933"
            :size="200"
            error-level="H"
            class="q-mb-sm"
            :style="qrData ? '' : 'opacity:0;'"
          />
        </template>
      </div>
    </div>
    <div v-if="!loading" class="text-center text-h5 q-my-lg q-px-lg full-width" @click="showSetAmountDialog()">
      <div v-if="receiveAmount">
        <div>{{ receiveAmount }} {{ currency }}</div>
        <div v-if="currency !== 'BCH' && !isNaN(bchValue)" class="text-caption text-grey">
          {{ bchValue }} BCH
        </div>
      </div>
      <div v-else class="text-red">{{ altAmountText }}</div>
      <!-- <q-popup-edit v-model="receiveAmount" v-slot="scope">
        <q-input
          label="Amount"
          type="number"
          v-model.number="scope.value"
          dense
          suffix="BCH"
          autofocus
          @keyup.enter="scope.set"
        />
      </q-popup-edit> -->
    </div>
    <div class="text-center text-h6 text-weight-light q-mt-lg q-mx-md q-px-lg" style="word-break:break-all;">
      <q-skeleton v-if="loading" height="3rem"/>
      <div v-else style="position:relative;" v-ripple @click="copyText(receivingAddress)">
        {{ receivingAddress }}
      </div>
    </div>
    <div v-if="canViewTransactionsReceived && !showOtpInput && !voucher" class="q-px-md q-mt-md">
      <div class="row items-center">
        <div class="q-space text-subtitle1">
          Transactions Received
        </div>
        <q-btn
          flat
          no-caps
          label="Input OTP"
          color="brandblue"
          padding="none md"
          style="text-decoration:underline;"
          @click="showOtpInput = true"
        />
      </div>
      <q-separator/>
      <template v-if="transactionsReceived?.length">
        <q-item
          v-for="(txReceived, index) in transactionsReceived"
          :key="index"
          clickable
          v-ripple
          @click="displayReceivedTransaction(txReceived)"
        >
          <q-item-section v-if="txReceived?.logo" side>
            <img :src="txReceived?.logo" height="25"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="ellipsis">
              {{ txReceived?.txid }}
            </q-item-label>
          </q-item-section>
          <q-item-section class="text-right">
            <q-item-label caption>
              {{ txReceived?.amount }} {{ txReceived?.tokenSymbol }}
            </q-item-label>
            <q-item-label v-if="txReceived?.marketValue?.amount && txReceived?.marketValue?.currency" caption>
              {{ txReceived?.marketValue?.amount }} {{ txReceived?.marketValue?.currency }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </template>
      <div v-else-if="receiveWebsocket?.readyState === 1" class="row items-center justify-center">
        <div class="text-grey text-center q-mt-xs">
          <q-spinner size="2rem"/>
          <div>Waiting payment ... </div>
        </div>
      </div>
      <div v-else>
        No transactions received
      </div>
    </div>
    <div v-if="(!canViewTransactionsReceived || showOtpInput) && !voucher" class="q-mt-lg q-px-md">
      <div v-if="canViewTransactionsReceived" class="row justify-end q-mb-sm">
        <q-btn flat no-caps padding="xs-sm" @click="showOtpInput = false">
            <q-icon name="arrow_back" size="1.25em" class="q-mr-sm"/>
            Received transactions
        </q-btn>
      </div>
      <q-input
        outlined
        label="Confirmation OTP"
        inputmode="numeric"
        mask="#-#-#-#-#-#"
        unmasked-value
        v-model="otpInput"
        hint="Input OTP sent to customer to verify payment"
        :bg-color="$q.dark.isActive ? 'dark' : 'white'"
        class="q-space text-h6"
      >
        <template v-slot:append>
          <q-btn
            no-caps
            color="primary"
            label="Verify"
            type="submit"
            class="q-my-md"
            @click="verifyOtp()"
          />
        </template>
      </q-input>
    </div>
  </q-page>
</template>
<script>
import { useWalletStore } from 'stores/wallet'
import { useTxCacheStore } from 'src/stores/tx-cache'
import { useAddressesStore } from 'stores/addresses'
import { useMarketStore } from 'src/stores/market'
import { defineComponent, ref, onMounted, computed, watch, onUnmounted, markRaw, inject, provide } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import QRCode from 'vue-qrcode-component'
import { decodePaymentUri, sha256 } from 'src/wallet/utils'
import MainHeader from 'src/components/MainHeader.vue'
import SetAmountFormDialog from 'src/components/SetAmountFormDialog.vue'
import ReceiveUpdateDialog from 'src/components/receive-page/ReceiveUpdateDialog.vue'

export default defineComponent({
  name: "ReceivePage",
  components: {
    QRCode,
    MainHeader
  },
  props: {
    paymentFrom: String, // paytaca | other
    setAmount: Number,
    setCurrency: String,
    lockAmount: Boolean, // should only work if setAmount is given
    voucher: Boolean,
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
  setup(props) {
    const $networkDetect = inject('$networkDetect')
    const isOnline = inject('$isOnline')
    const $q = useQuasar()
    const $router = useRouter()
    const walletStore = useWalletStore();
    const txCacheStore = useTxCacheStore();
    const marketStore = useMarketStore()

    const title = computed(() => props.voucher ? 'Claim Voucher' : 'Payment')
    const requireOtp = computed(() => props.paymentFrom === 'paytaca')
    const altAmountText = computed(() => {
      return props.voucher ? '' : 'Set Amount'
    })
    const vaultTokenAddress = ref(walletStore.merchantInfo?.vault?.tokenAddress)
    const receivingAddress = computed(() => {
      return (
        props.voucher ?
        vaultTokenAddress.value :
        addressSet.value?.receiving
      )
    })

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

    // not using computed to stop calculating immediately causing slight delay in changing page
    // this is due to usage of walletStore.walletObj
    const paymentUriLabel = ref('')
    onMounted(() => setTimeout(() => updatePaymentUriLabel(), 5))
    watch(() => [walletStore.walletHash, walletStore.posId], () => updatePaymentUriLabel())
    function updatePaymentUriLabel() {
      if (!walletStore.walletHash) paymentUriLabel.value = ''
      else paymentUriLabel.value = `${walletStore.walletHash}-${walletStore.posId}`
    }

    const receiveAmount = ref(0)
    const currency = ref('BCH')
    const disableAmount = ref(false)

    const currencyRateUpdateRate = 60 * 1000
    const currencyBchRate = computed(() => {
      if (!currency.value) return
      if (currency.value === 'BCH') return { currency: 'BCH', rate: 1, timestamp: Date.now() }
      return marketStore.getRate(currency.value)
    })
    const currencyBchRateUpdateInterval = ref(null)
    // 0.02ms - 0.026ms
    onMounted(() => {
      clearTimeout(currencyBchRateUpdateInterval.value)
      currencyBchRateUpdateInterval.value = setInterval(
        () => updateSelectedCurrencyRate(), currencyRateUpdateRate)
      updateSelectedCurrencyRate()
    })
    onUnmounted(() => clearInterval(currencyBchRateUpdateInterval.value))
    watch(currency, () => updateSelectedCurrencyRate())
    function updateSelectedCurrencyRate() {
      if (!currency.value || currency.value === 'BCH') return
      marketStore.refreshBchPrice(currency.value, { age: currencyRateUpdateRate })
    }

    const bchValue = computed(() => {
      if (!currency.value || currency.value === 'BCH') return receiveAmount.value
      const rateValue = currencyBchRate.value?.rate
      return Number((receiveAmount.value / rateValue).toFixed(8))
    })
    // 0.015ms - 0.031ms
    onMounted(() => {
      if (props.setAmount) receiveAmount.value = props.setAmount
      if (props.setCurrency) currency.value = props.setCurrency

      if (props.setAmount && props.lockAmount) disableAmount.value = true
    })
    function showSetAmountDialog(opts={force:false}) {
      if (disableAmount.value && !opts?.force) return

      let currencies = ['BCH']
      if (props.paymentFrom === 'paytaca') currencies = ['BCH', 'PHP']
      $q.dialog({
        component: SetAmountFormDialog,
        componentProps: {
          currencies: currencies,
          initialValue: { amount: receiveAmount.value, currency: currency.value }
        }
      }).onOk(data => {
        receiveAmount.value = data?.value
        currency.value = data?.currency || 'BCH'
      })
    }

    const qrData = computed(() => {
      if (!receiveAmount.value && !props.voucher) return ''
      if (props.paymentFrom === 'paytaca') return qrDataforPaytaca.value
      return qrDataForOtherWallets.value
    })

    const qrDataForOtherWallets = computed(() => {
      // QR data is a BIP0021 compliant
      // BIP0021 is a URI scheme for bitcoin payments

      if (props.voucher) {
        let paymentUri = vaultTokenAddress.value
        paymentUri += `?POS=${paymentUriLabel.value}`
        paymentUri += `&ts=${Math.floor(Date.now()/1000)}`
        return paymentUri
      }

      if (!addressSet.value?.receiving) return ''
      if (!paymentUriLabel.value) return ''

      let paymentUri = addressSet.value?.receiving
      paymentUri += `?POS=${paymentUriLabel.value}`

      if (!bchValue.value) return ''
      paymentUri += `&amount=${bchValue.value}`

      paymentUri += `&ts=${Math.floor(Date.now()/1000)}`
      return paymentUri
    })

    const qrDataforPaytaca = computed(() => {
      if (!addressSet.value?.receiving) return ''
      if (!paymentUriLabel.value) return ''
      let paymentUri = `paytaca:`
      paymentUri += addressSet.value?.receiving.replace('bitcoincash:', '')

      if (receiveAmount.value) {
        let amount = receiveAmount.value
        if (currency.value && currency.value != 'BCH') {
          amount = `${currency.value}:${amount}`
        }
        paymentUri += `@${amount}`
      }

      paymentUri += `?POS=${paymentUriLabel.value}&ts=${Math.floor(Date.now()/1000)}`
      return paymentUri
    })
    function cacheQrData() {
      // walletStore.cacheQrData(qrData.value)
      walletStore.removeOldQrDataCache(86400*2) // remove qr data older than 2 days
    }
    watch(qrData, () => cacheQrData())
    onMounted(() => cacheQrData())

    const otpInput = ref('')
    const showOtpInput = ref(true)
    function verifyOtp() {
      if (otpInput.value.length < 6) return
      const _qrData = qrData.value
      const match = walletStore.verifyOtpForQrData(otpInput.value, _qrData)
      const decodedQrData = decodePaymentUri(_qrData)

      $q.dialog({
        title: 'OTP verification',
        message: match ? 'OTP match. Payment has been verified!' : 'OTP incorrect. Failed to verify the payment!',
      })
        .onDismiss(() => {
          if (match) {
            otpInput.value = ''
            receiveAmount.value = 0
            const qrDataHash = sha256(_qrData)
            txCacheStore.addQrDataToUnconfirmedPayments(walletStore.qrDataTimestampCache[qrDataHash]?.qrData || _qrData)
            addressesStore.removeAddressSet(decodedQrData.address)
            addressesStore.fillAddressSets()

            delete walletStore.qrDataTimestampCache[qrDataHash]
            $router.push({ name: 'home' })
          }
        })
      }
      
    const receiveWebsocket = ref({ readyState: 0 })
    const enableReconnect = ref(true)
    const reconnectAttempts = ref(5)
    const reconnectTimeout = ref(null)
    const transactionsReceived = ref([])
    const canViewTransactionsReceived = computed(() => {
      return transactionsReceived.value?.length || receiveWebsocket.value?.readyState === 1
    })
    watch(addressSet, () => setupListener({ resetAttempts: true }))
    // 0.4ms - 0.5ms
    onMounted(() => addressSet.value?.receiving ? setupListener() : null)
    watch(isOnline, () => {
      if (isOnline.value) {
        setupListener({ resetAttempts: true })
      } else {
        receiveWebsocket.value?.close()
        receiveWebsocket.value = null // for reactivity
      }
    })
    onUnmounted(() => {
      enableReconnect.value = false
      receiveWebsocket.value?.close?.()
      receiveWebsocket.value = null
      clearTimeout(reconnectTimeout.value)
    })
    function setupListener(opts) {
      receiveWebsocket.value?.close?.()
      receiveWebsocket.value = null // for reactivity
      const address = props.voucher ? vaultTokenAddress.value : addressSet.value?.receiving
      if (!address) return
      // const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `wss://watchtower.cash/ws/watch/bch/${address}/`

      console.log('Connecting ws:', url)
      const websocket = new WebSocket(url)
      if (opts?.resetAttempts) reconnectAttempts.value = 5

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
        showOtpInput.value = false
      })
    }
    function onWebsocketReceive(data) {
      console.log(data)
      if (!data?.amount) return
      const parsedData = parseWebsocketDataReceived(data)
      transactionsReceived.value.push(parsedData)
      displayReceivedTransaction(parsedData)
      showOtpInput.value = false
    }

    /**
     * @param {Object} data 
     * @param {String} data.token_name
     * @param {String} data.token_id
     * @param {String} data.token_symbol
     * @param {Number} data.amount
     * @param {String} data.address
     * @param {String} data.source
     * @param {String} data.txid
     * @param {Number} data.index
     * @param {String} data.address_path
     * @param {String[]} data.senders
     */
    function parseWebsocketDataReceived(data) {
      const marketValue = { amount: 0, currency: '' }
      if (data?.tokenSymbol === 'BCH' && currencyBchRate.value.rate) {
        marketValue.amount = Number(
          (Number(data?.amount) * currencyBchRate.value.rate).toFixed(3)
        )
        marketValue.currency = currencyBchRate.value.currency
      }
      const response = {
        amount: data?.amount,
        marketValue: marketValue,
        txid: data?.txid,
        index: data?.index,
        address: data?.address,
        tokenName: data?.token_name,
        tokenId: data?.token_id,
        tokenSymbol: data?.token_symbol,
        addressPath: data?.address_path,
        senders: Array.isArray(data?.senders) ? data?.senders : [],
        source: data?.source,
        logo: null,
      }

      if (typeof response.tokenSymbol === 'string') response.tokenSymbol = response.tokenSymbol.toUpperCase()
      if (response.tokenSymbol === 'BCH') response.logo = 'bch-logo.png'
      return response
    }

    function displayReceivedTransaction (data) {
      const _qrData = qrData.value
      let marketValue = data?.marketValue || { amount: 0, currency: '' }
      if (!marketValue?.amount || !marketValue?.currency) {
        if (data?.tokenSymbol === 'BCH' && currencyBchRate.value.rate) {
          marketValue.amount = Number(
            (Number(data?.amount) * currencyBchRate.value.rate).toFixed(3)
          )
          marketValue.currency = currencyBchRate.value.currency
        }
      }
      $q.dialog({
        component: ReceiveUpdateDialog,
        componentProps: {
          txid: data?.txid,
          address: data?.address,
          amount: data?.amount,
          tokenCurrency: data?.tokenSymbol,
          marketValue: marketValue.amount,
          marketValueCurrency: marketValue.currency,
          logo: data?.logo,
        }
      })
        .onOk(() => {
          otpInput.value = ''
          receiveAmount.value = 0
          transactionsReceived.value = []
          const qrDataHash = sha256(_qrData)
          delete walletStore.qrDataTimestampCache[qrDataHash]

          addressesStore.removeAddressSet(data?.address)
          addressesStore.fillAddressSets()
          $router.push({ name: 'home' })
        })
    }

    const promptOnLeave = ref(true)
    onBeforeRouteLeave(async (to, from, next) => {
      if (!qrData.value || !promptOnLeave.value) return next()
      if (!requireOtp.value) return next()

      const proceed = await new Promise((resolve) => {
        $q.dialog({
          title: 'Leave Page',
          message: 'Leaving page without confirming payment OTP. Are you sure?',
          cancel: true,
          ok: true,
        }).onOk(() => resolve(true)).onDismiss(() => resolve(false))
      })
      return next(proceed)
    })

    onMounted(() => {
      if (!isOnline.value && props.paymentFrom !== 'paytaca') {
        $networkDetect.check()
          .then(_isOnline => {
            console.log('Detected isOnline:', _isOnline)
            if (!_isOnline) {
              $q.dialog({
                title: 'Detected offline',
                message: 'Detected device is offline. Leaving page',
                ok: true,
              })
                .onDismiss(() => $router.go(-1))
            }
          })
      }
    })

    return {
      isOnline,
      txCacheStore,
      requireOtp,
      addressSet,
      loading,
      generatingAddress,
      receiveAmount,
      currency,
      disableAmount,
      currencyBchRate,
      bchValue,
      showSetAmountDialog,
      qrData,
      otpInput,
      showOtpInput,
      verifyOtp,
      receiveWebsocket,
      transactionsReceived,
      canViewTransactionsReceived,
      displayReceivedTransaction,
      title,
      altAmountText,
      receivingAddress,
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
  background-color: white;

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
