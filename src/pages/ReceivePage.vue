<template>
  <q-page padding>
    <MainHeader title="Payment"/>
    <div class="text-center text-h4" style="margin-bottom: 50px;">
      <q-skeleton v-if="loading" type="text" width="5em" style="margin:auto;"/>
      <!-- <div v-if="!loading" class="text-h6">#{{ addressSet?.index }}</div> -->
    </div>
    <q-banner v-if="!isOnline" class="bg-red text-white q-pa-md q-mx-md q-mb-lg rounded-borders">
      The app offline, you will not receive payment notifications.
    </q-banner>
    <div class="row items-center justify-center">
      <div
        class="qr-code-container"
        :class="paid ? 'bg-dark border-green' : 'border-red'"
        style="position:relative;"
        v-ripple
        @click="copyText(qrData, 'Copied payment URI')"
      >
        <div v-if="loading"><q-skeleton height="200px" width="200px" /></div>
        <div v-if="paid" class="bg-dark">
          <img src="~assets/success-check.gif" height="200" />
        </div>
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

    <div v-if="canViewTransactionsReceived" class="q-px-md q-mt-md">
      <div class="row items-center">
        <div class="q-space text-subtitle1">
          Payments
        </div>
        <div class="text-caption">
          <div v-if="paid" class="text-green">Payment Complete</div>
          <div v-else style="color: #ed5f59">
            {{ remainingPaymentRounded }} BCH left
            <q-btn v-if="showRemainingCurrencyAmount" color="grey" icon="info" flat size="xs" class="q-px-xs" style="width: 20px">
              <q-menu>
                <q-list style="min-width: 100px">
                  <q-item clickable v-close-popup>
                    <q-item-section>{{ currencyAmountRemaining }} {{ currency }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </div>
      </div>

      <div>
        <q-linear-progress
          :value="paymentProgress"
          class="text-brandblue q-mb-md q-px-xl"
        />
      </div>

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
  </q-page>
</template>
<script>
import { useWalletStore } from 'stores/wallet'
import { usePaymentsStore } from 'stores/payments'
import { useTxCacheStore } from 'src/stores/tx-cache'
import { useAddressesStore } from 'stores/addresses'
import { useMarketStore } from 'src/stores/market'
import { defineComponent, ref, onMounted, computed, watch, onUnmounted, markRaw, inject, provide } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import QRCode from 'vue-qrcode-component'
import { sha256 } from 'src/wallet/utils'
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
    const paymentsStore = usePaymentsStore()

    const addressSet = computed(() => addressesStore.currentAddressSet)
    const loading = computed(() => generatingAddress.value && !addressSet.value?.receiving)
    
    const paymentProgress = computed(() => paymentsStore.paid / paymentsStore.total)
    const remainingPayment = computed(() => {
      const remaining = paymentsStore.total - paymentsStore.paid
      if (remaining < 0) return 0
      return remaining
    })
    const remainingPaymentRounded = computed(() => Number(remainingPayment.value.toFixed(8)))
    const paid = computed(() => remainingPayment.value === 0)

    const receivingAddress = addressSet.value?.receiving
    const vault = ref(walletStore.merchantInfo?.vault)
    const generatingAddress = ref(false)
    const promptOnLeave = ref(true)

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
    const currencyAmountRemaining = computed(() => {
      const currencyRemaining = currencyBchRate?.value?.rate * remainingPaymentRounded.value
      return Number(currencyRemaining.toFixed(2))
    })
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

    const showRemainingCurrencyAmount = computed(() => {
      return currency.value !== 'BCH' && !paid.value
    })

    const bchValue = computed(() => {
      if (!currency.value || currency.value === 'BCH') {
        paymentsStore.setTotalPayment(receiveAmount.value)
        return receiveAmount.value
      }

      const rateValue = currencyBchRate.value?.rate
      const finalBchValue = Number((receiveAmount.value / rateValue).toFixed(8))
      paymentsStore.setTotalPayment(finalBchValue)
      return finalBchValue
    })

    // 0.015ms - 0.031ms
    onMounted(() => {
      paymentsStore.resetPayment()

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

      const merchantVaultTokenAddress = vault.value?.tokenAddress?.split?.(':')?.[1]
      const timestamp = Math.floor(Date.now() / 1000)

      let paymentUri = receivingAddress
      paymentUri += `?POS=${posId.value}`
      paymentUri += `&amount=${bchValue.value}`
      paymentUri += `&vault=${merchantVaultTokenAddress}`    // recipient of voucher NFT
      paymentUri += `&ts=${timestamp}`

      return paymentUri
    })

    function cacheQrData() {
      // walletStore.cacheQrData(qrData.value)
      walletStore.removeOldQrDataCache(86400*2) // remove qr data older than 2 days
    }
    watch(qrData, () => cacheQrData())
    onMounted(() => cacheQrData())
    
    const websocketUrl = `${process.env.WATCHTOWER_WEBSOCKET}/watch/bch`
    const merchantReceivingAddress = addressSet.value?.receiving
    const voucherClaimerAddress  = vault.value?.receiving?.address
    const vaultTokenAddress = vault.value?.address
    const websocketInits = [
      {
        instance: { readyState: 0 },
        url: `${websocketUrl}/${merchantReceivingAddress}/`,
      },
      {
        instance: { readyState: 0 },
        url: `${websocketUrl}/${vaultTokenAddress}/`,
      },
      {
        instance: { readyState: 0 },
        url: `${websocketUrl}/${voucherClaimerAddress}/`,
      },
    ]
    const isZerothAddress = voucherClaimerAddress === merchantReceivingAddress
    const websockets = ref(isZerothAddress ? websocketInits.slice(0,2) : websocketInits)
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
      for (let x = 0; x < websockets.value.length; x++) {
        websockets.value[x].instance?.close()
        websockets.value[x].instance = null
      }
    }

    watch(addressSet, () => setupListener())
    watch(paid, (newVal) => { if (newVal) closeWebsocket() })

    // 0.4ms - 0.5ms
    onMounted(() => addressSet.value?.receiving ? setupListener() : null)
    watch(isOnline, () => {
      if (isOnline.value) {
        setupListener()
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
      const merchantReceivingAddress = addressSet.value?.receiving
      const vaultTokenAddress = vault.value?.address
      
      if (!merchantReceivingAddress && !vaultTokenAddress) return

      for (let x = 0; x < websockets.value.length; x++) {
        const url = websockets.value[x].url
        const websocket = new WebSocket(url)
        console.log(`Connecting receiving page ws: ${url}`)

        websocket.addEventListener('close', () => {
          if (paid.value) return
 
          console.log('Listener closed: ', url)
          if (!enableReconnect.value) return console.log('Skipping reconnection: ', url)

          const reconnectInterval = 5000
          const reconnectIntervalSeconds = reconnectInterval / 1000
          const reconnectingLog = `Attempting websocket for (${url}) reconnection after ${reconnectIntervalSeconds} seconds.`
          console.log(reconnectingLog)

          clearTimeout(reconnectTimeout.value)
          reconnectTimeout.value = setTimeout(() => setupListener(), reconnectInterval)
        })

        websocket.addEventListener('message', message => {
          const data = JSON.parse(message.data)
          onWebsocketReceive(data)
        })

        websocket.addEventListener('open', () => {
          websockets.value[x].instance = markRaw(websocket)
        })
      }
    }
    function flagVoucher (txid, category) {
      const payload = { txid, category: category }

      // for purelypeer only
      const prefix = process.env.NODE_ENV === 'production' ? 'backend' : 'backend-staging'
      const purelypeerClaimUrl = `https://${prefix}.purelypeer.cash/api/key_nfts/claimed/`
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

      const watchtowerVoucherFlagUrl = `${process.env.WATCHTOWER_API}/vouchers/claimed/`

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
      const posId = walletStore.posId
      const key = `voucher_claim_${posId}`

      const payload = {
        wallet_hash: walletStore.merchantInfo?.walletHash,
        value: "Voucher Claim",
        remove: false,
        txid,
        key
      }
      const watchtowerTxnAttrUrl = `${process.env.WATCHTOWER_API}/transactions/attributes/`
      axios.post(watchtowerTxnAttrUrl, payload)
        .then(response => console.log('Added transaction attribute as voucher claim: ', response))
        .catch(err => console.log('Error on adding transaction attribute as voucher claim: ', err))
    }
    function checkVoucherClaim (data) {
      if (!data.voucher) return

      const merchantReceiverPk = vault.value?.receiving?.pubkey
      const voucherClaimerAddress = vault.value?.receiving?.address

      const vaultParams = {
        params: {
          merchantReceiverPk,
        },
        options: {
          network: 'mainnet'
        }
      }

      const __vault = new Vault(vaultParams)
      const category = data.voucher
      const claimPayload = {
        category,
        voucherClaimerAddress
      }

      __vault.claim(claimPayload)
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
      checkVoucherClaim(parsedData)

      if (parsedData.tokenName === 'bch') {
        const paidBchValue = data.value / 1e8
        const paidBch = Number((paidBchValue).toFixed(8))
        paymentsStore.addPayment(paidBch)
        
        promptOnLeave.value = false
        console.log('on websocket received: ', promptOnLeave.value)
        displayReceivedTransaction(parsedData)
      }
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
     * @param {String} data.voucher
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
      if (data?.voucher) return

      if(!transactionsReceived.value?.includes?.(data)) {
        transactionsReceived.value?.push?.(data)
      }

      console.log('transactions received: ', transactionsReceived.value)

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
          receiveAmount.value = 0
          transactionsReceived.value = []
          promptOnLeave.value = false

          const qrDataHash = sha256(_qrData)
          delete walletStore.qrDataTimestampCache[qrDataHash]

          addressesStore.removeAddressSet(data?.address)
          addressesStore.fillAddressSets()
          $router.push({ name: 'home' })
        })
    }

    onBeforeRouteLeave(async (to, from, next) => {
      if (!qrData.value || !promptOnLeave.value) return next()
      const isPaid = remainingPaymentRounded.value < 1000 / 1e8 // provide margin
      if (promptOnLeave.value && !isPaid) {
        const proceed = await new Promise((resolve) => {
          $q.dialog({
            title: 'Leave Page',
            message: 'Are you sure you want to leave this page without receiving a payment?',
            cancel: true,
            ok: true,
            color: 'brandblue',
          }).onOk(() => resolve(true)).onDismiss(() => resolve(false))
        })
        return next(proceed)
      } else {
        return next()
      }
    })

    onMounted(() => {
      if (!isOnline.value) {
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
      promptOnLeave,
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
      websockets,
      websocketsReady,
      transactionsReceived,
      canViewTransactionsReceived,
      displayReceivedTransaction,
      paymentProgress,
      remainingPaymentRounded,
      currencyAmountRemaining,
      paid,
      showRemainingCurrencyAmount,
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
  background-color: white;

  padding: 1.8rem 2.1rem;
}

.border-red {
  border: 4px solid #ed5f59;
}
.border-green {
  border: 4px solid #58D68D;
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
