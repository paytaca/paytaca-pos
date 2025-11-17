import { ref, computed, watch, onMounted, onUnmounted, markRaw } from 'vue'
import { useWalletStore } from 'stores/wallet'
import { usePaymentsStore } from 'stores/payments'
import { useAddressesStore } from 'stores/addresses'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

/**
 * Composable for managing payment tracking, websocket connections, and transaction handling
 * @param {Object} params
 * @param {import('vue').ComputedRef<Object>} params.addressSet - Address set from addresses store
 * @param {import('vue').ComputedRef<string>} params.receivingAddress - Current receiving address (used for session tracking)
 * @param {import('vue').Ref<boolean>} params.isCashtoken - Whether this is a cashtoken payment
 * @param {import('vue').Ref<string>} params.tokenCategory - Token category if cashtoken
 * @param {import('vue').Ref<boolean>} params.isOnline - Online status
 * @param {import('vue').ComputedRef<Object|null>} params.currencyBchRate - Currency BCH rate
 * @param {import('vue').Ref<string|null>} params.fiatReferenceCurrency - Fiat reference currency
 * @param {import('vue').Ref<number|null>} params.fiatReferenceAmount - Fiat reference amount
 * @param {import('vue').ComputedRef<Object>} params.cashtokenMetadata - Cashtoken metadata
 * @param {import('vue').ComputedRef<string>} params.qrData - QR data
 * @param {Function} params.onRefreshQrCountdown - Callback to refresh QR countdown
 * @param {Function} params.onStopQrExpirationCountdown - Callback to stop QR expiration countdown
 * @param {Function} params.onDisplayReceivedTransaction - Callback to display received transaction
 * @returns {Object} Payment tracking functions and state
 */
export function usePaymentTracking({
  addressSet,
  isCashtoken,
  tokenCategory,
  isOnline,
  currencyBchRate,
  fiatReferenceCurrency,
  fiatReferenceAmount,
  cashtokenMetadata,
  qrData,
  onRefreshQrCountdown,
  onStopQrExpirationCountdown,
  onDisplayReceivedTransaction,
}) {
  const walletStore = useWalletStore()
  const paymentsStore = usePaymentsStore()
  const addressesStore = useAddressesStore()
  const $q = useQuasar()
  const { t } = useI18n()

  const transactionsReceived = ref([])
  const websockets = ref([])
  const qrScanned = ref(false)
  const enableReconnect = ref(true)
  const reconnectTimeout = ref(null)
  const postedFiatMapTxIds = new Set()
  const fiatMapPostTimers = new Map()
  const txOutputsByTxid = new Map()

  const websocketUrl = `${process.env.WATCHTOWER_WEBSOCKET}/watch/bch`

  const websocketsReady = computed(() => {
    const readySockets = websockets.value.filter((websocket) => websocket.instance?.readyState === 1)
    return readySockets.length === websockets.value.length && websockets.value.length > 0
  })

  const canViewPayments = computed(() => {
    return transactionsReceived.value?.length || websocketsReady.value
  })

  function transactionExists(transaction) {
    return transactionsReceived.value?.some?.(
      obj => (
        obj.txid === transaction.txid &&
        obj.index === transaction.index
      )
    )
  }

  function updateTransactionList(transaction) {
    if (transactionExists(transaction)) return false
    transactionsReceived.value?.push?.(transaction)
    return true
  }

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

  function processLiveUpdate(data) {
    const updateType = data?.update_type
    let message = null

    if (updateType === 'qr_scanned') {
      if (!qrScanned.value) {
        onStopQrExpirationCountdown()
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
      onRefreshQrCountdown()
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


  function clearPendingApiCalls() {
    // Clear all pending timers
    fiatMapPostTimers.forEach(timer => clearTimeout(timer))
    fiatMapPostTimers.clear()
    
    // Clear posted txids set
    postedFiatMapTxIds.clear()
  }

  function resetSessionData() {
    // Clear all session data - used when navigating away or resetting state
    clearPendingApiCalls()
  }

  function startNewSession(fiatAmount, fiatCurrency) {
    // Clear all pending API calls from previous sessions
    clearPendingApiCalls()
    // Note: Fiat amounts are now handled directly in ReceivePage.vue using fiatReferenceAmount/fiatReferenceCurrency
    // No need to track them here
  }


  function updatePayment(transaction) {
    if (!updateTransactionList(transaction)) return

    const txid = transaction?.txid

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

    // Call displayReceivedTransaction - it will handle the API call and navigation
    // Fiat amounts are read directly from fiatReferenceAmount/fiatReferenceCurrency in ReceivePage
    onDisplayReceivedTransaction(transaction, transactionsReceived)

    try {
      if (txid) {
        const list = txOutputsByTxid.get(txid) || []
        list.push(transaction)
        txOutputsByTxid.set(txid, list)
      }
    } catch (_) {}
  }

  function onWebsocketReceive(data) {
    if (data?.update_type) processLiveUpdate(data)
    if (!data?.value) return
    if (data?.voucher) return

    const parsedData = parseWebsocketDataReceived(data)
    updatePayment(parsedData);
  }

  function closeWebsocket() {
    for (let x = 0; x < websockets.value.length; x++) {
      const instance = websockets.value[x].instance
      // Check if instance is actually a WebSocket (has close method) before calling close
      if (instance && typeof instance.close === 'function') {
        try {
          instance.close()
        } catch (error) {
          console.error('[usePaymentTracking] Error closing websocket', error)
        }
      }
      websockets.value[x].instance = null
    }
  }

  function setupListener() {
    const merchantReceivingAddress = addressSet.value?.receiving
    
    if (!merchantReceivingAddress) {
      return
    }

    // Initialize websocket URLs
    const websocketInits = [
      merchantReceivingAddress,
      walletStore.firstReceivingAddress,
    ]
      .filter(Boolean)
      .map(address => ({
        instance: { readyState: 0 },
        url: `${websocketUrl}/${address}/`,
      }))

    const isZerothAddress = walletStore.firstReceivingAddress === merchantReceivingAddress
    websockets.value = isZerothAddress ? websocketInits.slice(0,1) : websocketInits

    for (let x = 0; x < websockets.value.length; x++) {
      const url = websockets.value[x].url
      const websocket = new WebSocket(url)

      websocket.addEventListener('close', (event) => {
        if (!enableReconnect.value) return

        const reconnectInterval = 5000
        clearTimeout(reconnectTimeout.value)
        reconnectTimeout.value = setTimeout(() => setupListener(), reconnectInterval)
      })

      websocket.addEventListener('error', (error) => {
        console.error('[usePaymentTracking] WebSocket error', error)
      })

      websocket.addEventListener('message', message => {
        try {
          const data = JSON.parse(message.data)
          onWebsocketReceive(data)
        } catch (error) {
          console.error('[usePaymentTracking] Error parsing websocket message', error)
        }
      })

      websocket.addEventListener('open', () => {
        websockets.value[x].instance = markRaw(websocket)
      })
    }
  }

  function prepareForNewInvoice() {
    paymentsStore.resetPayment()
    transactionsReceived.value = []
    qrScanned.value = false
    closeWebsocket()
    setupListener()
    // Reset session data when preparing for new invoice
    resetSessionData()
  }

  // Note: Sessions are now started explicitly when fiat amount is set, not based on address changes

  // Watch address set changes
  watch(addressSet, () => {
    if (addressSet.value?.receiving) {
      setupListener()
    }
  })

  // Watch online status
  watch(isOnline, () => {
    if (isOnline.value) {
      setupListener()
    } else {
      closeWebsocket()
    }
  })

  // Setup on mount
  onMounted(() => {
    if (addressSet.value?.receiving) {
      setupListener()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    enableReconnect.value = false
    closeWebsocket()
    clearTimeout(reconnectTimeout.value)
    
    // Clear all timers
    fiatMapPostTimers.forEach(timer => clearTimeout(timer))
    fiatMapPostTimers.clear()
  })

  return {
    transactionsReceived,
    websockets,
    websocketsReady,
    qrScanned,
    canViewPayments,
    closeWebsocket,
    setupListener,
    prepareForNewInvoice,
    startNewSession,
    clearPendingApiCalls,
    resetSessionData,
  }
}

