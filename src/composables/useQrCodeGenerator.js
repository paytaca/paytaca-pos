import { computed } from 'vue'
import { toTokenAddress } from 'src/utils/crypto'

/**
 * Composable for generating QR code data for payment requests
 * @param {Object} params
 * @param {import('vue').Ref<string>} params.receivingAddress - The receiving address
 * @param {import('vue').Ref<number>} params.posId - POS ID
 * @param {import('vue').Ref<boolean>} params.isCashtoken - Whether this is a cashtoken payment
 * @param {import('vue').Ref<string>} params.tokenCategory - Token category if cashtoken
 * @param {import('vue').Ref<number>} params.remainingPaymentInTokenUnits - Remaining payment in token units
 * @param {import('vue').Ref<number>} params.remainingPaymentRounded - Remaining payment rounded
 * @param {import('vue').Ref<string|null>} params.tokenPriceId - Price ID for token payments
 * @param {import('vue').Ref<Object|null>} params.fiatReferenceRate - Fiat reference rate
 * @param {import('vue').Ref<boolean>} params.isNotFiatMode - Whether in fiat mode
 * @param {import('vue').Ref<number>} params.qrTimestamp - QR timestamp
 * @param {import('vue').Ref<number>} params.networkTimeDiff - Network time difference in ms
 * @param {import('vue').Ref<number>} params.currencyRateUpdateRate - Currency rate update rate in ms
 * @param {import('vue').Ref<number>} params.receiveAmount - Receive amount
 * @param {import('vue').Ref<number>} params.totalCryptoAmount - Total crypto amount
 * @returns {import('vue').ComputedRef<string>} QR data string
 */
export function useQrCodeGenerator({
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
}) {
  const qrData = computed(() => {
    console.log('[useQrCodeGenerator] Computing QR data:', {
      receiveAmount: receiveAmount.value,
      totalCryptoAmount: totalCryptoAmount.value,
      isNotFiatMode: isNotFiatMode.value,
      receivingAddress: receivingAddress.value,
      isCashtoken: isCashtoken.value,
      tokenCategory: tokenCategory.value,
      remainingPaymentRounded: remainingPaymentRounded.value,
      remainingPaymentInTokenUnits: remainingPaymentInTokenUnits.value
    })
    
    // Don't generate QR if no receive amount
    if (!receiveAmount.value) {
      console.log('[useQrCodeGenerator] No receiveAmount, returning empty')
      return ''
    }

    // In fiat mode, validate crypto amount
    if (!isNotFiatMode.value) {
      if (isNaN(totalCryptoAmount.value) || totalCryptoAmount.value <= 0) {
        console.log('[useQrCodeGenerator] Invalid totalCryptoAmount in fiat mode:', totalCryptoAmount.value)
        return ''
      }
    }

    // Don't generate QR if no receiving address
    if (!receivingAddress.value) {
      console.log('[useQrCodeGenerator] No receivingAddress, returning empty')
      return ''
    }

    const params = []
    let address = receivingAddress.value

    // Handle cashtoken address formatting
    if (isCashtoken.value) {
      address = toTokenAddress(receivingAddress.value)
      params.push('t')
    }

    params.push(`POS=${posId.value}`)

    // Add amount parameter
    if (isCashtoken.value) {
      params.push(`c=${tokenCategory.value}`)
      params.push(`f=${remainingPaymentInTokenUnits.value}`)
      
      // Add price_id if available - use tokenPriceId from dialog, or fallback to rates
      const priceId = tokenPriceId.value || tokenFiatRate.value?.priceId || tokenBchRate.value?.priceId
      console.log('[useQrCodeGenerator] Token payment - priceId:', {
        tokenPriceId: tokenPriceId.value,
        tokenFiatRatePriceId: tokenFiatRate.value?.priceId,
        tokenBchRatePriceId: tokenBchRate.value?.priceId,
        finalPriceId: priceId
      })
      if (priceId) {
        params.push(`price_id=${priceId}`)
      }
    } else {
      params.push(`amount=${remainingPaymentRounded.value}`)
      
      // Add price_id for fiat reference if available
      if (fiatReferenceCurrency.value && 
          fiatReferenceCurrency.value !== 'BCH' && 
          !isCashtoken.value &&
          fiatReferenceRate.value?.priceId) {
        params.push(`price_id=${fiatReferenceRate.value.priceId}`)
      }
    }

    // Add expiration timestamp for fiat mode
    if (!isNotFiatMode.value) {
      const expiryDuration = currencyRateUpdateRate.value / 1000
      const expirationTimestamp = Math.floor(qrTimestamp.value + expiryDuration)
      const diffSeconds = networkTimeDiff.value ? networkTimeDiff.value / 1000 : 0
      const adjustedExpirationTimestamp = expirationTimestamp + diffSeconds
      params.push(`expires=${adjustedExpirationTimestamp}`)
    }

    const qrString = address + '?' + params.join('&')
    console.log('[useQrCodeGenerator] Generated QR data:', qrString)
    return qrString
  })

  return {
    qrData,
  }
}

