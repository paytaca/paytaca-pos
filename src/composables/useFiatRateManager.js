import { ref, computed, watch, onUnmounted } from 'vue'
import { useMarketStore } from 'stores/market'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const BCH_HARDCODED_RATE = Object.freeze({ currency: 'BCH', rate: 1, timestamp: 0, status: 2 })

/**
 * Composable for managing fiat rate fetching - always fetches live rates, no caching
 * @param {Object} params
 * @param {import('vue').Ref<string>} params.currency - Selected currency
 * @param {import('vue').Ref<boolean>} params.isCashtoken - Whether this is a cashtoken payment
 * @param {import('vue').Ref<string>} params.tokenCategory - Token category if cashtoken
 * @param {import('vue').Ref<string|null>} params.fiatReferenceCurrency - Fiat reference currency
 * @param {import('vue').Ref<boolean>} params.isNotFiatMode - Whether in fiat mode
 * @param {import('vue').Ref<number>} params.currencyRateUpdateRate - Currency rate update rate in ms
 * @returns {Object} Rate management functions and reactive refs
 */
export function useFiatRateManager({
  currency,
  isCashtoken,
  tokenCategory,
  fiatReferenceCurrency,
  isNotFiatMode,
  currencyRateUpdateRate,
}) {
  const marketStore = useMarketStore()
  const $q = useQuasar()
  const { t } = useI18n()

  const fiatRateLoading = ref(false)
  const rateFetchError = ref(false)
  const refreshingQr = ref(false)

  // Use reactive refs instead of computed properties - only populated after successful API calls
  const currencyBchRate = ref(null)
  const tokenBchRate = ref(null)
  const fiatReferenceRate = ref(null)
  const tokenFiatRate = ref(null)

  const currencyTokenPrice = computed(() => {
    if (!isCashtoken.value) return undefined
    if (isNotFiatMode.value) return undefined

    if (tokenFiatRate.value?.rate && tokenFiatRate.value.rate !== 0) {
      return 1 / tokenFiatRate.value.rate
    }

    const currencyPerBchRate = currencyBchRate.value?.rate
    const tokenPerBchRate = tokenBchRate.value?.rate

    if (!currencyPerBchRate || !tokenPerBchRate || tokenPerBchRate === 0) return undefined
    return currencyPerBchRate / tokenPerBchRate
  })

  // Rate status for UI
  const status = {
    '0': { icon: 'mdi-equal', color: 'brandblue' },
    '1': { icon: 'mdi-arrow-up', color: 'green-6' },
    '-1': { icon: 'mdi-arrow-down', color: 'red-9' },
  }

  const bchRateStatus = computed(() => {
    if (!currencyBchRate.value || !currencyBchRate.value.status) return status['0']
    return status[currencyBchRate.value.status.toString()]
  })

  // Rate refresh function - always fetches live rates, no caching
  async function updateSelectedCurrencyRate(opts = {}) {
    if (isNotFiatMode.value) {
      // Clear rates when not in fiat mode
      currencyBchRate.value = null
      tokenBchRate.value = null
      fiatReferenceRate.value = null
      tokenFiatRate.value = null
      return
    }
    if (!currency.value) return

    fiatRateLoading.value = true
    rateFetchError.value = false

    // Always force fresh fetch (age: 0 means always fetch)
    const refreshOpts = { age: 0, ...opts }

    try {
      if (isCashtoken.value && tokenCategory.value && fiatReferenceCurrency.value) {
        // Fetch token-fiat rate directly
        const tokenFiatRateResult = await marketStore.refreshTokenFiatPrice(
          tokenCategory.value,
          fiatReferenceCurrency.value,
          refreshOpts
        )
        tokenFiatRate.value = Object.freeze({ ...tokenFiatRateResult, status: 0 })
        // Clear other rates that aren't needed
        currencyBchRate.value = null
        tokenBchRate.value = null
        fiatReferenceRate.value = null
      } else {
        // Fetch currency-BCH rate
        const currencyBchRateResult = await marketStore.refreshBchPrice(currency.value, refreshOpts)
        currencyBchRate.value = Object.freeze({ ...currencyBchRateResult, status: 0 })
        
        // Set fiatReferenceRate to currencyBchRate for BCH payments so priceId is available
        if (fiatReferenceCurrency.value && fiatReferenceCurrency.value === currency.value) {
          fiatReferenceRate.value = Object.freeze({ ...currencyBchRateResult, status: 0 })
        } else {
          fiatReferenceRate.value = null
        }
        
        if (isCashtoken.value && tokenCategory.value) {
          // Fetch token-BCH rate
          const tokenBchRateResult = await marketStore.refreshBchPrice(tokenCategory.value, refreshOpts)
          tokenBchRate.value = Object.freeze({ ...tokenBchRateResult })
        } else {
          tokenBchRate.value = null
        }
        
        // Clear rates not needed
        tokenFiatRate.value = null
      }

      // Clear error state on success
      rateFetchError.value = false
    } catch (error) {
      console.error('[useFiatRateManager] Error updating currency rates', error)
      // Clear rates on error - don't use cached values
      currencyBchRate.value = null
      tokenBchRate.value = null
      fiatReferenceRate.value = null
      tokenFiatRate.value = null
      rateFetchError.value = true
      throw error
    } finally {
      fiatRateLoading.value = false
      if (!opts?.skipRefreshTimer) {
        setTimeout(() => { refreshingQr.value = false }, 3000)
      }
    }
  }

  // Timer management
  let fiatRateRefreshInterval = null

  function startFiatRateRefreshTimer() {
    stopFiatRateRefreshTimer()

    const shouldStart = fiatReferenceCurrency.value && 
                       currency.value &&
                       currency.value !== 'BCH' &&
                       !isNotFiatMode.value

    if (!shouldStart) return

    fiatRateRefreshInterval = setInterval(async () => {
      const stillValid = fiatReferenceCurrency.value && 
                        !isNotFiatMode.value &&
                        currency.value &&
                        currency.value !== 'BCH'

      if (!stillValid) {
        stopFiatRateRefreshTimer()
        return
      }

      try {
        await updateSelectedCurrencyRate({ skipRefreshTimer: true, age: 0 })
      } catch (error) {
        console.error('[useFiatRateManager] Error refreshing fiat rate', error)
      }
    }, 600000) // 10 minutes
  }

  function stopFiatRateRefreshTimer() {
    if (fiatRateRefreshInterval) {
      clearInterval(fiatRateRefreshInterval)
      fiatRateRefreshInterval = null
    }
  }

  // Watch fiat reference to manage timer
  watch(
    () => [fiatReferenceCurrency.value, currency.value],
    () => {
      const shouldRun = fiatReferenceCurrency.value && 
                       currency.value &&
                       currency.value === fiatReferenceCurrency.value &&
                       currency.value !== 'BCH'

      if (shouldRun) {
        startFiatRateRefreshTimer()
      } else {
        stopFiatRateRefreshTimer()
      }
    },
    { flush: 'post' }
  )

  // Cleanup on unmount
  onUnmounted(() => {
    stopFiatRateRefreshTimer()
  })

  return {
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
  }
}

