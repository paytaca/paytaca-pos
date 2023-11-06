<template>
  <q-page padding>
    <MainHeader title="Payment"/>
    <div class="text-center text-h4 q-mb-lg">
      <q-skeleton v-if="loading" type="text" width="5em" style="margin:auto;"/>
      <div v-if="!loading" class="text-h6">#{{ addressSet?.index }}</div>
    </div>
    <q-banner v-if="!isOnline" class="bg-red text-white q-pa-md q-mx-md q-mb-md rounded-borders">
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
      </q-popup-edit>-->
    </div>
    <div v-if="canViewTransactionsReceived && !showOtpInput" class="q-px-md q-mt-md">
      <div class="row items-center">
        <div class="q-space text-subtitle1">
          Payment Transactions
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
      <div v-else-if="websocketsReady" class="row items-center justify-center">
        <div class="text-grey text-center q-mt-xs q-pt-xs">
          <q-spinner size="30px"/>
          <div>Waiting for payment ... </div>
        </div>
      </div>
      <div v-else>
        No transactions received
      </div>
    </div>
    <div v-if="!canViewTransactionsReceived || showOtpInput" class="q-mt-lg q-px-md">
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
import { Vault } from 'src/contracts/purelypeer/vault'
import axios from 'axios'

export default defineComponent({
  name: "ReceivePage",
  components: {
    QRCode,
    MainHeader
  },
  props: {
    setAmount: Number,
    setCurrency: String,
    lockAmount: Boolean, // should only work if setAmount is given
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
    const walletStore = useWalletStore()
    const txCacheStore = useTxCacheStore()
    const marketStore = useMarketStore()
    const addressesStore = useAddressesStore()

    const addressSet = computed(() => addressesStore.currentAddressSet)
    const loading = computed(() => generatingAddress.value && !addressSet.value?.receiving)

    const receivingAddress = addressSet.value?.receiving
    const vault = ref(walletStore.merchantInfo?.vault)
    const generatingAddress = ref(false)

    onMounted(() => {
      generatingAddress.value = true
      addressesStore.fillAddressSets()
        .finally(() => {
          generatingAddress.value = false
        })
    })

    // not using computed to stop calculating immediately causing slight delay in changing page
    // this is due to usage of walletStore.walletObj
    const posId = ref(-1)
    onMounted(() => setTimeout(() => updatePaymentUriLabel(), 5))
    watch(() => [walletStore.walletHash, walletStore.posId], () => updatePaymentUriLabel())
    function updatePaymentUriLabel() {
      posId.value = walletStore.posId
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

      const currencies = ['BCH']
      $q.dialog({
        component: SetAmountFormDialog,
        componentProps: {
          currencies,
          initialValue: { amount: receiveAmount.value, currency: currency.value }
        }
      }).onOk(data => {
        receiveAmount.value = data?.value
        currency.value = data?.currency || 'BCH'
      })
    }

    const qrData = computed(() => {
      if (!receiveAmount.value) return ''
      
      const merchantVaultTokenAddress = vault.value?.tokenAddress
      const merchantReceivingAddress = vault.value?.receiving?.address
      const timestamp = Math.floor(Date.now() / 1000)

      let paymentUri = receivingAddress
      paymentUri += `?POS=${posId.value}`
      paymentUri += `&amount=${bchValue.value}`
      paymentUri += `&vault=${merchantVaultTokenAddress}`    // recipient of voucher NFT
      paymentUri += `&merchant=${merchantReceivingAddress}`  // recipient of voucher BCH (always 0th index of merchant wallet)
      paymentUri += `&ts=${timestamp}`

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
    
    const reconnectAttempts = 10000
    const websocketUrl = 'wss://watchtower.cash/ws/watch/bch'
    const merchantReceivingAddress = addressSet.value?.receiving
    const vaultTokenAddress = vault.value?.address
    const websockets = ref([
      // receiving address
      {
        instance: { readyState: 0 },
        url: `${websocketUrl}/${merchantReceivingAddress}/`,
        reconnectAttempts,
      },
      // vault token address
      {
        instance: { readyState: 0 },
        url: `${websocketUrl}/${vaultTokenAddress}/`,
        reconnectAttempts,
      }
    ])
    const websocketsReady = computed(() => {
      const readySockets = websockets.value.filter((websocket) => websocket.instance?.readyState === 1)
      return readySockets.length === websockets.value.length
    })
    const enableReconnect = ref(true)
    const reconnectTimeout = ref(null)
    const transactionsReceived = ref([])
    const canViewTransactionsReceived = computed(() => {
      return transactionsReceived.value?.length || websocketsReady.value
    })

    // close existing websocket in case it exists
    function closeWebsocket () {
      websockets.value.forEach(ws => {
        ws?.close?.()
        ws = null
      })
    }

    watch(addressSet, () => setupListener({ resetAttempts: true }))

    // 0.4ms - 0.5ms
    onMounted(() => addressSet.value?.receiving ? setupListener() : null)
    watch(isOnline, () => {
      if (isOnline.value) {
        setupListener({ resetAttempts: true })
      } else {
        closeWebsocket()
      }
    })
    onUnmounted(() => {
      enableReconnect.value = false
      closeWebsocket()
      clearTimeout(reconnectTimeout.value)
    })
    function setupListener(opts) {
      closeWebsocket()

      const merchantReceivingAddress = addressSet.value?.receiving
      const vaultTokenAddress = vault.value?.address
      
      if (!merchantReceivingAddress && !vaultTokenAddress) return

      for (let x = 0; x < websockets.value.length; x++) {
        const url = websockets.value[x].url
        const websocket = new WebSocket(url)
        console.log(`Connecting ws: ${url}`)
        
        if (opts?.resetAttempts) websockets.value[x].reconnectAttempts = 10000

        websocket.addEventListener('close', () => {
          console.log('setupListener:', 'Listener closed')
          if (!enableReconnect.value) return console.log('setupListener:', 'Skipping reconnection')

          if (websockets.value[x].reconnectAttempts.value <= 0)
            return console.log('setupListener:', 'Reached reconnection attempts limit')

          websockets.value[x].reconnectAttempts.value--;

          const reconnectInterval = 5000
          const reconnectIntervalSeconds = reconnectInterval / 1000
          const reconnectAttemptsLeft = websockets.value[x].reconnectAttempts.value
          let reconnectingLog = `Attempting websocket for (${url}) reconnection after ${reconnectIntervalSeconds} seconds.`
          reconnectingLog += `retries left: ${reconnectAttemptsLeft}`

          clearTimeout(reconnectTimeout.value)
          reconnectTimeout.value = setTimeout(() => setupListener(), reconnectInterval)
        })

        websocket.addEventListener('message', message => {
          const data = JSON.parse(message.data)
          onWebsocketReceive(data)
        })

        websocket.addEventListener('open', () => {
          closeWebsocket()
          websockets.value[x].instance = markRaw(websocket)
          showOtpInput.value = false
        })
      }
    }
    function flagVoucher (txid, category) {
      const payload = { txid, category: category }

      if (props.paymentFrom === 'purelypeer') {
        const prefix = process.env.NODE_ENV === 'production' ? '' : 'staging.'
        const purelypeerClaimUrl = `https://${prefix}purelypeer.cash/api/key_nfts/claimed/`
        const headers = {
          headers: {
            'purelypeer-proof-auth-header': process.env.PURELYPEER_HEADER_VALUE
          }
        }

        axios.post(
          purelypeerClaimUrl,
          payload,
          headers
        ).then(
          response => console.log('Updated purelypeer backend regarding claim: ', response)
        ).catch(
          err => console.error('Error on updating purelypeer backend regarding claim: ', err)
        )
      }

      const watchtowerVoucherFlagUrl = 'https://watchtower.cash/api/vouchers/claimed/'

      axios.post(
        watchtowerVoucherFlagUrl,
        payload
      ).then(
        response => console.log('Updated watchtower regarding claim: ', response)
      ).catch(
        err => console.error('Error on updating watchtower regarding claim: ', err)
      )
    }
    function updateClaimTxnAttr (txid) {
      const payload = {
        txid,
        wallet_hash: walletStore.merchantInfo?.walletHash,
        key: "voucher_claim",
        value: "Voucher Claim",
        remove: false
      }
      const watchtowerTxnAttrUrl = 'https://watchtower.cash/api/transactions/attributes/'
      axios.post(watchtowerTxnAttrUrl, payload)
        .then(response => console.log('Added transaction attribute as voucher claim: ', response))
        .catch(err => console.log('Error on adding transaction attribute as voucher claim: ', err))
    }
    function checkVoucherClaim (data) {
      if (!data.voucher) return

      const merchantVault = walletStore.merchantInfo?.vault
      const merchantReceivingPk = merchantVault?.receiving?.pubkey
      const merchantReceivingAddress = merchantVault?.receiving?.address
      const merchantSignerPk = merchantVault?.signer?.pubkey

      const vaultParams = {
        params: {
          merchantReceivingPk,
          merchantSignerPk,
        },
        options: {
          network: 'mainnet'
        }
      }

      const __vault = new Vault(vaultParams)
      const category = data.voucher

      __vault.claim({
        category,
        merchantReceivingAddress
      })
      .then(transaction => {
        $q.notify({
          message: 'Voucher claimed!',
          timeout: 1500,
          icon: 'mdi-check-circle',
          color: 'green-6'
        })

        const txid = transaction.txid
        flagVoucher(txid, category)
        updateClaimTxnAttr(txid)
      })
    }
    function onWebsocketReceive(data) {
      console.log(data)
      
      if (!data?.value) return

      const parsedData = parseWebsocketDataReceived(data)
      if (parsedData.voucher) checkVoucherClaim(parsedData)

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
     * @param {Number} data.value
     * @param {String} data.address
     * @param {String} data.source
     * @param {String} data.txid
     * @param {Number} data.index
     * @param {String} data.address_path
     * @param {String[]} data.senders
     * 
     * @param {Object} data.voucher
     * @param {Boolean} data.voucher.is_key_nft
     * @param {String} data.voucher.lock_nft_category
     *
     */
    function parseWebsocketDataReceived(data) {
      const marketValue = { amount: 0, currency: '' }
      if (data?.tokenSymbol === 'BCH' && currencyBchRate.value.rate) {
        marketValue.amount = Number(
          (Number(data?.value) * currencyBchRate.value.rate).toFixed(3)
        )
        marketValue.currency = currencyBchRate.value.currency
      }
      const response = {
        amount: data?.amount,
        value: data?.value,
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
        voucher: data?.voucher,
      }

      if (!response?.amount && response?.value) response.amount = Math.round(response?.value) / 10 ** 8
      if (typeof response.tokenSymbol === 'string') response.tokenSymbol = response.tokenSymbol.toUpperCase()
      if (response.tokenSymbol === 'BCH') response.logo = 'bch-logo.png'
      return response
    }

    function displayReceivedTransaction (data) {
      const _qrData = qrData.value
      let marketValue = data?.marketValue || { amount: 0, currency: '' }
      const value = data?.value / 1e8
      if (!marketValue?.amount || !marketValue?.currency) {
        if (data?.tokenSymbol === 'BCH' && currencyBchRate.value.rate) {
          marketValue.amount = Number(
            (Number(value) * currencyBchRate.value.rate).toFixed(3)
          )
          marketValue.currency = currencyBchRate.value.currency
        }
      }
      $q.dialog({
        component: ReceiveUpdateDialog,
        componentProps: {
          txid: data?.txid,
          address: data?.address,
          amount: value,
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
      websockets,
      websocketsReady,
      transactionsReceived,
      canViewTransactionsReceived,
      displayReceivedTransaction,
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
