<template>
  <!-- Debug Console Button - Rendered outside q-page to ensure visibility even if page fails to render -->
  <Teleport to="body">
    <q-btn
      v-if="isDebugModeEnabled"
      class="debug-console-button"
      color="primary"
      icon="bug_report"
      label="View Debug Console"
      @click="goToDebugConsole"
      rounded
      unelevated
    />
  </Teleport>
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
        <template v-if="!canShowQr">
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
            @error="(error) => console.error('[ReceivePage] QRCode component error:', error)"
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
            {{ formatNumberAutoDecimals(tokenAmount) }} {{ cashtokenMetadata?.symbol }}
          </div>
          <div v-else-if="!isNaN(bchValue)">
            {{ formatNumberAutoDecimals(bchValue) }} BCH
          </div>
          <div class="text-subtitle2 text-grey">
            {{ formatNumberAutoDecimals(fiatReferenceAmount) }} {{ fiatReferenceCurrency }}
          </div>
        </template>
        <!-- In crypto mode: show crypto amount in large text -->
        <template v-else>
          <div>
            {{ formatNumberAutoDecimals(receiveAmount) }} {{ currency }}
          </div>
          <div v-if="currency !== 'BCH' && !isNaN(bchValue)" class="text-caption text-grey">
            {{ formatNumberAutoDecimals(bchValue) }} BCH
          </div>
          <div v-else-if="cashtokenMetadata?.symbol !== currency && !isNaN(tokenAmount)" class="text-caption text-grey">
            {{ formatNumberAutoDecimals(tokenAmount) }} {{ cashtokenMetadata?.symbol }}
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
                    <q-item-section>{{ formatNumberAutoDecimals(currencyAmountRemaining) }} {{ currency }}</q-item-section>
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
              {{ formatNumberAutoDecimals(txReceived?.amount) }} {{ txReceived?.tokenSymbol }}
            </q-item-label>
            <q-item-label v-if="txReceived?.marketValue?.amount && txReceived?.marketValue?.currency" caption>
              {{ formatNumberAutoDecimals(txReceived?.marketValue?.amount) }} {{ txReceived?.marketValue?.currency }}
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
import { useWalletStore } from 'stores/wallet'
import { usePaymentsStore } from 'stores/payments'
import { useAddressesStore } from 'stores/addresses'
import { useCashtokenStore } from 'src/stores/cashtoken'
import { defineComponent, reactive, ref, onMounted, computed, watch, onUnmounted, inject, markRaw } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { Capacitor } from '@capacitor/core'
import QRCode from 'vue-qrcode-component'
import MainHeader from 'src/components/MainHeader.vue'
import SetAmountFormDialog from 'src/components/SetAmountFormDialog.vue'
import { sha256 } from 'src/wallet/utils'
import bchLogo from 'src/assets/bch-logo.webp'
import { convertIpfsUrl } from 'src/utils/ipfs'
import { formatNumberAutoDecimals, formatNumberWithDecimals } from 'src/utils/number-format'
import { postOutputFiatAmounts } from 'src/utils/watchtower'
import { useQrCodeGenerator } from 'src/composables/useQrCodeGenerator'
import { useFiatRateManager } from 'src/composables/useFiatRateManager'
import { usePaymentTracking } from 'src/composables/usePaymentTracking'
import { validateBchRate, validateTokenRate, validateConversionResult } from 'src/utils/rate-validation'


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
    /* <-- Debug Console - Initialize FIRST to ensure button is always available */
    // Use a ref with direct localStorage check to avoid dependency on reactive state
    const isDebugModeEnabled = ref(false)
    
    // Check localStorage directly - initialize immediately before any other setup
    function checkDebugMode() {
      try {
        return localStorage.getItem('debugIconVisible') === 'true'
      } catch (e) {
        return false
      }
    }
    
    // Initialize immediately - this happens before any other reactive dependencies
    isDebugModeEnabled.value = checkDebugMode()
    /* Debug Console --> */
    
    const $networkDetect = inject('$networkDetect')
    const isOnline = inject('$isOnline')
    const $q = useQuasar()
    const { t } = useI18n()
    const $router = useRouter()
    const walletStore = useWalletStore()
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
    // tokenPriceId is defined in QR code generation section
    const isCashtoken = computed(() => Boolean(tokenCategory.value))
    const isNotFiatMode = computed(() => {
      if (!isCashtoken.value) return currency.value === 'BCH'
      return currency.value === cashtokenMetadata.value?.symbol;
    })

    const cashtokenMetadata = computed(() => cashTokenStore.getTokenMetadata(tokenCategory.value))
    const qrCodeLogo = computed(() => {
      if (isCashtoken.value) {
        const imageUrl = cashtokenMetadata.value?.imageUrl
        if (imageUrl) {
          return convertIpfsUrl(imageUrl)
        }
        return bchLogo
      }
      return bchLogo
    })
    /* Core details --> */

    /* <-- Wallet/address */
    const addressSet = computed(() => addressesStore.currentAddressSet)  
    const receivingAddress = computed(() => addressSet.value?.receiving)
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
    const currencyRateUpdateRate = ref(5 * 60 * 1000)
    
    // Use fiat rate manager composable
    const {
      currencyBchRate,
      tokenBchRate,
      fiatReferenceRate,
      tokenFiatRate,
      currencyTokenPrice,
      bchRateStatus,
      fiatRateLoading,
      rateFetchError,
      refreshingQr,
      updateSelectedCurrencyRate,
      startFiatRateRefreshTimer,
      stopFiatRateRefreshTimer,
    } = useFiatRateManager({
      currency,
      isCashtoken,
      tokenCategory,
      fiatReferenceCurrency,
      isNotFiatMode,
      currencyRateUpdateRate,
    })
    /* Conversion rates --> */

    /* <-- Value/amounts */
    const bchValue = computed(() => {
      if (isCashtoken.value) return NaN
      if (isNotFiatMode.value) return receiveAmount.value

      const rateValue = currencyBchRate.value?.rate
      if (!rateValue || rateValue === 0 || isNaN(rateValue)) {
        console.error('[ReceivePage] Invalid BCH rate value', {
          rate: rateValue,
          currency: currency.value,
          rateObject: currencyBchRate.value
        })
        return NaN
      }
      
      // Validate the rate before using it
      const rateValidation = validateBchRate(rateValue, currency.value)
      if (!rateValidation.valid) {
        console.error('[ReceivePage] BCH rate validation failed:', rateValidation.error, {
          rate: rateValue,
          currency: currency.value,
          rateObject: currencyBchRate.value,
          receiveAmount: receiveAmount.value
        })
        return NaN // Return NaN to prevent showing incorrect QR
      }
      
      const finalBchValue = Number((receiveAmount.value / rateValue).toFixed(8))
      
      // Validate the conversion result
      const conversionValidation = validateConversionResult(
        receiveAmount.value,
        finalBchValue,
        currency.value,
        'BCH',
        rateValue
      )
      
      if (!conversionValidation.valid) {
        console.error('[ReceivePage] BCH conversion validation failed:', conversionValidation.error, {
          fiatAmount: receiveAmount.value,
          cryptoAmount: finalBchValue,
          currency: currency.value,
          rate: rateValue,
          rateObject: currencyBchRate.value
        })
        return NaN // Return NaN to prevent showing incorrect QR
      }
      
      return finalBchValue
    })
    const tokenAmount = computed(() => {
      console.log('[ReceivePage] tokenAmount computed - inputs:', {
        isCashtoken: isCashtoken.value,
        isNotFiatMode: isNotFiatMode.value,
        receiveAmount: receiveAmount.value,
        hasMetadata: !!cashtokenMetadata.value,
        metadata: cashtokenMetadata.value,
        tokenFiatRate: tokenFiatRate.value,
        currencyTokenPrice: currencyTokenPrice.value
      })
      
      if (!isCashtoken.value) {
        console.log('[ReceivePage] tokenAmount: Not a cashtoken, returning NaN')
        return NaN
      }
      if (isNotFiatMode.value) {
        console.log('[ReceivePage] tokenAmount: Not fiat mode, returning receiveAmount:', receiveAmount.value)
        return receiveAmount.value
      }
      
      // Ensure metadata is loaded before conversion
      if (!cashtokenMetadata.value) {
        console.log('[ReceivePage] tokenAmount: No metadata available, returning NaN')
        return NaN
      }

      const cashtokenDecimals = cashtokenMetadata.value?.decimals;
      console.log('[ReceivePage] tokenAmount: Using decimals:', cashtokenDecimals)
      
      // If using direct token-fiat rate, multiply (token per fiat)
      if (tokenFiatRate.value?.rate && tokenFiatRate.value.rate !== 0) {
        const rate = tokenFiatRate.value.rate
        console.log('[ReceivePage] tokenAmount: Using direct token-fiat rate:', rate)
        
        // Validate token rate (check if it's a stablecoin)
        // Note: This rate is "token per fiat" (e.g., 0.017 MUSD per PHP), so pass isTokenPerFiat=true
        const isStablecoin = cashtokenMetadata.value?.symbol?.toUpperCase().includes('USD') || 
                            cashtokenMetadata.value?.symbol?.toUpperCase().includes('STABLE')
        const rateValidation = validateTokenRate(rate, isStablecoin, true) // true = isTokenPerFiat
        
        if (!rateValidation.valid) {
          console.error('[ReceivePage] Token-fiat rate validation failed:', rateValidation.error, {
            rate: rate,
            tokenCategory: tokenCategory.value,
            currency: fiatReferenceCurrency.value || currency.value,
            rateObject: tokenFiatRate.value,
            tokenSymbol: cashtokenMetadata.value?.symbol,
            isStablecoin,
            receiveAmount: receiveAmount.value
          })
          return NaN
        }
        
        // Direct rate: token per fiat (e.g., 0.01698626 MUSD per PHP)
        // Convert: PHP * (MUSD per PHP) = MUSD
        // Use Math.round with scaling to match Python's rounding behavior
        const factor = Math.pow(10, cashtokenDecimals);
        const tokenAmount = Math.round((receiveAmount.value * rate) * factor) / factor;
        
        console.log('[ReceivePage] tokenAmount: Direct rate conversion:', {
          fiatAmount: receiveAmount.value,
          rate: rate,
          factor: factor,
          calculatedTokenAmount: tokenAmount
        })
        
        // Validate conversion result
        const conversionValidation = validateConversionResult(
          receiveAmount.value,
          tokenAmount,
          fiatReferenceCurrency.value || currency.value,
          'TOKEN',
          rate
        )
        
        if (!conversionValidation.valid) {
          console.error('[ReceivePage] Token conversion validation failed:', conversionValidation.error, {
            fiatAmount: receiveAmount.value,
            tokenAmount: tokenAmount,
            currency: fiatReferenceCurrency.value || currency.value,
            rate: rate,
            rateObject: tokenFiatRate.value,
            tokenCategory: tokenCategory.value,
            tokenSymbol: cashtokenMetadata.value?.symbol
          })
          return NaN
        }
        
        console.log('[ReceivePage] tokenAmount: Returning (direct rate):', tokenAmount)
        return tokenAmount
      }
      
      // Fallback: use currencyTokenPrice which is "fiat per token"
      const rateValue = currencyTokenPrice.value
      console.log('[ReceivePage] tokenAmount: Checking fallback rate:', rateValue)
      if (!rateValue || rateValue === 0) {
        console.error('[ReceivePage] Invalid fallback token rate value', {
          rate: rateValue,
          tokenCategory: tokenCategory.value,
          currency: fiatReferenceCurrency.value || currency.value,
          currencyTokenPrice: currencyTokenPrice.value,
          tokenBchRate: tokenBchRate.value,
          currencyBchRate: currencyBchRate.value
        })
        return NaN
      }
      
      // Validate the fallback rate
      // Note: This rate is "fiat per token" (e.g., PHP per MUSD), so pass isTokenPerFiat=false
      const isStablecoin = cashtokenMetadata.value?.symbol?.toUpperCase().includes('USD') || 
                          cashtokenMetadata.value?.symbol?.toUpperCase().includes('STABLE')
      const rateValidation = validateTokenRate(rateValue, isStablecoin, false) // false = fiat per token
      
      if (!rateValidation.valid) {
        console.error('[ReceivePage] Fallback token rate validation failed:', rateValidation.error, {
          rate: rateValue,
          tokenCategory: tokenCategory.value,
          currency: fiatReferenceCurrency.value || currency.value,
          tokenSymbol: cashtokenMetadata.value?.symbol,
          isStablecoin,
          receiveAmount: receiveAmount.value,
          tokenBchRate: tokenBchRate.value,
          currencyBchRate: currencyBchRate.value
        })
        return NaN
      }
      
      // Fallback rate: fiat per token (e.g., PHP per MUSD)
      // Convert: PHP / (PHP per MUSD) = MUSD
      // Use Math.round with scaling to match Python's rounding behavior
      const factor = Math.pow(10, cashtokenDecimals);
      const tokenAmount = Math.round((receiveAmount.value / rateValue) * factor) / factor;
      
      console.log('[ReceivePage] tokenAmount: Fallback rate conversion:', {
        fiatAmount: receiveAmount.value,
        rate: rateValue,
        factor: factor,
        calculatedTokenAmount: tokenAmount
      })
      
      // Validate conversion result
      const conversionValidation = validateConversionResult(
        receiveAmount.value,
        tokenAmount,
        fiatReferenceCurrency.value || currency.value,
        'TOKEN',
        rateValue
      )
      
      if (!conversionValidation.valid) {
        console.error('[ReceivePage] Fallback token conversion validation failed:', conversionValidation.error, {
          fiatAmount: receiveAmount.value,
          tokenAmount: tokenAmount,
          currency: fiatReferenceCurrency.value || currency.value,
          rate: rateValue,
          tokenCategory: tokenCategory.value,
          tokenSymbol: cashtokenMetadata.value?.symbol,
          tokenBchRate: tokenBchRate.value,
          currencyBchRate: currencyBchRate.value
        })
        return NaN
      }
      
      console.log('[ReceivePage] tokenAmount: Returning (fallback rate):', tokenAmount)
      return tokenAmount
    })

    const totalCryptoAmount = computed(() => {
      const result = isCashtoken.value ? tokenAmount.value : bchValue.value
      console.log('[ReceivePage] totalCryptoAmount computed:', {
        isCashtoken: isCashtoken.value,
        tokenAmount: tokenAmount.value,
        bchValue: bchValue.value,
        result: result
      })
      return result
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
        console.log('[ReceivePage] Set Amount Dialog returned data:', JSON.stringify(data, null, 2))
        const amount = data?.amount
        const newAmount = amount?.value
        const startingNewInvoice = paid.value

        console.log('[ReceivePage] Parsed dialog data:', {
          amount: amount,
          newAmount: newAmount,
          fiatAmount: amount?.fiatAmount,
          fiatCurrency: amount?.fiatCurrency,
          tokenCategory: amount?.tokenCategory,
          currency: amount?.currency,
          priceId: amount?.priceId
        })

        if (startingNewInvoice) {
          prepareForNewInvoice()
        }
        
        // Update tokenCategory if provided and fetch metadata
        let metadataPromise = Promise.resolve()
        if (amount?.tokenCategory) {
          console.log('[ReceivePage] Setting tokenCategory:', amount.tokenCategory)
          tokenCategory.value = amount.tokenCategory
          // Fetch metadata if not already loaded
          const existingMetadata = cashTokenStore.getTokenMetadata(amount.tokenCategory)
          console.log('[ReceivePage] Existing metadata:', existingMetadata)
          if (!existingMetadata) {
            console.log('[ReceivePage] Fetching token metadata...')
            metadataPromise = cashTokenStore.fetchTokenMetadata(amount.tokenCategory)
              .then(metadata => {
                console.log('[ReceivePage] Metadata fetched:', metadata)
                return metadata
              })
              .catch(error => {
                console.error('[ReceivePage] Error fetching metadata:', error)
                return null
              })
          } else {
            console.log('[ReceivePage] Using cached metadata')
          }
        }
        
        // Amount currency is what the user entered the amount in (fiat or crypto)
        // Payment currency is always BCH or token (what gets paid)
        if (amount?.fiatAmount && amount?.fiatCurrency) {
          // User entered amount in fiat - amount currency is fiat, payment currency is BCH or token
          // Set receiveAmount to fiat amount so tokenAmount/bchValue computeds can convert correctly
          console.log('[ReceivePage] Setting fiat mode values:', {
            receiveAmount: amount.fiatAmount,
            currency: amount.fiatCurrency,
            fiatReferenceAmount: amount.fiatAmount,
            fiatReferenceCurrency: amount.fiatCurrency
          })
          receiveAmount.value = amount.fiatAmount
          currency.value = amount.fiatCurrency  // amount currency (fiat, e.g., 'PHP')
          fiatReferenceAmount.value = amount.fiatAmount
          fiatReferenceCurrency.value = amount.fiatCurrency
          
          // Store price_id for token payments if provided
          if (amount?.tokenCategory && amount?.priceId) {
            console.log('[ReceivePage] Setting tokenPriceId:', amount.priceId)
            tokenPriceId.value = amount.priceId
          } else {
            tokenPriceId.value = null
          }
        } else {
          // User entered amount in crypto - amount currency = payment currency
          console.log('[ReceivePage] Setting crypto mode values:', {
            receiveAmount: newAmount,
            currency: amount?.currency || 'BCH'
          })
          receiveAmount.value = newAmount
          currency.value = amount?.currency || 'BCH'  // amount currency (same as payment currency)
          fiatReferenceAmount.value = null
          fiatReferenceCurrency.value = null
          tokenPriceId.value = null
        }
        
        console.log('[ReceivePage] After setting values:', {
          receiveAmount: receiveAmount.value,
          currency: currency.value,
          tokenCategory: tokenCategory.value,
          fiatReferenceAmount: fiatReferenceAmount.value,
          fiatReferenceCurrency: fiatReferenceCurrency.value,
          isCashtoken: isCashtoken.value,
          isNotFiatMode: isNotFiatMode.value
        })

        if (receiveAmount.value) {
          console.log('[ReceivePage] receiveAmount is set, proceeding with rate fetch and QR refresh')
          // Start new session when new QR is generated (new amount set)
          // Pass fiat amount/currency to create session with correct fiat data
          if (fiatReferenceAmount.value && fiatReferenceCurrency.value) {
            startNewSession(fiatReferenceAmount.value, fiatReferenceCurrency.value)
          } else if (receivingAddress.value) {
            // If no fiat amount, still start session (crypto-only mode)
            startNewSession(null, null)
          }
          // Wait for metadata to load (if needed), then fetch rates and refresh QR
          metadataPromise.then(() => {
            console.log('[ReceivePage] Metadata promise resolved, checking if fiat mode...')
            // For fiat mode, ensure rates are fetched immediately
            if (fiatReferenceCurrency.value && fiatReferenceAmount.value && !isNotFiatMode.value) {
              console.log('[ReceivePage] Fiat mode detected, fetching rates...', {
                fiatReferenceCurrency: fiatReferenceCurrency.value,
                fiatReferenceAmount: fiatReferenceAmount.value,
                isNotFiatMode: isNotFiatMode.value,
                tokenCategory: tokenCategory.value
              })
              // Fetch rates immediately before refreshing QR
              fiatRateLoading.value = true
              updateSelectedCurrencyRate({ skipRefreshTimer: true })
                .then(() => {
                  console.log('[ReceivePage] Rates fetched successfully, refreshing QR...')
                  // After rates are loaded, refresh QR countdown
                  refreshQrCountdown()
                  // Start fiat rate refresh timer
                  setTimeout(() => {
                    if (fiatReferenceCurrency.value && fiatReferenceAmount.value && !isNotFiatMode.value) {
                      console.log('[ReceivePage] Starting fiat rate refresh timer')
                      startFiatRateRefreshTimer()
                    }
                  }, 100)
                })
                .catch((error) => {
                  console.error('[ReceivePage] Error fetching rates after setting amount', error)
                  // Still try to refresh QR in case we have cached rates
                  refreshQrCountdown()
                })
                .finally(() => {
                  fiatRateLoading.value = false
                })
            } else {
              console.log('[ReceivePage] Not fiat mode or missing fiat ref, refreshing QR directly')
              refreshQrCountdown()
            }
          }).catch(error => {
            console.error('[ReceivePage] Error in metadata promise:', error)
            // Still try to proceed
            if (fiatReferenceCurrency.value && fiatReferenceAmount.value && !isNotFiatMode.value) {
              refreshQrCountdown()
            }
          })
        } else {
          console.log('[ReceivePage] receiveAmount is 0 or falsy, skipping rate fetch')
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
      // Guard against NaN/undefined values
      if (isNaN(paymentsStore.total) || isNaN(paymentsStore.paid)) {
        return 0;
      }
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
      // Add defensive check for remainingPayment.value
      if (remainingPayment.value == null || isNaN(remainingPayment.value)) {
        return 0;
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
      if (paymentsStore.total <= 0 || isNaN(paymentsStore.total)) {
        return paymentsStore.paid > 0 ? 1 : 0;
      }
      if (remainingPayment.value === 0) return 1
      // Guard against NaN in division
      const progress = paymentsStore.paid / paymentsStore.total;
      return isNaN(progress) ? 0 : progress;
    })
    /* Remaining amount --> */

    /* <-- QR code generation */
    const qrTimestamp = ref(Math.floor(Date.now() / 1000))
    const tokenPriceId = ref(null) // Price ID from Set Amount dialog for token payments
    
    // Use QR code generator composable
    const { qrData: qrDataFromGenerator } = useQrCodeGenerator({
      receivingAddress,
      posId,
      isCashtoken,
      tokenCategory,
      remainingPaymentInTokenUnits,
      remainingPaymentRounded,
      tokenPriceId,
      fiatReferenceRate,
      fiatReferenceCurrency,
      tokenFiatRate,
      tokenBchRate,
      isNotFiatMode,
      qrTimestamp,
      networkTimeDiff,
      currencyRateUpdateRate,
      receiveAmount,
      totalCryptoAmount,
    })
    
    // Simple computed for QR data - use the composable's computed
    const qrData = computed(() => qrDataFromGenerator.value)
    /* QR code generation --> */

    /* <-- QR code related */
    const refreshQr = ref(false) // dialog state
    // refreshingQr and fiatRateLoading come from useFiatRateManager composable
    // rateFetchError comes from useFiatRateManager composable
    let latestFiatRatePromise = null
    const qrExpirationTimer = ref(1)
    
    // Error logging system
    const errorLogs = ref([])
    const showErrorDetails = ref(false)
    const maxErrorLogs = 10 // Keep only the last 10 errors
    
    function logError(message, details = null, error = null) {
      const errorLog = {
        message: message || (error?.message || 'Unknown error'),
        details: details || (error?.toString() || null),
        timestamp: Date.now(),
        stack: error?.stack || null
      }
      
      errorLogs.value.unshift(errorLog)
      
      // Keep only the last maxErrorLogs errors
      if (errorLogs.value.length > maxErrorLogs) {
        errorLogs.value = errorLogs.value.slice(0, maxErrorLogs)
      }
      
      // Also log to console for debugging
      console.error('ReceivePage Error:', errorLog)
    }
    
    function clearErrorLogs() {
      errorLogs.value = []
      showErrorDetails.value = false
    }
    
    function formatErrorTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      return date.toLocaleTimeString()
    }

    const qrScanned = ref(false)
    let qrExpirationPrompt = null
    let qrExpirationCountdown = null
    let isUpdatingRate = ref(false)
    
    // Watch currency changes to refresh rates
    watch(currency, () => {
      if (isUpdatingRate.value) return
      if (!currency.value) return
      isUpdatingRate.value = true
      updateSelectedCurrencyRate()
        .catch((error) => {
          console.error('[ReceivePage] Error in currency watcher', error)
        })
        .finally(() => {
          isUpdatingRate.value = false
        })
    }, { immediate: false, flush: 'post' })
    
    // Watch receiveAmount and currency to ensure rates are fetched
    watch(
      () => [receiveAmount.value, currency.value],
      () => {
        if (isUpdatingRate.value) return
        if (!receiveAmount.value || isNotFiatMode.value) return
        // Ensure rate is fetched - QR data will update automatically via computed
        isUpdatingRate.value = true
        updateSelectedCurrencyRate({ skipRefreshTimer: true })
          .catch((error) => {
            console.error('[ReceivePage] Error fetching rate for QR', error)
          })
          .finally(() => {
            isUpdatingRate.value = false
          })
      },
      { immediate: false, flush: 'post' }
    )
    
    // Watch fiat reference currency to start/stop timer
    watch(() => [fiatReferenceCurrency.value, fiatReferenceAmount.value, currency.value], () => {
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
    
    // Note: We no longer cache fiat amounts per address
    // We always use the latest fiat amount entered to ensure the most recent value is used
    
    // Simplified initialization - QR data is now computed automatically
    onMounted(() => {
      refreshQrCountdown()
      
      // Start fiat rate refresh timer if fiat amount is used
      if (fiatReferenceCurrency.value && fiatReferenceAmount.value && !isNotFiatMode.value) {
        startFiatRateRefreshTimer()
      }
    })

    // Old QR generation code removed - now using useQrCodeGenerator composable
    // QR data is now automatically computed from reactive dependencies
    // No need for manual updateQrData function or watchers
    
    // Add canShowQr computed after websockets are set up (will be defined later)
    
    /* QR code related --> */

    // Define functions that will be passed to usePaymentTracking composable
    // These need to be defined before the composable call
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
      rateFetchError.value = false
      updateSelectedCurrencyRate({ skipRefreshTimer: true })
        .then(() => {
          // After rate is fetched, ensure total is set
          if (paymentsStore.total === 0 && totalCryptoAmount.value && !isNaN(totalCryptoAmount.value) && totalCryptoAmount.value > 0) {
            paymentsStore.setTotalPayment(totalCryptoAmount.value)
          }
        })
        .catch((error) => {
          // Always show error - no fallback to cached rates
          rateFetchError.value = true
          $q.notify({
            type: 'negative',
            message: t('PriceUnavailable', { currency: currency.value }, `Price unavailable for ${currency.value}`),
            timeout: 5000,
            icon: 'mdi-alert-circle'
          })
        })
        .finally(() => {
          fiatRateLoading.value = false
        })
      
      stopQrExpirationCountdown()

      qrExpirationTimer.value = 1
      
      const milliseconds = 1000
      qrExpirationCountdown = setInterval(
        () => qrExpirationTimer.value -= 1 / (currencyRateUpdateRate.value / milliseconds),
        milliseconds
      )

      qrExpirationPrompt = setTimeout(
        () => refreshQr.value = true,
        currencyRateUpdateRate.value + (3 * milliseconds)
      )
    }

    // Define displayReceivedTransaction before composable call
    // It will receive transactionsReceived from the composable as a parameter
    function displayReceivedTransaction (data, transactionsReceivedRef) {
      const _qrData = qrData.value
      let marketValue = data?.marketValue || { amount: 0, currency: '' }
      let receivedAmount = isCashtoken.value && data?.tokenId
       ? data?.tokenAmount
       : data?.value / 1e8;
      if (!marketValue?.amount || !marketValue?.currency) {
        if (data?.tokenSymbol === 'BCH' && currencyBchRate.value?.rate) {
          marketValue.amount = Number(
            (Number(receivedAmount) * currencyBchRate.value.rate).toFixed(3)
          )
          marketValue.currency = currencyBchRate.value.currency
        }
      }

      // Use the CURRENT fiat amount displayed on the page
      // This is the fiat amount that's visible below the QR code
      // Capture IMMEDIATELY to avoid any timing issues
      const originalFiatAmount = fiatReferenceAmount.value
      const originalFiatCurrency = fiatReferenceCurrency.value
      
      // If fiat amounts are missing, log warning but continue
      if (!originalFiatAmount || !originalFiatCurrency) {
        console.warn('[ReceivePage] No fiat amount available when transaction received:', {
          txid: data?.txid,
          fiatReferenceAmount: fiatReferenceAmount.value,
          fiatReferenceCurrency: fiatReferenceCurrency.value
        })
      }

      // Helper function to navigate to transaction details
      const navigateToTransactionDetails = () => {
        if (paid.value) {
          addressesStore.removeAddressSet(data?.address)
          receiveAmount.value = 0
          // Clear fiat reference amounts after payment is complete
          fiatReferenceAmount.value = null
          fiatReferenceCurrency.value = null
          // transactionsReceivedRef will be provided by the composable
          if (transactionsReceivedRef) {
            transactionsReceivedRef.value = []
          }
          promptOnLeave.value = false

          const qrDataHash = sha256(_qrData)
          delete walletStore.qrDataTimestampCache[qrDataHash]
        }

        // Construct transaction object from websocket data
        const txObject = {
          txid: data?.txid,
          record_type: 'incoming',
          // For cashtokens, use raw amount from websocket (already in token units)
          // For BCH, convert satoshis to BCH (divide by 1e8) since getTxAmount() expects BCH units
          amount: isCashtoken.value && data?.tokenId
            ? data?.amount  // data.amount is already in raw token units from websocket
            : data?.value / 1e8,  // data.value is in satoshis, convert to BCH (8 decimals)
          ft_category: isCashtoken.value ? data?.tokenId : undefined,
          nft_category: undefined,
          tokenSymbol: data?.tokenSymbol, // Include token symbol from websocket
          tokenName: data?.tokenName, // Include token name from websocket
          tokenDecimals: data?.tokenDecimals, // Include decimals from websocket
          logo: data?.logo, // Include logo from websocket (set in parseWebsocketDataReceived)
          tx_timestamp: new Date().toISOString(),
          date_created: new Date().toISOString(),
          senders: data?.senders || [],
          fiat_amounts: originalFiatAmount && originalFiatCurrency
            ? { [originalFiatCurrency]: originalFiatAmount }
            : undefined,
          market_prices: marketValue.amount && marketValue.currency
            ? { [marketValue.currency]: marketValue.amount / receivedAmount }
            : undefined,
        }
        
        // Navigate to transaction detail page with new transaction flag
        paymentDialogOpen.value = true
        $router.push({
          name: 'transaction-detail',
          params: { txid: data?.txid },
          query: { new: 'true' },
          state: { tx: txObject }
        }).then(() => {
          paymentDialogOpen.value = false
        }).catch(() => {
          paymentDialogOpen.value = false
        })
      }

      // Post fiat amounts IMMEDIATELY using current page state, then navigate on success
      if (originalFiatAmount && originalFiatCurrency && data?.txid) {
        try {
          // Construct output fiat amounts map for this single transaction
          const isTokenPayment = isCashtoken.value && data?.tokenId
          const tokenDecimals = isTokenPayment ? (data?.tokenDecimals ?? cashtokenMetadata.value?.decimals ?? 0) : 0
          const receivedCryptoAmount = isTokenPayment 
            ? (data?.tokenAmount || 0)
            : (data?.value / 1e8 || 0)
          
          if (receivedCryptoAmount > 0) {
            const map = {}
            const entry = {
              fiat_amount: `${originalFiatAmount}`,
              fiat_currency: `${originalFiatCurrency}`,
              recipient: data?.address,
            }
            
            if (isTokenPayment) {
              entry.token_amount = receivedCryptoAmount.toFixed(tokenDecimals)
              entry.token_category = tokenCategory.value
            }
            
            // Use the output index from the transaction data, or default to 0
            const outputIndex = String(data?.index ?? 0)
            map[outputIndex] = entry
            
            // Post API call and ONLY navigate on success
            postOutputFiatAmounts({ txid: data.txid, outputFiatAmounts: map })
              .then(() => {
                console.log('[ReceivePage] Fiat amounts posted successfully, navigating to transaction details')
                navigateToTransactionDetails()
              })
              .catch((error) => {
                console.error('[ReceivePage] Error posting fiat amounts, NOT navigating:', error)
                
                // Check if error is due to duplicate submission
                const errorMessage = error?.message || ''
                const isConflict = error?.status === 409 || 
                                    errorMessage.includes('409') || 
                                    errorMessage.toLowerCase().includes('conflict') ||
                                    errorMessage.toLowerCase().includes('already exists') ||
                                    errorMessage.toLowerCase().includes('duplicate')
                
                if (isConflict) {
                  // If it's a conflict, check if the existing data matches
                  const existingData = error?.existingData
                  if (existingData) {
                    const existingAmount = Number(Object.values(existingData)[0]?.fiat_amount || 0)
                    const existingCurrency = Object.values(existingData)[0]?.fiat_currency || ''
                    const expectedAmount = Number(originalFiatAmount)
                    
                    // If amounts match, treat as success and navigate
                    if (Math.abs(existingAmount - expectedAmount) <= 0.01 && 
                        existingCurrency === originalFiatCurrency) {
                      console.log('[ReceivePage] Duplicate with matching data, proceeding with navigation')
                      navigateToTransactionDetails()
                    } else {
                      // Amounts don't match - show error but don't navigate
                      $q.notify({ 
                        type: 'warning', 
                        message: t('FiatAmountMismatch', 
                          { 
                            existing: `${existingAmount} ${existingCurrency}`,
                            current: `${originalFiatAmount} ${originalFiatCurrency}`
                          },
                          `Fiat amount mismatch: ${existingAmount} ${existingCurrency} already saved, but current amount is ${originalFiatAmount} ${originalFiatCurrency}`
                        ), 
                        timeout: 5000 
                      })
                    }
                  } else {
                    // No existing data to compare, but it's a conflict - likely duplicate, navigate anyway
                    console.log('[ReceivePage] Conflict error but no existing data, proceeding with navigation')
                    navigateToTransactionDetails()
                  }
                } else {
                  // Non-conflict error - show error and don't navigate
                  $q.notify({ 
                    type: 'warning', 
                    message: t('UnableToSaveFiatBreakdown'), 
                    timeout: 3000 
                  })
                }
              })
          } else {
            // No crypto amount, navigate immediately without API call
            navigateToTransactionDetails()
          }
        } catch (e) {
          console.error('[ReceivePage] Error in fiat amount posting', e)
          // On error, don't navigate
        }
      } else {
        // No fiat amount - navigate immediately without API call
        navigateToTransactionDetails()
      }
    }

    /* <-- Payment tracking composable */
    const {
      transactionsReceived,
      websockets,
      websocketsReady,
      qrScanned: qrScannedFromTracking,
      canViewPayments,
      closeWebsocket,
      setupListener,
      prepareForNewInvoice: prepareForNewInvoiceFromTracking,
      startNewSession,
      clearPendingApiCalls,
      resetSessionData,
    } = usePaymentTracking({
      addressSet,
      isCashtoken,
      tokenCategory,
      isOnline,
      currencyBchRate,
      fiatReferenceCurrency,
      fiatReferenceAmount,
      cashtokenMetadata,
      qrData,
      onRefreshQrCountdown: refreshQrCountdown,
      onStopQrExpirationCountdown: stopQrExpirationCountdown,
      onDisplayReceivedTransaction: displayReceivedTransaction,
    })

    // Sync qrScanned ref with composable's qrScanned
    watch(qrScannedFromTracking, (newVal) => {
      qrScanned.value = newVal
    }, { immediate: true })

    // Start session if fiat amount was provided via props (after composable is initialized)
    if (props.setFiatAmount && props.setFiatCurrency && fiatReferenceAmount.value && fiatReferenceCurrency.value) {
      startNewSession(fiatReferenceAmount.value, fiatReferenceCurrency.value)
    }

    // Create a wrapper for displayReceivedTransaction that has access to transactionsReceived
    // This allows it to be called from the template without needing to pass transactionsReceived
    const displayReceivedTransactionWrapper = (data) => {
      displayReceivedTransaction(data, transactionsReceived)
    }

    // Comprehensive cleanup function to reset all state as if app is newly opened
    function resetAllState() {
      // Stop QR expiration countdown
      stopQrExpirationCountdown()
      
      // Clear timeouts
      clearTimeout(triggerSecondConfettiTimeout)
      triggerSecondConfettiTimeout = null
      
      // Clear state flags
      triggerSecondConfetti.value = false
      promptOnLeave.value = true
      refreshingQr.value = false
      refreshQr.value = false
      paymentDialogOpen.value = false
      disableAmount.value = false
      qrScanned.value = false
      
      // Clear fiat reference amounts
      fiatReferenceAmount.value = null
      fiatReferenceCurrency.value = null
      
      // Clear amount and currency
      receiveAmount.value = 0
      currency.value = 'BCH'
      
      // Clear token-related state
      tokenCategory.value = ''
      tokenPriceId.value = null
      
      // Reset QR timestamp
      qrTimestamp.value = Math.floor(Date.now() / 1000)
      
      // Reset QR expiration timer
      qrExpirationTimer.value = 1
      
      // Stop rate refresh timer
      stopFiatRateRefreshTimer()
      
      // Reset payment store
      paymentsStore.resetPayment()
      
      // Reset all session data (clears session maps and resets session ID)
      resetSessionData()
      
      // Call composable's prepare for new invoice
      prepareForNewInvoiceFromTracking()
    }

    // Wrapper for prepareForNewInvoice that adds page-specific logic
    function prepareForNewInvoice () {
      resetAllState()
    }

    const qrCodeContainerClass = computed(() => {
      if (paid.value) {
        let classes = 'border-green '
        classes += $q.dark.isActive ? 'bg-dark': 'bg-green-3'
        return classes
      }
      return 'border-red'
    })

    watch(paid, (newVal, oldVal) => {
      if (newVal) {
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

    onUnmounted(() => {
      stopFiatRateRefreshTimer()
    })
    /* Payment tracking composable --> */

    function maybePostOutputFiatAmounts(txid) {
      try {
        if (!txid) { 
          return 
        }
        if (postedFiatMapTxIds.has(txid)) { 
          return 
        }

        // Collect merchant outputs for this txid
        const outputs = txOutputsByTxid.get(txid) || []
        if (!outputs.length) { 
          return 
        }

        // Use the latest fiat amount/currency entered
        // This ensures we always use the most recent amount the user entered
        // Note: The composable version captures the amount when transaction is received
        const fiatAmount = fiatReferenceAmount.value
        const fiatCurrency = fiatReferenceCurrency.value

        // Require fiat reference available
        if (!fiatAmount || !fiatCurrency) { 
          return 
        }

        // Compute proportional split by crypto amount
        const isTokenPayment = isCashtoken.value
        const tokenDecimals = cashtokenMetadata.value?.decimals || 0
        const totalCrypto = outputs.reduce((s, o) => {
          if (isTokenPayment) return s + (Number(o?.tokenAmount) || 0)
          const bch = (typeof o?.value === 'number') ? (o.value / 1e8) : (Number(o?.amount) || 0)
          return s + (bch || 0)
        }, 0)
        if (totalCrypto <= 0) { 
          return 
        }

        const map = {}
        outputs.forEach(o => {
          const unit = isTokenPayment ? (Number(o?.tokenAmount) || 0) : ((typeof o?.value === 'number') ? (o.value / 1e8) : (Number(o?.amount) || 0))
          const share = unit / totalCrypto
          const fiatPart = share >= 1 || outputs.length === 1
            ? Number(fiatAmount)
            : Number((Number(fiatAmount) * share).toFixed(2))
          const entry = {
            fiat_amount: `${fiatPart}`,
            fiat_currency: `${fiatCurrency}`,
            recipient: o?.address,
          }
          if (isTokenPayment) {
            entry.token_amount = (Number(o?.tokenAmount) || 0).toFixed(tokenDecimals)
            entry.token_category = tokenCategory.value
          }
          map[String(o?.index)] = entry
        })
        // Fire and forget with basic retry handled in helper
        postOutputFiatAmounts({ txid, outputFiatAmounts: map })
          .then(() => { 
            postedFiatMapTxIds.add(txid) 
          })
          .catch((error) => {
            // Non-blocking notify
            console.error('[ReceivePage] Error posting fiat amounts', error)
            
            // Check if error is due to duplicate submission
            const errorMessage = error?.message || ''
            const isConflict = error?.status === 409 || 
                                errorMessage.includes('409') || 
                                errorMessage.toLowerCase().includes('conflict') ||
                                errorMessage.toLowerCase().includes('already exists') ||
                                errorMessage.toLowerCase().includes('duplicate')
            
            if (isConflict) {
              // Check if existing data matches what we're trying to save
              const existingData = error?.existingData
              if (existingData && fiatReferenceAmount.value && fiatReferenceCurrency.value) {
                // Compare existing data with what we're trying to save
                let amountsMatch = true
                const expectedAmount = Number(fiatReferenceAmount.value)
                
                // Check all outputs in existing data
                for (const outputIndex in existingData) {
                  const existing = existingData[outputIndex]
                  const existingAmount = Number(existing.fiat_amount || 0)
                  const existingCurrency = existing.fiat_currency
                  
                  // For single output, compare directly
                  // For multiple outputs, we'd need to sum them, but typically it's one output
                  if (Object.keys(existingData).length === 1) {
                    // Allow small floating point differences (0.01)
                    if (Math.abs(existingAmount - expectedAmount) > 0.01 || 
                        existingCurrency !== fiatReferenceCurrency.value) {
                      amountsMatch = false
                      break
                    }
                  } else {
                    // Multiple outputs - sum them up and compare
                    const totalExisting = Object.values(existingData).reduce((sum, entry) => {
                      return sum + Number(entry.fiat_amount || 0)
                    }, 0)
                    if (Math.abs(totalExisting - expectedAmount) > 0.01 ||
                        existingCurrency !== fiatReferenceCurrency.value) {
                      amountsMatch = false
                      break
                    }
                  }
                }
                
                if (!amountsMatch) {
                  // Amounts don't match - show helpful error
                  const existingAmount = Object.values(existingData)[0]?.fiat_amount || 'unknown'
                  const existingCurrency = Object.values(existingData)[0]?.fiat_currency || ''
                  $q.notify({ 
                    type: 'warning', 
                    message: t('FiatAmountMismatch', 
                      { 
                        existing: `${existingAmount} ${existingCurrency}`,
                        current: `${fiatReferenceAmount.value} ${fiatReferenceCurrency.value}`
                      },
                      `Fiat amount mismatch: ${existingAmount} ${existingCurrency} already saved, but current amount is ${fiatReferenceAmount.value} ${fiatReferenceCurrency.value}`
                    ), 
                    timeout: 5000 
                  })
                }
                // If amounts match, silently ignore (duplicate with same data)
              } else {
                // No existing data to compare, but it's a conflict - likely duplicate
                // Silently ignore
              }
            } else {
              // Not a conflict error - show generic error
              $q.notify({ type: 'warning', message: t('UnableToSaveFiatBreakdown'), timeout: 3000 })
            }
          })
      } catch (e) { 
        console.error('[ReceivePage] Error in maybePostOutputFiatAmounts', e)
      }
    }

    function schedulePostOutputFiatAmounts(txid) {
      if (!txid) return
      const existing = fiatMapPostTimers.get(txid)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        fiatMapPostTimers.delete(txid)
        maybePostOutputFiatAmounts(txid)
      }, 800)
      fiatMapPostTimers.set(txid, timer)
    }

    onBeforeRouteLeave(async (to, from, next) => {
      // If navigating to home, always reset all state
      if (to.name === 'home') {
        resetAllState()
        return next()
      }
      
      // Don't prompt if there's no QR data yet
      if (!qrData.value || !promptOnLeave.value) return next()
      
      // Don't prompt if there's a rate fetch error - user should be able to leave
      if (rateFetchError.value) return next()
      
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
    let wakeLock = null
    let visibilityChangeHandler = null
    const isCapacitor = Capacitor.isNativePlatform()
    
    async function requestWakeLock() {
      // Check if the Wake Lock API is supported
      if (!('wakeLock' in navigator)) {
        if (isCapacitor) {
          console.warn('[ReceivePage] Wake Lock API not supported in Capacitor WebView. Screen may go dark on mobile.')
        } else {
          console.warn('[ReceivePage] Wake Lock API not supported in this browser')
        }
        return
      }
      
      try {
        // Release any existing wake lock first
        if (wakeLock) {
          await wakeLock.release().catch(() => {})
          wakeLock = null
        }
        
        // Request a new wake lock
        wakeLock = await navigator.wakeLock.request('screen')
        console.log('[ReceivePage] Wake Lock acquired successfully')
        
        // Handle wake lock release events
        wakeLock.addEventListener('release', () => {
          console.log('[ReceivePage] Wake Lock was released')
          // Try to re-acquire if page is still visible
          if (document.visibilityState === 'visible') {
            requestWakeLock()
          }
        })
      } catch (err) {
        // Common errors:
        // - "NotAllowedError": User denied permission or not in fullscreen
        // - "NotSupportedError": Browser doesn't support wake lock
        // - "AbortError": Request was aborted
        console.error('[ReceivePage] Error requesting wake lock:', err.name, err.message)
        if (isCapacitor && err.name === 'NotSupportedError') {
          console.warn('[ReceivePage] Wake Lock not supported in Capacitor WebView. Consider using a native plugin.')
        }
      }
    }
    
    function releaseWakeLock() {
      if (wakeLock) {
        wakeLock.release()
          .then(() => {
            wakeLock = null
            console.log('[ReceivePage] Wake Lock released')
          })
          .catch((err) => {
            console.error('[ReceivePage] Error releasing wake lock:', err)
            wakeLock = null
          })
      }
    }
    
    // Handle visibility changes - re-acquire wake lock when page becomes visible
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        // Re-acquire wake lock when page becomes visible again
        // This is important because wake locks are automatically released when the page is hidden
        if (wakeLock === null) {
          requestWakeLock()
        }
      }
    }
    
    onMounted(() => {
      // Request wake lock when component mounts
      requestWakeLock()
      // Re-acquire wake lock when page becomes visible again
      visibilityChangeHandler = handleVisibilityChange
      document.addEventListener('visibilitychange', visibilityChangeHandler)
    })
    
    onUnmounted(() => {
      // Clean up event listener
      if (visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', visibilityChangeHandler)
        visibilityChangeHandler = null
      }
      // Release wake lock when component unmounts
      releaseWakeLock()
    })
    /** --------------- */

    // Watch for debug mode changes (in case user toggles it in settings)
    onMounted(() => {
      // Update debug mode status on mount
      isDebugModeEnabled.value = checkDebugMode()
      // Poll for changes (simple approach that works even if watchers fail)
      const debugCheckInterval = setInterval(() => {
        const newValue = checkDebugMode()
        if (newValue !== isDebugModeEnabled.value) {
          isDebugModeEnabled.value = newValue
        }
      }, 1000)
      
      onUnmounted(() => {
        clearInterval(debugCheckInterval)
      })
    })
    
    // Function to navigate to debug console with error handling
    function goToDebugConsole() {
      try {
        $router.push({ name: 'debug' })
      } catch (error) {
        console.error('[ReceivePage] Error navigating to debug console', error)
        // Fallback: try direct navigation
        try {
          window.location.href = '/#/debug'
        } catch (e) {
          console.error('[ReceivePage] Fallback navigation also failed', e)
        }
      }
    }

    // Add canShowQr computed now that websocketsReady is defined
    const canShowQr = computed(() => {
      if (!websocketsReady.value || refreshingQr.value || fiatRateLoading.value || !qrData.value) {
        return false
      }
      
      // In fiat mode, ensure we have valid rates before showing QR
      if (!isNotFiatMode.value) {
        if (isCashtoken.value && fiatReferenceCurrency.value) {
          // For cashtoken payments, need tokenFiatRate OR (fiatReferenceRate + tokenBchRate for fallback)
          const hasTokenFiatRate = tokenFiatRate.value?.rate && tokenFiatRate.value.rate !== 0
          const hasFallbackRates = fiatReferenceRate.value?.rate && 
                                   fiatReferenceRate.value.rate !== 0 &&
                                   tokenBchRate.value?.rate && 
                                   tokenBchRate.value.rate !== 0
          if (!hasTokenFiatRate && !hasFallbackRates) {
            return false
          }
        } else {
          // For BCH payments, need currencyBchRate
          if (!currencyBchRate.value?.rate || currencyBchRate.value.rate === 0) {
            return false
          }
        }
        
        // Also ensure the computed crypto amount is valid (not NaN)
        if (isNaN(totalCryptoAmount.value) || totalCryptoAmount.value <= 0) {
          return false
        }
      }
      
      return true
    })

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
      canShowQr,
      websockets,
      websocketsReady,
      transactionsReceived,
      canViewPayments,
      displayReceivedTransaction: displayReceivedTransactionWrapper,
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
      rateFetchError,
      errorLogs,
      showErrorDetails,
      clearErrorLogs,
      formatErrorTime,
      formatNumberAutoDecimals,
      formatNumberWithDecimals,
      isDebugModeEnabled,
      goToDebugConsole,
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

.debug-console-button {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
