<template>
  <q-page padding>
    <MainHeader :title="$t('Payment')" back-to="home"/>
    <div v-if="loading" class="text-center text-h4" style="margin-bottom: 50px;">
      <q-skeleton type="text" width="5em" style="margin:auto;"/>
    </div>
    <q-banner v-if="!isOnline" class="bg-red text-white q-pa-md q-mx-md q-mb-lg rounded-borders">
      {{ $t('AppOfflineMessage') }}
    </q-banner>
    <div v-if="!paid" class="row items-center justify-center q-mt-md">
      <div
        class="qr-code-container"
        :class="qrCodeContainerClass"
        style="position:relative;"
        v-ripple
        @click="copyText(qrData, $t('CopyPaymentUri'))"
      >
        <template v-if="!websocketsReady || refreshingQr || fiatRateLoading">
          <div :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'">
            <q-skeleton :height="$q.platform.is.ios ? '275px' : '240px'" :width="$q.platform.is.ios ? '275px' : '240px'" />
          </div>
        </template>
        <template v-else>
          <img v-if="qrCodeLogo" :src="qrCodeLogo" height="50" class="qr-code-icon"/>
          <QRCode
            :text="qrData"
            color="#253933"
            :size="$q.platform.is.ios ? 275 : 240"
            error-level="H"
            class="q-mb-sm"
            :style="qrData ? '' : 'opacity:0;'"
          />
        </template>
      </div>
    </div>

    <div v-if="!isNotFiatMode" class="flex flex-center">
      <q-linear-progress
        v-if="!qrScanned && !paid"
        :value="qrExpirationTimer"
        class="text-blue-9 q-mt-md q-mb-none"
        style="width:250px"
      />
      <q-icon v-if="networkTimeDiffSeconds > 1" name="info" class="q-ml-xs">
        <q-menu class="q-pa-sm">
          <div>
            {{ $t('DetectedDeviceTimeNotMatch') }}
          </div>
          <div class="text-caption text-grey">
            <template v-if="networkTimeDiffSeconds > 0">
              {{
                $t(
                  'DeviceTimeBehind',
                  { value: Math.abs(networkTimeDiffSeconds) },
                  `Device is ${Math.abs(networkTimeDiffSeconds)} seconds behind`,
                )
              }}
            </template>
            <template v-else>
              {{
                $t(
                  'DeviceTimeAhead',
                  { value: Math.abs(networkTimeDiffSeconds) },
                  `Device is ${Math.abs(networkTimeDiffSeconds)} seconds ahead`,
                )
              }}
            </template>
          </div>
        </q-menu>
      </q-icon>
    </div>

    <q-dialog v-model="refreshQr" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <h6 class="q-mt-none q-mb-md q-ml-sm">{{ $t('QrExpired') }}</h6>
          <span class="q-ml-sm">{{ $t('QrRefreshMessage') }}</span>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat :label="$t('Close')" color="brandblue" @click="() => { promptOnLeave = false; $router.go(-1)}" v-close-popup />
          <q-btn flat :label="$t('Refresh')" color="brandblue" @click="() => { refreshingQr = true; refreshQrCountdown() }" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <div v-if="!loading" class="text-center text-h5 q-my-lg q-px-lg full-width" @click="showSetAmountDialog()">
      <div v-if="receiveAmount">
        <!-- In fiat mode: show crypto amount in large text, fiat amount below -->
        <template v-if="fiatReferenceAmount && fiatReferenceCurrency">
          <div v-if="isCashtoken && !isNaN(tokenAmount)">
            {{ tokenAmount }} {{ cashtokenMetadata?.symbol }}
          </div>
          <div v-else-if="!isNaN(bchValue)">
            {{ bchValue }} BCH
          </div>
          <div class="text-subtitle2 text-grey">
            {{ fiatReferenceAmount }} {{ fiatReferenceCurrency }}
          </div>
        </template>
        <!-- In crypto mode: show crypto amount in large text -->
        <template v-else>
          <div>
            {{ receiveAmount }} {{ currency }}
          </div>
          <div v-if="currency !== 'BCH' && !isNaN(bchValue)" class="text-caption text-grey">
            {{ bchValue }} BCH
          </div>
          <div v-else-if="cashtokenMetadata?.symbol !== currency && !isNaN(tokenAmount)" class="text-caption text-grey">
            {{ tokenAmount }} {{ cashtokenMetadata?.symbol }}
          </div>
        </template>
      </div>
    </div>

    <div v-if="canViewPayments && !paymentDialogOpen" class="q-px-md q-mt-md">
      <div class="row items-center">
        <div class="q-space text-subtitle1">
          {{ $t('Payments') }}
        </div>
        <div class="text-caption">
          <div v-if="paid" class="text-green">{{ $t('PaymentComplete') }}</div>
          <div v-if="!paid" style="color: #ed5f59">
            <q-icon
              v-if="currencyBchRate && currencyBchRate.status !== 2"
              :name="bchRateStatus.icon"
              :color="bchRateStatus.color"
              size="xs"
            />
            {{
              $t(
                'AmountLeftValue',
                { price: remainingPaymentRounded, symbol: remainingPaymentSymbol },
                `${remainingPaymentRounded} ${remainingPaymentSymbol} left`
              )
            }}            
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
        <div v-if="!paid" class="text-grey text-center q-mt-xs q-pt-xs">
          <q-spinner size="30px" class="q-mb-md" />
          <div>{{ $t('WaitingForPayment') }}</div>
        </div>
      </div>
      <div v-else>
        {{ $t('NoTransactionsReceived') }}
      </div>
    </div>
  </q-page>
</template>
<script>
import { getNetworkTimeDiff } from 'src/utils/time.js'
import { toTokenAddress } from 'src/utils/crypto'
import { useWalletStore } from 'stores/wallet'
import { usePaymentsStore } from 'stores/payments'
import { useAddressesStore } from 'stores/addresses'
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useMarketStore } from 'src/stores/market'
import ReceiveUpdateDialog from 'src/components/receive-page/ReceiveUpdateDialog.vue'
import { defineComponent, reactive, ref, onMounted, computed, watch, onUnmounted, markRaw, inject, provide } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useWakeLock } from '@vueuse/core'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import QRCode from 'vue-qrcode-component'
import MainHeader from 'src/components/MainHeader.vue'
import SetAmountFormDialog from 'src/components/SetAmountFormDialog.vue'
import { sha256 } from 'src/wallet/utils'
import bchLogo from 'src/assets/bch-logo.webp'


export default defineComponent({
  name: "ReceivePage",
  components: {
    QRCode,
    MainHeader,
  },
  props: {
    setAmount: Number,
    setCurrency: String,
    setTokenCategory: String,
    lockAmount: Boolean, // should only work if setAmount is given
    setFiatAmount: Number,
    setFiatCurrency: String,
  },
  methods: {
    copyText(value, message='Copied address') {
      this.$copyText(value)
        .then(() => {
          this.$q.notify({
            message: message || this.$t('CopiedToClipboard'),
            timeout: 800,
            icon: 'mdi-clipboard-check',
            color: 'brandblue'
          })
        })
        .catch(() => {})
    }
  },
  setup(props) {
    const $networkDetect = inject('$networkDetect')
    const isOnline = inject('$isOnline')
    const $q = useQuasar()
    const { t } = useI18n()
    const $router = useRouter()
    const walletStore = useWalletStore()
    const marketStore = useMarketStore()
    const addressesStore = useAddressesStore()
    const paymentsStore = usePaymentsStore()
    const cashTokenStore = useCashtokenStore();

    const dustBch = 546e-8

    const loading = computed(() => generatingAddress.value && !addressSet.value?.receiving)
    const promptOnLeave = ref(true)

    /* <-- Core details */
    onMounted(() => {
      paymentsStore.resetPayment()

      // Initialize fiat reference from props first
      if (props.setFiatAmount && props.setFiatCurrency) {
        // If fiat amount is provided, use it as receiveAmount (in fiat mode)
        fiatReferenceAmount.value = props.setFiatAmount
        fiatReferenceCurrency.value = props.setFiatCurrency
        currency.value = props.setFiatCurrency
        receiveAmount.value = props.setFiatAmount  // Set receiveAmount to fiat amount
      } else if (props.setAmount) {
        // If only crypto amount is provided, use it
        receiveAmount.value = props.setAmount
        if (props.setCurrency) {
          currency.value = props.setCurrency
        }
      }
      
      if (props.setAmount && props.lockAmount) disableAmount.value = true
      if (props.setTokenCategory) tokenCategory.value = props.setTokenCategory

      if (tokenCategory.value && !cashtokenMetadata.value) {
        cashTokenStore.fetchTokenMetadata(tokenCategory.value)
      }
    })
    const receiveAmount = ref(0)
    // Initialize currency from props, but prefer fiat currency if provided
    const currency = ref(props.setFiatCurrency || props.setCurrency || 'BCH')
    const tokenCategory = ref('')
    const disableAmount = ref(false)
    const paymentDialogOpen = ref(false)
    const fiatReferenceAmount = ref(props.setFiatAmount || null)
    const fiatReferenceCurrency = ref(props.setFiatCurrency || null)
    const isCashtoken = computed(() => Boolean(tokenCategory.value))
    const isNotFiatMode = computed(() => {
      if (!isCashtoken.value) return currency.value === 'BCH'
      return currency.value === cashtokenMetadata.value?.symbol;
    })

    const cashtokenMetadata = computed(() => cashTokenStore.getTokenMetadata(tokenCategory.value))
    const qrCodeLogo = computed(() => {
      if (isCashtoken.value) {
        return cashtokenMetadata.value?.imageUrl || bchLogo
      }
      return bchLogo
    })
    /* Core details --> */

    /* <-- Wallet/address */
    const addressSet = computed(() => addressesStore.currentAddressSet)  
    const receivingAddress = addressSet.value?.receiving
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
    /* Wallet/address --> */

    /* <-- Network diff */
    /** - Used to adjust expiration timestamp since device's clock might not be in sync
     *    with the timestamp of payer's clock.
     *  - Network diff is how much seconds the server(watchtower) is ahead of device's time
    */
    const networkTimeDiff = ref(0)
    const networkTimeDiffSeconds = computed(() => Math.round(networkTimeDiff.value/1000))
    onMounted(() => updateNetworkTimeDiff())
    function updateNetworkTimeDiff() {
      getNetworkTimeDiff().then(result => {
        networkTimeDiff.value = result?.timeDifference
      })
    }
    /* Network diff --> */

    /* <-- Conversion rates */
    const currencyRateUpdateRate = 5 * 60 * 1000
    // Stable reference for BCH hardcoded rate to prevent recursive updates
    const BCH_HARDCODED_RATE = Object.freeze({ currency: 'BCH', rate: 1, timestamp: 0, status: 2 })
    
    // Cache for rate objects to prevent creating new references on each computed evaluation
    let cachedCurrencyBchRate = null
    let cachedCurrencyBchRateKey = null
    
    const currencyBchRate = computed(() => {
      if (!currency.value) {
        cachedCurrencyBchRate = null
        cachedCurrencyBchRateKey = null
        return undefined
      }
      
      // Always try to get the rate from store first, even if in BCH mode
      // This ensures we get priceId when available
      const rate = marketStore.getRate(currency.value)
      if (rate) {
        // Create a cache key based on the actual rate data
        const cacheKey = `${currency.value}-${rate.rate}-${rate.timestamp}-${rate.priceId || 'no-id'}`
        
        // Return cached object if data hasn't changed
        if (cachedCurrencyBchRateKey === cacheKey && cachedCurrencyBchRate) {
          return cachedCurrencyBchRate
        }
        
        // Cache the new rate object
        cachedCurrencyBchRate = Object.freeze({ ...rate })
        cachedCurrencyBchRateKey = cacheKey
        return cachedCurrencyBchRate
      }
      
      // Fallback to hardcoded rate only if no rate is found and we're in BCH mode
      if (isNotFiatMode.value) {
        return BCH_HARDCODED_RATE
      }
      
      cachedCurrencyBchRate = null
      cachedCurrencyBchRateKey = null
      return undefined
    })
    const status = {
      '0': { icon: 'mdi-equal', color: 'brandblue' },
      '1': { icon: 'mdi-arrow-up', color: 'green-6' },
      '-1': { icon: 'mdi-arrow-down', color: 'red-9' },
    }
    const bchRateStatus = computed(() => {
      if (!currencyBchRate.value || !currencyBchRate.value.status) return status['0']
      return status[currencyBchRate.value.status.toString()]
    })
    // Cache for token rate to prevent new references
    let cachedTokenBchRate = null
    let cachedTokenBchRateKey = null
    const tokenBchRate = computed(() => {
      if (!tokenCategory.value) {
        cachedTokenBchRate = null
        cachedTokenBchRateKey = null
        return null
      }
      
      const rate = marketStore.getTokenRate(tokenCategory.value)
      if (!rate) {
        cachedTokenBchRate = null
        cachedTokenBchRateKey = null
        return null
      }
      
      // Create cache key based on rate data
      const cacheKey = `${tokenCategory.value}-${rate.rate}-${rate.timestamp}-${rate.priceId || 'no-id'}`
      
      // Return cached object if data hasn't changed
      if (cachedTokenBchRateKey === cacheKey && cachedTokenBchRate) {
        return cachedTokenBchRate
      }
      
      // Cache the rate object
      cachedTokenBchRate = Object.freeze({ ...rate })
      cachedTokenBchRateKey = cacheKey
      return cachedTokenBchRate
    })
    
    // Computed for fiat reference rate to avoid calling getRate() in qrData
    let cachedFiatReferenceRate = null
    let cachedFiatReferenceRateKey = null
    const fiatReferenceRate = computed(() => {
      if (!fiatReferenceCurrency.value || fiatReferenceCurrency.value === 'BCH') {
        cachedFiatReferenceRate = null
        cachedFiatReferenceRateKey = null
        return null
      }
      
      const rate = marketStore.getRate(fiatReferenceCurrency.value)
      if (!rate) {
        cachedFiatReferenceRate = null
        cachedFiatReferenceRateKey = null
        return null
      }
      
      // Create a cache key based on the actual rate data
      const cacheKey = `${fiatReferenceCurrency.value}-${rate.rate}-${rate.timestamp}-${rate.priceId || 'no-id'}`
      
      // Return cached object if data hasn't changed
      if (cachedFiatReferenceRateKey === cacheKey && cachedFiatReferenceRate) {
        return cachedFiatReferenceRate
      }
      
      // Cache the new rate object
      cachedFiatReferenceRate = Object.freeze({ ...rate })
      cachedFiatReferenceRateKey = cacheKey
      return cachedFiatReferenceRate
    })

    const currencyTokenPrice = computed(() => {
      if (!isCashtoken.value) return undefined
      if (isNotFiatMode.value) return undefined
      const currencyPerBchRate = currencyBchRate.value?.rate
      const tokenPerBchRate = tokenBchRate.value?.rate

      if (!currencyPerBchRate || !tokenPerBchRate || tokenPerBchRate === 0) return undefined
      return currencyPerBchRate / tokenPerBchRate // currency per token
    })

    async function updateSelectedCurrencyRate (opts = {}) {
      if (isNotFiatMode.value) return
      if (!currency.value) return

      // Pass age threshold to respect cache, but missing priceId will force refresh
      const refreshOpts = { age: currencyRateUpdateRate, ...opts }
      const refreshPromises = [marketStore.refreshBchPrice(currency.value, refreshOpts)]
      if (isCashtoken.value && tokenCategory.value) {
        refreshPromises.push(marketStore.refreshBchPrice(tokenCategory.value, refreshOpts))
      }

      try {
        await Promise.all(refreshPromises)
        
        // After rates are updated, ensure paymentsStore.total is set if it's 0
        // This handles the case where bchValue was NaN initially
        if (paymentsStore.total === 0 && totalCryptoAmount.value && !isNaN(totalCryptoAmount.value) && totalCryptoAmount.value > 0) {
          paymentsStore.setTotalPayment(totalCryptoAmount.value)
        }
      } catch (error) {
        // Silently handle errors to prevent recursive loops
        console.error('Error updating currency rate:', error)
      } finally {
        if (!opts?.skipRefreshTimer) {
          setTimeout(() => { refreshingQr.value = false }, 3000)
        }
      }
    }

    function ensureLatestFiatRateBeforeQr () {
      if (!receiveAmount.value || isNotFiatMode.value) return
      if (latestFiatRatePromise) return latestFiatRatePromise

      fiatRateLoading.value = true
      latestFiatRatePromise = updateSelectedCurrencyRate({ skipRefreshTimer: true })
        .catch(error => {
          console.error(error)
        })
        .finally(() => {
          fiatRateLoading.value = false
          latestFiatRatePromise = null
          
          // After rate is fetched, ensure total is set
          if (paymentsStore.total === 0 && totalCryptoAmount.value && !isNaN(totalCryptoAmount.value) && totalCryptoAmount.value > 0) {
            paymentsStore.setTotalPayment(totalCryptoAmount.value)
          }
        })

      return latestFiatRatePromise
    }
    
    function startFiatRateRefreshTimer() {
      stopFiatRateRefreshTimer()
      
      // Only start if fiat amount is used
      // When fiat is entered:
      // - fiatReferenceCurrency is set (e.g., 'PHP')
      // - currency.value should also be set to fiat (e.g., 'PHP')
      // - isNotFiatMode should be false (because currency is not 'BCH')
      const shouldStart = fiatReferenceCurrency.value && 
                         fiatReferenceAmount.value && 
                         currency.value &&
                         currency.value !== 'BCH' &&
                         !isNotFiatMode.value
      
      if (!shouldStart) return
      
      // Refresh rates and recalculate every 10 minutes (600000ms)
      fiatRateRefreshInterval = setInterval(async () => {
        const stillValid = fiatReferenceCurrency.value && 
                          fiatReferenceAmount.value && 
                          !isNotFiatMode.value &&
                          currency.value &&
                          currency.value !== 'BCH'
        
        if (!stillValid) {
          stopFiatRateRefreshTimer()
          return
        }
        
        try {
          // Force refresh by passing age: 0 to bypass cache
          await updateSelectedCurrencyRate({ skipRefreshTimer: true, age: 0 })
          
          // Clear cached rate objects to force recomputation
          cachedCurrencyBchRate = null
          cachedCurrencyBchRateKey = null
          cachedFiatReferenceRate = null
          cachedFiatReferenceRateKey = null
          
          // Recalculate crypto amount based on updated rates
          // The computed properties (bchValue/tokenAmount) will automatically update
          // but we need to trigger the watcher that updates paymentsStore.total
          if (totalCryptoAmount.value && !isNaN(totalCryptoAmount.value)) {
            paymentsStore.setTotalPayment(totalCryptoAmount.value)
          }
          
          // Update QR data with new rates
          updateQrData()
        } catch (error) {
          console.error('Error refreshing fiat rate:', error)
        }
      }, 600000) // 10 minutes (600000ms)
    }
    
    function stopFiatRateRefreshTimer() {
      if (fiatRateRefreshInterval) {
        clearInterval(fiatRateRefreshInterval)
        fiatRateRefreshInterval = null
      }
    }
    /* Conversion rates --> */

    /* <-- Value/amounts */
    const bchValue = computed(() => {
      if (isCashtoken.value) return NaN
      if (isNotFiatMode.value) return receiveAmount.value

      const rateValue = currencyBchRate.value?.rate
      if (!rateValue || rateValue === 0 || isNaN(rateValue)) return NaN
      const finalBchValue = Number((receiveAmount.value / rateValue).toFixed(8))
      return finalBchValue
    })
    const tokenAmount = computed(() => {
      if (!isCashtoken.value) return NaN
      if (isNotFiatMode.value) return receiveAmount.value

      const cashtokenDecimals = cashtokenMetadata.value?.decimals;
      const rateValue = currencyTokenPrice.value
      const tokenAmount = Number((receiveAmount.value / rateValue).toFixed(cashtokenDecimals));
      return tokenAmount;
    })

    const totalCryptoAmount = computed(() => {
      if (isCashtoken.value) return tokenAmount.value
      return bchValue.value
    })
    let isUpdatingTotalPayment = false
    let lastTotalCryptoAmount = null
    watch(totalCryptoAmount, (newVal) => {
      if (isUpdatingTotalPayment) return
      if (isNaN(newVal)) return
      // Only update if value actually changed
      if (newVal === lastTotalCryptoAmount) return
      if (paymentsStore.total === newVal) {
        lastTotalCryptoAmount = newVal
        return
      }
      
      isUpdatingTotalPayment = true
      lastTotalCryptoAmount = newVal
      paymentsStore.setTotalPayment(newVal)
      // Reset flag in next tick to allow future updates
      setTimeout(() => {
        isUpdatingTotalPayment = false
      }, 0)
    }, { flush: 'post' })

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
        const amount = data?.amount
        const newAmount = amount?.value
        const startingNewInvoice = paid.value

        if (startingNewInvoice) {
          prepareForNewInvoice()
        }

        receiveAmount.value = newAmount
        
        // Amount currency is what the user entered the amount in (fiat or crypto)
        // Payment currency is always BCH or token (what gets paid)
        if (amount?.fiatAmount && amount?.fiatCurrency) {
          // User entered amount in fiat - amount currency is fiat, payment currency is BCH
          currency.value = amount.fiatCurrency  // amount currency (fiat, e.g., 'PHP')
          fiatReferenceAmount.value = amount.fiatAmount
          fiatReferenceCurrency.value = amount.fiatCurrency
        } else {
          // User entered amount in crypto - amount currency = payment currency
          currency.value = amount?.currency || 'BCH'  // amount currency (same as payment currency)
          fiatReferenceAmount.value = null
          fiatReferenceCurrency.value = null
        }

        if (receiveAmount.value) {
          refreshQrCountdown()
          // Start fiat rate refresh timer if fiat amount is used
          // Wait a bit for reactive updates to propagate
          setTimeout(() => {
            if (fiatReferenceCurrency.value && fiatReferenceAmount.value && !isNotFiatMode.value) {
              startFiatRateRefreshTimer()
            } else {
              stopFiatRateRefreshTimer()
            }
          }, 100)
        }
      })
    }
    /* Value/amounts --> */


    /* <-- Remaining amount */
    const triggerSecondConfetti = ref(false)
    let triggerSecondConfettiTimeout = null
    const paid = computed(() => {
      if (paymentsStore.total <= 0) return paymentsStore.paid > 0
      return paymentsStore.paid > 0 && remainingPayment.value === 0
    })
    const showRemainingCurrencyAmount = computed(() => {
      return !isNotFiatMode.value && !paid.value
    })
    const remainingPayment = computed(() => {
      const remaining = paymentsStore.total - paymentsStore.paid
      if (remaining < 0 || (remaining <= dustBch && paymentsStore.paid !== 0)) return 0
      return remaining
    })
    const remainingPaymentRounded = computed(() => {
      let decimals = 8;
      const cashtokenDecimals = cashtokenMetadata.value?.decimals;
      if (isCashtoken.value && Number.isSafeInteger(cashtokenDecimals)) {
        decimals = cashtokenDecimals;
      }
      return Number(remainingPayment.value.toFixed(decimals))
    })
    const remainingPaymentInTokenUnits = computed(() => {
      const decimals = cashtokenMetadata.value?.decimals;
      const tokenUnits = remainingPayment.value * 10 ** decimals;
      return Number(tokenUnits.toFixed(decimals));
    })
    const remainingPaymentSymbol = computed(() => {
      if (!isCashtoken.value) return 'BCH'
      return cashtokenMetadata.value?.symbol;
    })
    const currencyAmountRemaining = computed(() => {
      const priceValue = isCashtoken.value
        ? currencyTokenPrice.value
        : currencyBchRate.value?.rate

      if (!priceValue || isNaN(priceValue)) return 0
      const currencyRemaining = priceValue * remainingPaymentRounded.value
      return Number(currencyRemaining.toFixed(2))
    })
    const paymentProgress = computed(() => {
      if (paymentsStore.total <= 0) return paymentsStore.paid > 0 ? 1 : 0
      if (remainingPayment.value === 0) return 1
      return paymentsStore.paid / paymentsStore.total
    })
    /* Remaining amount --> */


    /* <-- QR code related */
    const refreshQr = ref(false) // dialog state
    const refreshingQr = ref(false) // 
    const fiatRateLoading = ref(false)
    let latestFiatRatePromise = null
    const qrExpirationTimer = ref(1)

    let qrScanned = ref(false)
    let qrExpirationPrompt = null
    let qrExpirationCountdown = null
    
    // Fiat rate refresh timer (1 minute)
    let fiatRateRefreshInterval = null

    let isInitializing = ref(true)
    let isUpdatingRate = ref(false)
    
    // Set up watchers with immediate: false to prevent initial triggers
    watch(currency, () => {
      if (isInitializing.value || isUpdatingRate.value) return
      if (!currency.value) return
      isUpdatingRate.value = true
      updateSelectedCurrencyRate()
        .catch(() => {}) // Suppress errors to prevent loops
        .finally(() => {
          isUpdatingRate.value = false
        })
    }, { immediate: false, flush: 'post' })
    
    watch(
      () => [receiveAmount.value, currency.value],
      () => {
        if (isInitializing.value || isUpdatingRate.value) return
        if (!receiveAmount.value || isNotFiatMode.value) return
        ensureLatestFiatRateBeforeQr()
      },
      { immediate: false, flush: 'post' }
    )
    
    // Watch fiat reference currency to start/stop timer
    watch(() => [fiatReferenceCurrency.value, fiatReferenceAmount.value, currency.value], () => {
      if (isInitializing.value) return
      
      // If we have fiat reference, ensure currency is set to fiat currency
      if (fiatReferenceCurrency.value && fiatReferenceAmount.value && currency.value !== fiatReferenceCurrency.value) {
        currency.value = fiatReferenceCurrency.value
        return // Let the watcher fire again after currency is set
      }
      
      // For timer to start: must have fiat ref values and currency must be the fiat currency (not BCH)
      const shouldRun = fiatReferenceCurrency.value && 
                       fiatReferenceAmount.value && 
                       currency.value &&
                       currency.value === fiatReferenceCurrency.value &&
                       currency.value !== 'BCH'
      
      if (shouldRun) {
        startFiatRateRefreshTimer()
      } else {
        stopFiatRateRefreshTimer()
      }
    }, { flush: 'post' })
    
    onMounted(() => {
      // Defer to next tick to ensure all reactive state is initialized
      // This includes the props being set in the earlier onMounted hook
      setTimeout(() => {
        refreshQrCountdown()
        // Allow watchers to run after initialization completes
        setTimeout(() => {
          isInitializing.value = false
          // Only update QR data after initialization is complete
          setTimeout(() => {
            updateQrData()
            // Enable QR data watcher after first update
            qrDataWatcherReady = true
            // Start fiat rate refresh timer if fiat amount is used (after initialization)
            setTimeout(() => {
              // If fiat is set, ensure currency matches fiat currency
              if (fiatReferenceCurrency.value && fiatReferenceAmount.value && currency.value !== fiatReferenceCurrency.value) {
                currency.value = fiatReferenceCurrency.value
              }
              
              // Check again after potential sync
              const shouldRun = fiatReferenceCurrency.value && 
                               fiatReferenceAmount.value && 
                               currency.value &&
                               currency.value === fiatReferenceCurrency.value &&
                               currency.value !== 'BCH'
              
              if (shouldRun) {
                startFiatRateRefreshTimer()
              }
            }, 200)
          }, 100)
        }, 300)
      }, 50)
    })

    function stopQrExpirationCountdown () {
      clearInterval(qrExpirationCountdown)
      clearTimeout(qrExpirationPrompt)
    }

    function refreshQrCountdown () {
      if (isNotFiatMode.value) return
      if (!currency.value) return

      // Update timestamp when QR is refreshed
      qrTimestamp.value = Math.floor(Date.now() / 1000)

      // Ensure rate is fetched before showing QR - set loading state
      fiatRateLoading.value = true
      updateSelectedCurrencyRate({ skipRefreshTimer: true })
        .catch(error => {
          console.error('Error refreshing currency rate:', error)
        })
        .finally(() => {
          fiatRateLoading.value = false
          
          // After rate is fetched, ensure total is set
          if (paymentsStore.total === 0 && totalCryptoAmount.value && !isNaN(totalCryptoAmount.value) && totalCryptoAmount.value > 0) {
            paymentsStore.setTotalPayment(totalCryptoAmount.value)
          }
          
          // Update QR data after rates are loaded
          updateQrData()
        })
      
      stopQrExpirationCountdown()

      qrExpirationTimer.value = 1
      
      const milliseconds = 1000
      qrExpirationCountdown = setInterval(
        () => qrExpirationTimer.value -= 1 / (currencyRateUpdateRate / milliseconds),
        milliseconds
      )

      qrExpirationPrompt = setTimeout(
        () => refreshQr.value = true,
        currencyRateUpdateRate + (3 * milliseconds)
      )
      
      // Initial QR data update - defer to avoid recursive loops during initialization
      if (!isInitializing.value) {
        setTimeout(() => {
          updateQrData()
        }, 100)
      }
    }

    // Stable timestamp ref - updated only when QR needs refresh, not on every evaluation
    const qrTimestamp = ref(Math.floor(Date.now() / 1000))
    
    // Use a ref to store qrData and update it manually to prevent recursive computed evaluation
    const qrDataRef = ref('')
    let isUpdatingQrData = false
    
    // Function to update QR data without triggering recursive updates
    function updateQrData() {
      // Prevent recursive calls
      if (isUpdatingQrData) return
      if (isInitializing.value) return
      
      isUpdatingQrData = true
      
      try {
        if (!receiveAmount.value) {
          qrDataRef.value = ''
          return
        }

        // Ensure total is set if it's 0 but we have a valid amount
        // This handles the case where rates were loaded but watcher didn't fire yet
        if (paymentsStore.total === 0 && totalCryptoAmount.value && !isNaN(totalCryptoAmount.value) && totalCryptoAmount.value > 0) {
          paymentsStore.setTotalPayment(totalCryptoAmount.value)
        }

        const currentTimestamp = qrTimestamp.value

        const params = [];
        let address = receivingAddress
        if (isCashtoken.value) {
          address = toTokenAddress(receivingAddress);
          params.push('t');
        }
        params.push(`POS=${posId.value}`)
        if (isCashtoken.value) {
          params.push(`c=${tokenCategory.value}`)
          params.push(`f=${remainingPaymentInTokenUnits.value}`)
          if (tokenBchRate.value && tokenBchRate.value.priceId) {
            params.push(`price_id=${tokenBchRate.value.priceId}`)
          }
        } else {
          params.push(`amount=${remainingPaymentRounded.value}`)
          if (fiatReferenceCurrency.value && fiatReferenceCurrency.value !== 'BCH' && !isCashtoken.value) {
            const rate = fiatReferenceRate.value
            if (rate && rate.priceId) {
              params.push(`price_id=${rate.priceId}`)
            }
          }
        }

        if (!isNotFiatMode.value) {
          const expiryDuration = currencyRateUpdateRate / 1000
          const expirationTimestamp = Math.floor(currentTimestamp + expiryDuration)
          const diffSeconds = networkTimeDiff.value ? networkTimeDiff.value / 1000 : 0
          const adjustedExpirationTimestamp = expirationTimestamp + diffSeconds
          params.push(`expires=${adjustedExpirationTimestamp}`)
        }

        qrDataRef.value = address + '?' + params.join('&')
      } finally {
        // Reset flag in next tick to allow future updates
        setTimeout(() => {
          isUpdatingQrData = false
        }, 0)
      }
    }
    
    // Watch dependencies and update QR data manually
    // Use a more defensive approach - only watch essential values
    let lastQrDataKey = null
    let qrDataWatcherReady = false
    
    watch(
      () => {
        // Only watch if initialization is complete
        if (isInitializing.value || !qrDataWatcherReady) return null
        
        // Create a stable key to prevent unnecessary updates
        return JSON.stringify({
          receiveAmount: receiveAmount.value,
          receivingAddress,
          isCashtoken: isCashtoken.value,
          tokenCategory: tokenCategory.value,
          remainingPaymentInTokenUnits: isCashtoken.value ? remainingPaymentInTokenUnits.value : null,
          remainingPaymentRounded: !isCashtoken.value ? remainingPaymentRounded.value : null,
          tokenBchRatePriceId: tokenBchRate.value?.priceId || null,
          fiatReferenceRatePriceId: fiatReferenceRate.value?.priceId || null,
          posId: posId.value,
          isNotFiatMode: isNotFiatMode.value,
          networkTimeDiff: networkTimeDiff.value,
          qrTimestamp: qrTimestamp.value
        })
      },
      (newKey) => {
        if (isInitializing.value || !qrDataWatcherReady) return
        if (!newKey) return // Skip during initialization
        if (lastQrDataKey === newKey) return // Skip if nothing changed
        lastQrDataKey = newKey
        updateQrData()
      },
      { immediate: false, flush: 'post' }
    )
    
    // Expose as computed for template compatibility
    const qrData = computed(() => qrDataRef.value)
    /* QR code related --> */

    /* <-- Received transactions */
    const transactionsReceived = ref([].map(parseWebsocketDataReceived))

    function prepareForNewInvoice () {
      clearTimeout(triggerSecondConfettiTimeout)
      triggerSecondConfettiTimeout = null
      triggerSecondConfetti.value = false
      paymentsStore.resetPayment()
      transactionsReceived.value = []
      qrScanned.value = false
      promptOnLeave.value = true
      refreshingQr.value = false
      refreshQr.value = false
      closeWebsocket()
      setupListener()
    }
    function transactionExists(transaction) {
      return transactionsReceived.value?.some?.(
        obj => (
          obj.txid === transaction.txid &&
          obj.index === transaction.index
        )
      )
    }

    function updateTransactionList (transaction) {
      if (transactionExists(transaction)) return false
      transactionsReceived.value?.push?.(transaction)
      return true
    }
    /* Received transactions --> */

    /* <-- Websocket tx-listener */
    const websocketUrl = `${process.env.WATCHTOWER_WEBSOCKET}/watch/bch`
    const merchantReceivingAddress = addressSet.value?.receiving
    const websocketInits = [
      merchantReceivingAddress,
      walletStore.firstReceivingAddress,
    ]
      .filter(Boolean)
      .map(address => {
        return {
          instance: { readyState: 0 },
          url: `${websocketUrl}/${address}/`,
        }
      })

      
    const isZerothAddress = walletStore.firstReceivingAddress === merchantReceivingAddress
    const websockets = ref(isZerothAddress ? websocketInits.slice(0,1) : websocketInits)
    const websocketsReady = computed(() => {
      const readySockets = websockets.value.filter((websocket) => websocket.instance?.readyState === 1)
      return readySockets.length === websockets.value.length
    })
    const enableReconnect = ref(true)
    const reconnectTimeout = ref(null)
    const canViewPayments = computed(() => {
      return transactionsReceived.value?.length || websocketsReady.value
    })
    const qrCodeContainerClass = computed(() => {
      if (paid.value) {
        let classes = 'border-green '
        classes += $q.dark.isActive ? 'bg-dark': 'bg-green-3'
        return classes
      }
      return 'border-red'
    })

    // close existing websocket in case it exists
    function closeWebsocket () {
      for (let x = 0; x < websockets.value.length; x++) {
        websockets.value[x].instance?.close()
        websockets.value[x].instance = null
      }
    }

    watch(addressSet, () => setupListener())
    watch(paid, (newVal, oldVal) => {
      if (newVal) {
        closeWebsocket()
        stopQrExpirationCountdown()
        addressesStore.dequeueAddress()
        clearTimeout(triggerSecondConfettiTimeout)
        triggerSecondConfettiTimeout = setTimeout(() => triggerSecondConfetti.value = true, 1500)
      } else if (oldVal) {
        clearTimeout(triggerSecondConfettiTimeout)
        triggerSecondConfettiTimeout = null
        triggerSecondConfetti.value = false
      }
    })

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
      stopFiatRateRefreshTimer()
    })
    function setupListener() {
      const merchantReceivingAddress = addressSet.value?.receiving
      
      if (!merchantReceivingAddress) return

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

    function updatePayment (transaction) {
      if (!updateTransactionList(transaction)) return

      if (isCashtoken.value) {
        if (transaction?.tokenId === `ct/${tokenCategory.value}`) {
          const decimals = transaction.tokenDecimals;
          const tokenAmount = transaction.tokenAmount;
          const tokenAmountRounded = Number(tokenAmount.toFixed(decimals));
          paymentsStore.addPayment(tokenAmountRounded);
        }
      } else {
        const paidBchValue = transaction.value / 1e8
        const paidBch = Number((paidBchValue).toFixed(8))
        paymentsStore.addPayment(paidBch)
      }
      promptOnLeave.value = false
      displayReceivedTransaction(transaction)
    }

    function processLiveUpdate (data) {
      const updateType = data?.update_type
      let message = null

      // someone scanned the QR code
      if (updateType === 'qr_scanned') {
        if (!qrScanned.value) {
          stopQrExpirationCountdown()
          qrScanned.value = true
          message = t('SomeoneHasScannedQr')
        }
      }
      else if (updateType === 'sending_payment') {
        message = t('SendingPayment')
      }
      else if (updateType === 'cancel_payment') {
        message = t('PaymentCancelled')
        qrScanned.value = false
        refreshQrCountdown()
      }

      if (message) {
        $q.notify({
          timeout: 3000,
          icon: 'mdi-information',
          color: 'brandblue',
          message,
        })
      }
    }
    
    function onWebsocketReceive(data) {
      console.log(data)

      if (data?.update_type) processLiveUpdate(data)
      if (!data?.value) return
      if (data?.voucher) return

      const parsedData = parseWebsocketDataReceived(data)
      updatePayment(parsedData);
    }

    /**
     * @param {Object} data 
     * @param {String} data.token_id ct/xxxx
     * @param {String} data.token_name
     * @param {String} data.token_symbol 
     * @param {Number} data.token_decimals
     * @param {String} data.image_url for cashtokens only
     * @param {Number} data.amount token units if cashtoken
     * @param {Number} data.value satoshis
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
      if (data?.tokenSymbol === 'BCH' && currencyBchRate.value?.rate) {
        marketValue.amount = Number(
          (Number(data?.value) * currencyBchRate.value.rate).toFixed(3)
        )
        marketValue.currency = currencyBchRate.value.currency || ''
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
        tokenDecimals: data?.token_decimals,
        addressPath: data?.address_path,
        senders: Array.isArray(data?.senders) ? data?.senders : [],
        source: data?.source,
        logo: null,
        voucher: data?.voucher,
      }

      if (!response?.amount && response?.value) response.amount = Math.round(response?.value) / 10 ** 8
      if (typeof response.tokenSymbol === 'string') {
        response.tokenSymbol = response.tokenSymbol.toUpperCase()
        if (!isCashtoken.value && response.voucher !== null) response.tokenSymbol = 'BCH'
      }
      if (response.tokenSymbol === 'BCH') response.logo = 'bch-logo.png'
      else if(data?.image_url) response.logo = data?.image_url

      if (response?.tokenId && response?.amount) {
        const decimals = response?.tokenDecimals;
        response.tokenAmount = response?.amount / 10 ** decimals;
      }
      return response
    }
    /* Websocket tx-listener --> */

    function displayReceivedTransaction (data) {
      const _qrData = qrData.value
      let marketValue = data?.marketValue || { amount: 0, currency: '' }
      let receivedAmount = isCashtoken.value && data?.tokenId
       ? data?.tokenAmount
       : data?.value / 1e8;
      if (!marketValue?.amount || !marketValue?.currency) {
        if (data?.tokenSymbol === 'BCH' && currencyBchRate.value.rate) {
          marketValue.amount = Number(
            (Number(receivedAmount) * currencyBchRate.value.rate).toFixed(3)
          )
          marketValue.currency = currencyBchRate.value.currency
        }
      }

      // Store the original fiat amount before it gets cleared
      const originalFiatAmount = fiatReferenceAmount.value
      const originalFiatCurrency = fiatReferenceCurrency.value

      if (paid.value) {
        addressesStore.removeAddressSet(data?.address)
        receiveAmount.value = 0
        transactionsReceived.value = []
        promptOnLeave.value = false

        const qrDataHash = sha256(_qrData)
        delete walletStore.qrDataTimestampCache[qrDataHash]
      }

      paymentDialogOpen.value = true
      $q.dialog({
        component: ReceiveUpdateDialog,
        componentProps: {
          txid: data?.txid,
          address: data?.address,
          amount: receivedAmount,
          tokenCurrency: data?.tokenSymbol,
          marketValue: marketValue.amount,
          marketValueCurrency: marketValue.currency,
          logo: data?.logo,
          fiatReferenceAmount: originalFiatAmount,
          fiatReferenceCurrency: originalFiatCurrency,
          senders: data?.senders || [],
          tokenName: data?.tokenName,
          tokenId: data?.tokenId,
          tokenDecimals: data?.tokenDecimals,
          merchantName: walletStore.merchantInfo?.name,
          posName: walletStore.deviceInfo?.name || `POS ${walletStore.posId}`,
        }
      })
        .onCancel(() => {
          $router.push({ name: 'home' })
        })
        .onDismiss(() => {
          paymentDialogOpen.value = false
        })
    }

    onBeforeRouteLeave(async (to, from, next) => {
      if (!qrData.value || !promptOnLeave.value) return next()
      const isPaid = remainingPaymentRounded.value < 1000 / 1e8 // provide margin
      if (promptOnLeave.value && !isPaid) {
        const proceed = await new Promise((resolve) => {
          $q.dialog({
            title: t('LeavePage'),
            message: t('LeavePagePromptMsg'),
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
                title: t('DetectedOffline'),
                message: t('OfflineDetectionMsg'),
                ok: true,
              }).onDismiss(() => $router.go(-1))
            }
          })
      }
    })

    /** Keeps screen on */
    const wakeLock = reactive(useWakeLock())
    onMounted(async () => await wakeLock.request('screen'))
    onUnmounted(async () => await wakeLock.release())
    /** --------------- */

    return {
      isOnline,
      promptOnLeave,
      loading,
      receiveAmount,
      currency,
      disableAmount,
      isCashtoken,
      cashtokenMetadata,
      qrCodeLogo,
      currencyBchRate,
      bchValue,
      tokenAmount,
      showSetAmountDialog,
      qrData,
      websockets,
      websocketsReady,
      transactionsReceived,
      canViewPayments,
      displayReceivedTransaction,
      paymentProgress,
      remainingPaymentRounded,
      remainingPaymentSymbol,
      currencyAmountRemaining,
      paid,
      triggerSecondConfetti,
      showRemainingCurrencyAmount,
      bchRateStatus,
      refreshQr,
      refreshingQr,
      fiatRateLoading,
      refreshQrCountdown,
      qrExpirationTimer,
      networkTimeDiff,
      networkTimeDiffSeconds,
      isNotFiatMode,
      qrScanned,
      qrCodeContainerClass,
      paymentDialogOpen,
      fiatReferenceAmount,
      fiatReferenceCurrency,
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
