<template>
  <q-page class="transaction-detail-page" :class="isDarkMode ? 'bg-dark-page' : 'bg-brandwhite'">
    <!-- Header -->
    <div class="transaction-header">
      <q-btn flat icon="arrow_back" class="back-btn" @click="goBack" />
      <div class="text-h6 text-brandblue text-center header-title">{{ $t('Transaction') }}</div>
    </div>

    <div v-if="loadError" class="error-container">
      <div class="error-text">{{ loadError }}</div>
      <q-btn outline color="white" no-caps @click="goBack">{{ $t('Back') }}</q-btn>
    </div>

    <div v-else-if="transaction" class="transaction-content">
      <!-- Transaction Type -->
      <div class="text-h5 text-center q-mb-lg">{{ $t('RECEIVED') }}</div>
      
      <!-- Direction Icon -->
      <div class="direction-icon-wrapper">
        <q-icon name="arrow_downward" class="direction-icon"/>
      </div>

      <!-- Amount Section -->
      <div class="amount-section">
        <div class="amount-row">
          <q-avatar v-if="displayLogo" size="40px" class="amount-avatar">
            <img
              v-if="displayLogo && displayLogo !== 'bch-logo.png'"
              :src="displayLogo"
              @error="onImgErrorIpfsSrc"
            />
            <img v-else-if="displayLogo === 'bch-logo.png'" src="~assets/bch-logo.webp"/>
          </q-avatar>
          <div class="text-h5 text-weight-medium">{{ displayAmount }} {{ displayTokenCurrency }}</div>
        </div>
        <div v-if="displayFiatAmount !== null && displayFiatAmount !== undefined && displayFiatCurrency" class="text-h6 text-grey q-mt-xs">
          {{ typeof displayFiatAmount === 'number' ? displayFiatAmount.toFixed(2) : displayFiatAmount }} {{ displayFiatCurrency }}
        </div>
      </div>

      <!-- Reference ID Section -->
      <div class="reference-id-section">
        <div class="text-caption text-grey text-center q-mb-xs">{{ $t('ReferenceID') }}</div>
        <div class="text-h5 text-weight-bold text-center">{{ hexToRef(displayTxid.substring(0, 6)) }}</div>
      </div>

      <!-- Transaction ID Section -->
      <div class="transaction-id-section">
        <q-separator class="q-mb-md"/>
        <div class="text-caption text-grey text-center q-mb-xs">{{ $t('TransactionID') }}</div>
        <div class="txid-container" @click="copyText(displayTxid)">
          <span class="text-body2">{{ displayTxid.slice(0, 8) }}...{{ displayTxid.slice(-8) }}</span>
          <q-icon name="content_copy" size="18px" class="copy-icon" />
        </div>
        <a 
          :href="explorerLink" 
          target="_blank" 
          class="explorer-link text-body2"
        >
          <q-icon name="open_in_new" size="16px" class="q-mr-xs" />
          {{ $t('ViewInExplorer') }}
        </a>
      </div>

      <!-- Date & Time Section -->
      <div class="date-section">
        <div class="text-caption text-grey text-center q-mb-xs">{{ $t('Date') }} & {{ $t('Time') }}</div>
        <div class="text-body1 text-center">{{ displayDate }}</div>
      </div>
    </div>
  </q-page>
</template>
<script>
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { hexToRef } from 'src/utils/reference-id-utils'
import { useI18n } from 'vue-i18n'
import { defineComponent, ref, onMounted, computed, watch, inject } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter, useRoute } from 'vue-router'
import { useTransactionHelpers } from 'src/composables/transaction'
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useWalletStore } from 'src/stores/wallet'
import confetti from 'canvas-confetti'

export default defineComponent({
  name: 'TransactionDetail',
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const router = useRouter()
    const route = useRoute()
    const walletStore = useWalletStore()
    const cashtokenStore = useCashtokenStore()
    const { getTxAmount, getTxDisplayFiat } = useTransactionHelpers()

    const $copyText = inject('$copyText', null)
    
    const transaction = ref(null)
    const loadError = ref(null)
    const isLoading = ref(false)
    
    // Check if this is a new transaction from query params
    const isNewTransaction = computed(() => {
      const query = route.query || {}
      return query.new === 'true' || 
             (typeof query.category === 'string' && query.category.includes('?new=true')) ||
             (window.location.search && window.location.search.includes('new=true'))
    })
    
    // Check if transaction was preloaded in history state
    const preloadedTransaction = computed(() => {
      return (window && window.history && window.history.state && window.history.state.tx) || null
    })
    
    // Computed values for display
    const displayTxid = computed(() => transaction.value?.txid)
    
    const displayAmount = computed(() => {
      if (!transaction.value) return null
      const txAmount = getTxAmount(transaction.value)
      return txAmount?.value || transaction.value?.amount
    })
    
    const displayTokenCurrency = computed(() => {
      if (!transaction.value) return 'BCH'
      const txAmount = getTxAmount(transaction.value)
      return txAmount?.symbol || 'BCH'
    })
    
    const displayFiatAmount = computed(() => {
      if (!transaction.value) return null
      const fiat = getTxDisplayFiat(transaction.value)
      return fiat?.value
    })
    
    const displayFiatCurrency = computed(() => {
      if (!transaction.value) return null
      const fiat = getTxDisplayFiat(transaction.value)
      return fiat?.currency
    })
    
    const displayLogo = computed(() => {
      if (!transaction.value) return 'bch-logo.png'
      const tokenCategory = transaction.value?.ft_category || transaction.value?.nft_category
      if (tokenCategory) {
        const metadata = cashtokenStore.getTokenMetadata(tokenCategory)
        if (metadata?.imageUrl) {
          return convertIpfsUrl(metadata.imageUrl)
        }
      }
      return 'bch-logo.png'
    })
    
    const displayDate = computed(() => {
      if (!transaction.value) return ''
      const date = transaction.value?.tx_timestamp || transaction.value?.date_created
      if (date) {
        return new Intl.DateTimeFormat('en-US', { 
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZoneName: 'short'
        }).format(new Date(date))
      }
      return ''
    })
    
    const displayMerchantName = computed(() => {
      // Only show for new transactions (payment success)
      if (!isNewTransaction.value) return null
      return walletStore.merchantInfo?.name
    })
    
    const displayPosName = computed(() => {
      // Only show for new transactions (payment success)
      if (!isNewTransaction.value) return null
      return walletStore.deviceInfo?.name || `POS ${walletStore.posId}`
    })
    
    const displaySenders = computed(() => {
      if (!transaction.value) return []
      return transaction.value?.senders || []
    })
    
    const explorerLink = computed(() => {
      if (!displayTxid.value) return ''
      return `https://blockchair.com/bitcoin-cash/transaction/${displayTxid.value}`
    })
    
    // Fetch token metadata when transaction is loaded
    watch(() => transaction.value, (tx) => {
      if (!tx) return
      const tokenCategory = tx?.ft_category || tx?.nft_category
      if (tokenCategory && !cashtokenStore.getTokenMetadata(tokenCategory)) {
        cashtokenStore.fetchTokenMetadata(tokenCategory)
      }
    }, { immediate: true })
    
    function concatenate (array) {
      if (!Array.isArray(array)) return ''
      let addresses = array
        .map(item => item?.[0])
        .filter(Boolean)
        .filter((e, i , s) => s.indexOf(e) === i)

      return addresses.join(', ')
    }
    
    function copyText(value, message='') {
      if (!$copyText) {
        // Fallback if inject is not available
        navigator.clipboard?.writeText(value).then(() => {
          $q.notify({
            message: message || t('Copied to clipboard'),
            timeout: 800,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        }).catch(() => {})
        return
      }
      $copyText(value).then(() => {
        $q.notify({
          message: message || t('Copied to clipboard'),
          timeout: 800,
          icon: 'mdi-clipboard-check',
          color: 'blue-9'
        })
      })
      .catch(() => {})
    }
    
    function launchConfetti() {
      // Launch confetti from center of page
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.4 },
        startVelocity: 55,
        gravity: 0.8,
        decay: 0.9,
        scalar: 0.8,
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8', '#fdcb6e']
      })
    }
    
    async function fetchTransaction() {
      const txid = route.params.txid
      if (!txid) {
        loadError.value = t('Transaction ID is required')
        return
      }
      
      if (!walletStore.walletHash || !walletStore.walletObj) {
        loadError.value = t('Wallet not initialized')
        return
      }
      
      isLoading.value = true
      loadError.value = null
      
      try {
        // Search for transaction in wallet history
        const response = await walletStore.walletObj.getTransactions({
          page: 1,
          type: 'incoming',
        })
        
        if (response.success && Array.isArray(response.transactions?.history)) {
          const foundTx = response.transactions.history.find(tx => tx.txid === txid)
          if (foundTx) {
            transaction.value = foundTx
            return
          }
        }
        
        // If not found in first page, search through all pages
        let page = 1
        let hasMore = true
        
        while (hasMore) {
          const pageResponse = await walletStore.walletObj.getTransactions({
            page: page,
            type: 'incoming',
          })
          
          if (pageResponse.success && Array.isArray(pageResponse.transactions?.history)) {
            const foundTx = pageResponse.transactions.history.find(tx => tx.txid === txid)
            if (foundTx) {
              transaction.value = foundTx
              return
            }
            
            hasMore = page < pageResponse.transactions.num_pages
            page++
          } else {
            hasMore = false
          }
        }
        
        loadError.value = t('Transaction not found')
      } catch (error) {
        console.error('Error fetching transaction:', error)
        loadError.value = t('Failed to load transaction')
      } finally {
        isLoading.value = false
      }
    }
    
    function goBack() {
      router.push({ name: 'home' })
    }
    
    onMounted(async () => {
      // Check for preloaded transaction first
      if (preloadedTransaction.value) {
        transaction.value = preloadedTransaction.value
        // Launch confetti if this is a new transaction
        if (isNewTransaction.value) {
          setTimeout(() => {
            launchConfetti()
          }, 500)
        }
        return
      }
      
      // Otherwise fetch the transaction
      await fetchTransaction()
      
      // Launch confetti if this is a new transaction (after fetch completes)
      if (isNewTransaction.value && transaction.value) {
        setTimeout(() => {
          launchConfetti()
        }, 500)
      }
    })

    const isDarkMode = computed(() => $q.dark.isActive)
    
    return {
      isDarkMode,
      transaction,
      loadError,
      isLoading,
      displayTxid,
      displayAmount,
      displayTokenCurrency,
      displayFiatAmount,
      displayFiatCurrency,
      displayLogo,
      displayDate,
      displayMerchantName,
      displayPosName,
      displaySenders,
      explorerLink,
      concatenate,
      copyText,
      hexToRef,
      onImgErrorIpfsSrc,
      goBack,
    }
  },
})
</script>
<style lang="scss" scoped>
.transaction-detail-page {
  min-height: 100vh;
  
  &.bg-brandwhite {
    background-color: $brandlight !important;
  }
  
  &.bg-dark-page {
    background-color: $dark-page !important;
    
    .txid-container {
      background: rgba(255, 255, 255, 0.1);
      
      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    }
  }
}

.transaction-header {
  display: flex;
  align-items: center;
  padding: 1rem;
  
  .back-btn {
    color: $brandblue;
    padding: 0.5rem;
  }
  
  .header-title {
    flex: 1;
    text-transform: uppercase;
    margin-right: 48px; // Balance for back button
  }
}

.error-container {
  text-align: center;
  padding: 2rem;
  
  .error-text {
    margin-bottom: 1rem;
  }
}

.transaction-content {
  padding: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}


.direction-icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
  
  .direction-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: $brandblue;
    color: white;
    font-size: 30px;
    padding: 12px;
    box-sizing: border-box;
  }
}

.amount-section {
  text-align: center;
  margin-bottom: 2rem;
  
  .amount-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0;
    
    .amount-avatar {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

.reference-id-section {
  text-align: center;
  margin-bottom: 1.5rem;
}

.transaction-id-section {
  text-align: center;
  margin-bottom: 1.5rem;
  
  .txid-container {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0.5rem 0;
    cursor: pointer;
    transition: background-color 0.2s;
    background: rgba(0, 0, 0, 0.05);
    
    &:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    
    .txid-text {
      font-family: monospace;
    }
    
    .copy-icon {
      color: $brandblue;
    }
  }
  
  .explorer-link {
    display: flex;
    align-items: center;
    justify-content: center;
    color: $brandblue;
    text-decoration: none;
    margin-top: 0.75rem;
    transition: opacity 0.2s;
    
    &:hover {
      opacity: 0.8;
    }
  }
}

.date-section {
  text-align: center;
  margin-top: 1rem;
}
</style>

