import { ref, computed, watch, onUnmounted } from 'vue'
import { useMarketStore } from 'stores/market'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

const BCH_HARDCODED_RATE = Object.freeze({ currency: 'BCH', rate: 1, timestamp: 0, status: 2 })

/**
 * Composable for managing fiat rate fetching, caching, and refresh timers
 * @param {Object} params
 * @param {import('vue').Ref<string>} params.currency - Selected currency
 * @param {import('vue').Ref<boolean>} params.isCashtoken - Whether this is a cashtoken payment
 * @param {import('vue').Ref<string>} params.tokenCategory - Token category if cashtoken
 * @param {import('vue').Ref<string|null>} params.fiatReferenceCurrency - Fiat reference currency
 * @param {import('vue').Ref<boolean>} params.isNotFiatMode - Whether in fiat mode
 * @param {import('vue').Ref<number>} params.currencyRateUpdateRate - Currency rate update rate in ms
 * @returns {Object} Rate management functions and computed properties
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

  // Rate caches
  let cachedCurrencyBchRate = null
  let cachedCurrencyBchRateKey = null
  let cachedTokenBchRate = null
  let cachedTokenBchRateKey = null
  let cachedFiatReferenceRate = null
  let cachedFiatReferenceRateKey = null
  let cachedTokenFiatRate = null
  let cachedTokenFiatRateKey = null

  // Rate computed properties
  const currencyBchRate = computed(() => {
    if (!currency.value) {
      cachedCurrencyBchRate = null
      cachedCurrencyBchRateKey = null
      return undefined
    }

    const rate = marketStore.getRate(currency.value)
    if (rate) {
      const cacheKey = `${currency.value}-${rate.rate}-${rate.timestamp}-${rate.priceId || 'no-id'}`
      
      if (cachedCurrencyBchRateKey === cacheKey && cachedCurrencyBchRate) {
        return cachedCurrencyBchRate
      }
      
      cachedCurrencyBchRate = Object.freeze({ ...rate })
      cachedCurrencyBchRateKey = cacheKey
      return cachedCurrencyBchRate
    }

    if (isNotFiatMode.value) {
      return BCH_HARDCODED_RATE
    }

    cachedCurrencyBchRate = null
    cachedCurrencyBchRateKey = null
    return undefined
  })

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

    const cacheKey = `${tokenCategory.value}-${rate.rate}-${rate.timestamp}-${rate.priceId || 'no-id'}`
    
    if (cachedTokenBchRateKey === cacheKey && cachedTokenBchRate) {
      return cachedTokenBchRate
    }

    cachedTokenBchRate = Object.freeze({ ...rate })
    cachedTokenBchRateKey = cacheKey
    return cachedTokenBchRate
  })

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

    const cacheKey = `${fiatReferenceCurrency.value}-${rate.rate}-${rate.timestamp}-${rate.priceId || 'no-id'}`
    
    if (cachedFiatReferenceRateKey === cacheKey && cachedFiatReferenceRate) {
      return cachedFiatReferenceRate
    }

    cachedFiatReferenceRate = Object.freeze({ ...rate })
    cachedFiatReferenceRateKey = cacheKey
    return cachedFiatReferenceRate
  })

  const tokenFiatRate = computed(() => {
    if (!isCashtoken.value || !fiatReferenceCurrency.value || isNotFiatMode.value) {
      cachedTokenFiatRate = null
      cachedTokenFiatRateKey = null
      return null
    }

    const rate = marketStore.getTokenFiatRate(tokenCategory.value, fiatReferenceCurrency.value)
    if (!rate) {
      cachedTokenFiatRate = null
      cachedTokenFiatRateKey = null
      return null
    }

    const cacheKey = `${tokenCategory.value}-${fiatReferenceCurrency.value}-${rate.rate}-${rate.timestamp}-${rate.priceId || 'no-id'}`
    
    if (cachedTokenFiatRateKey === cacheKey && cachedTokenFiatRate) {
      return cachedTokenFiatRate
    }

    cachedTokenFiatRate = Object.freeze({ ...rate })
    cachedTokenFiatRateKey = cacheKey
    return cachedTokenFiatRate
  })

  const currencyTokenPrice = computed(() => {
    if (!isCashtoken.value) return undefined
    if (isNotFiatMode.value) return undefined

    // tokenFiatRate from API is "fiat per token" (e.g., ARS per MUSD)
    // currencyTokenPrice should also be "fiat per token" for consistency
    if (tokenFiatRate.value?.rate && tokenFiatRate.value.rate !== 0) {
      return tokenFiatRate.value.rate
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

  // Rate refresh function
  async function updateSelectedCurrencyRate(opts = {}) {
    if (isNotFiatMode.value) return
    if (!currency.value) return

    const refreshOpts = { age: currencyRateUpdateRate.value, ...opts }
    const refreshPromises = []

    if (isCashtoken.value && tokenCategory.value && fiatReferenceCurrency.value) {
      // Force fresh fetch if skipRefreshTimer is set (we need the rate immediately)
      const forceRefresh = opts?.skipRefreshTimer ? { age: 0 } : {}
      refreshPromises.push(
        marketStore.refreshTokenFiatPrice(
          tokenCategory.value,
          fiatReferenceCurrency.value,
          { ...refreshOpts, ...forceRefresh }
        )
      )
    } else {
      refreshPromises.push(marketStore.refreshBchPrice(currency.value, refreshOpts))
      if (isCashtoken.value && tokenCategory.value) {
        refreshPromises.push(marketStore.refreshBchPrice(tokenCategory.value, refreshOpts))
      }
    }

    try {
      await Promise.all(refreshPromises)
      // Clear cached tokenFiatRate to force recomputation after store update
      if (isCashtoken.value && tokenCategory.value && fiatReferenceCurrency.value) {
        cachedTokenFiatRate = null
        cachedTokenFiatRateKey = null
      }
    } catch (error) {
      console.error('[useFiatRateManager] Error updating currency rates', error)
      throw error
    } finally {
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
        
        // Clear cached rate objects to force recomputation
        cachedCurrencyBchRate = null
        cachedCurrencyBchRateKey = null
        cachedFiatReferenceRate = null
        cachedFiatReferenceRateKey = null
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

