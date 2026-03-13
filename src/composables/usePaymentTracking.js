import { ref, computed, watch, onMounted, onUnmounted, markRaw } from 'vue'
import { useWalletStore } from 'stores/wallet'
import { usePaymentsStore } from 'stores/payments'
import { useAddressesStore } from 'stores/addresses'
import { QSpinnerTail, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { getPrivateKeyWif, loadCardMerchantUser } from 'src/nfc/user'
import { getAuthToken } from 'src/nfc/user'
import { getPublicKeyFromPrivate } from 'src/nfc/utils'
import { payWithCard } from 'src/nfc/payment'
import { da } from 'translate-google/languages'

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

  async function setupListener() {

    const merchantReceivingAddress = addressSet.value?.receiving
    
    if (!merchantReceivingAddress) {
      return
    }

    // Initialize websocket URLs
    const websocketInits = [
      merchantReceivingAddress,
      walletStore.firstReceivingAddress
    ]
      .filter(Boolean)
      .map(address => ({
        instance: { readyState: 0 },
        url: `${websocketUrl}/${address}/`,
      }))
    
    console.log('websocketInits', websocketInits)

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

  const nfcStatusNotification = ref(null)
  let nfcListenerWebsocket = ref(null)
  let nfcListenerActive = ref(false)

  async function closeNfcListener() {
    console.log('Closing NFC listener websocket if exists...')
    if (nfcListenerWebsocket.value) {
      try {
        nfcListenerWebsocket.value.close()
        nfcListenerWebsocket.value = null
      } catch (error) {
        console.error('Error closing NFC listener websocket', error)
      }
    }
  }

  async function setupNFCListener() {
    
    console.log('Setting up NFC listener...')
    const merchantUser = await loadCardMerchantUser()
    console.log(merchantUser)

    const token = await getAuthToken()
    if (!token) {
      console.error('No auth token found, cannot set up NFC listener')
      return
    }

    const privateKey = await getPrivateKeyWif()
    const publicKey = getPublicKeyFromPrivate(privateKey)
    const nfcListenerUrl = `${process.env.NFC_LISTENER_URL}/?public_key=${publicKey}&token=${token}`

    nfcListenerWebsocket.value = new WebSocket(nfcListenerUrl)
    
    nfcListenerWebsocket.value.addEventListener('open', () => {
      console.log('NFC listener websocket connected')
      nfcListenerWebsocket.value.send("start_listening")
      nfcListenerWebsocket.value.send("status")
    })

    nfcListenerWebsocket.value.addEventListener('message', async message => {
      const data = JSON.parse(message.data);
      console.log("-----------Received tag data:", data);

      handleNfcStatus(data)

      const uid = data?.uid || null
      const scannedUrl = data?.url || data?.ntag_url || data?.tag_url || null
      if (!scannedUrl) {
        return
      }

      onNFCUrlReceived(merchantUser, uid, scannedUrl)
    })
    
    nfcListenerWebsocket.value.addEventListener('close', () => {
      console.log('NFC listener websocket closed')
      closeStatusNotification()
    })
  }

  let nfcTagDetected = false
  function handleNfcStatus(data) {
    const status = data?.status
    switch (status) {
      case 'listening_started':
        nfcTagDetected = false
        console.log('NFC listener started and listening for tags')
        closeStatusNotification()
        nfcStatusNotification.value = $q.notify({
          timeout: 0,
          icon: 'mdi-nfc',
          color: 'brandblue',
          message: t('NFCListenerActive', 'NFC listener active and listening for tags'),
        })
        nfcListenerActive.value = true
        break
      case 'tag_detected':
        nfcTagDetected = true
        console.log('NFC tag detected by listener', data)
        closeStatusNotification()
        if (!data?.url) {
          nfcStatusNotification.value = $q.notify({
            timeout: 3000,
            icon: 'warning',
            color: 'negative',
            message: t('NFCInvalidCard', 'NFC tag detected but no valid URL found. Please try again with a compatible card.'),
          })
          setTimeout(() => {
            nfcListenerWebsocket.value.send("start_listening")
          }, 5000)
        } else {
          nfcStatusNotification.value = $q.notify({
            timeout: 3000,
            spinner: QSpinnerTail,
            color: 'info',
            message: t('NFCTagDetected', 'NFC tag detected. Processing payment.'),
          })
        }
        
        break
      case 'idle':
        if (!nfcTagDetected) {
          closeStatusNotification()
          nfcStatusNotification.value = $q.notify({
            timeout: 3000,
            icon: 'warning',
            color: 'negative',
            message: t('NFCReadFailed', 'Failed to read NFC tag. Please try again.'),
          })
        }
        nfcListenerActive.value = false
        setTimeout(() => {
          nfcListenerWebsocket.value.send("start_listening")
        }, 3000)
        break
    }
  } 

  function closeStatusNotification() {
    if (nfcStatusNotification.value) {
      nfcStatusNotification.value?.()
      nfcStatusNotification.value = null
    }
  }

  async function onNFCUrlReceived(merchant, uid, url) {
    const receivingAddress = addressSet.value?.receiving
    if (!receivingAddress) {
      console.error('No receiving address available for processing NFC URL')
      return
    }

    const paymentsStore = usePaymentsStore()
    const bchAmount = paymentsStore.total || 0

    const params = {
      uid,
      merchantId: merchant.id,
      receivingAddress,
      amountSats: Math.round(bchAmount * 1e8),
      url
    }

    console.log('Spending with params:', params)
    try {
      const result = await payWithCard(params)
      console.log('Payment result:', result)
      if (result?.success) {
        closeStatusNotification()
        nfcStatusNotification.value = $q.notify({
          timeout: 3000,
          icon: 'mdi-check-circle',
          color: 'positive',
          message: t('NFCPaymentSuccess', 'NFC payment successful'),
        })
      }
    } catch (error) {
      console.error('Error processing NFC payment', error)
      closeStatusNotification()
      nfcStatusNotification.value = $q.notify({
        timeout: 3000,
        icon: 'mdi-close-circle',
        color: 'negative',
        message: t('NFCPaymentError', `Error processing NFC payment: ${error.message}`),
      })
      setTimeout(() => {
        nfcListenerWebsocket.value.send("start_listening")
      }, 5000)
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
    setupNFCListener,
    closeNfcListener,
    nfcListenerActive,
    closeStatusNotification
  }
}

