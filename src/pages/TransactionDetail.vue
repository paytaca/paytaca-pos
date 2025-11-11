<template>
  <q-page class="transaction-detail-page" :class="isDarkMode ? 'bg-dark-page' : 'bg-brandwhite'">
    <!-- Header -->
    <div class="transaction-header" :style="headerPaddingStyle">
      <q-btn flat icon="arrow_back" class="back-btn" @click="goBack" />
      <div class="text-h6 text-brandblue text-center header-title">{{ $t('Transaction') }}</div>
    </div>

    <div v-if="loadError && !isLoading" class="error-container">
      <div class="error-text">{{ loadError }}</div>
      <q-btn outline color="white" no-caps @click="goBack">{{ $t('Back') }}</q-btn>
    </div>

    <div v-else-if="isLoading" class="transaction-content">
      <!-- Skeleton Loaders -->
      <div class="text-h5 text-center q-mb-lg">
        <q-skeleton type="text" width="120px" class="q-mx-auto" />
      </div>
      
      <div class="direction-icon-wrapper">
        <q-skeleton type="circle" size="56px" class="q-mx-auto" />
      </div>

      <div class="amount-section">
        <div class="amount-row">
          <q-skeleton type="circle" size="40px" class="q-mr-sm" />
          <q-skeleton type="text" width="150px" />
        </div>
        <q-skeleton type="text" width="100px" class="q-mt-xs q-mx-auto" />
      </div>

      <div class="reference-id-section">
        <q-skeleton type="text" width="80px" class="q-mb-xs q-mx-auto" />
        <q-skeleton type="text" width="120px" class="q-mx-auto" />
      </div>

      <div class="transaction-id-section">
        <q-separator class="q-mb-md"/>
        <q-skeleton type="text" width="100px" class="q-mb-xs q-mx-auto" />
        <q-skeleton type="rect" width="200px" height="40px" class="q-mx-auto q-mt-sm" />
        <q-skeleton type="text" width="140px" class="q-mt-md q-mx-auto" />
      </div>

      <div class="date-section">
        <q-skeleton type="text" width="90px" class="q-mb-xs q-mx-auto" />
        <q-skeleton type="text" width="180px" class="q-mx-auto" />
      </div>
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
        <div class="text-caption text-grey text-center q-mb-xs">{{ $t('DateAndTime', {}, 'Date & Time') }}</div>
        <div class="text-body1 text-center">{{ displayDate }}</div>
      </div>
    </div>
  </q-page>
</template>
<script>
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { hexToRef } from 'src/utils/reference-id-utils'
import { useI18n } from 'vue-i18n'
import { defineComponent, ref, onMounted, onUnmounted, computed, watch, inject, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter, useRoute } from 'vue-router'
import { useTransactionHelpers } from 'src/composables/transaction'
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useWalletStore } from 'src/stores/wallet'
import confetti from 'canvas-confetti'
import { NativeAudio } from '@capacitor-community/native-audio'

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
    
    // Audio element for Safari compatibility (preload and reuse)
    const audioElement = ref(null)
    
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
      if (!tokenCategory) return
      
      // Check if we already have metadata cached
      if (cashtokenStore.getTokenMetadata(tokenCategory)) return
      
      // If transaction has websocket metadata (from payment received), use it
      if (tx?.tokenSymbol || tx?.tokenName || tx?.tokenDecimals !== undefined) {
        const metadata = {
          category: tokenCategory,
          name: tx?.tokenName || '',
          symbol: tx?.tokenSymbol || '',
          decimals: tx?.tokenDecimals ?? 0,
          imageUrl: null // Image not available from websocket
        }
        cashtokenStore.saveTokenMetadata(metadata)
        
        // Still try to fetch from API for image URL, but don't fail if it doesn't exist
        cashtokenStore.fetchTokenMetadata(tokenCategory).catch(() => {
          // Silently fail - we already have the essential metadata from websocket
        })
      } else {
        // No websocket metadata, try to fetch from API
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
    
    async function playHtml5Audio() {
      try {
        // For Safari, reuse preloaded audio element
        if (audioElement.value) {
          // Reset to beginning
          audioElement.value.currentTime = 0
          
          // Check if audio is ready (Safari requirement)
          if (audioElement.value.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            try {
              await audioElement.value.play()
            } catch (error) {
              console.error('Error playing preloaded audio:', error)
              // If play fails, try loading and playing again
              audioElement.value.load()
              await new Promise((resolve) => {
                audioElement.value.addEventListener('canplay', resolve, { once: true })
                // Timeout after 2 seconds
                setTimeout(resolve, 2000)
              })
              try {
                await audioElement.value.play()
              } catch (retryError) {
                console.error('Error retrying audio play:', retryError)
              }
            }
          } else {
            // Wait for audio to be ready, then play
            await new Promise((resolve) => {
              const playWhenReady = async () => {
                try {
                  await audioElement.value.play()
                } catch (error) {
                  console.error('Error playing audio when ready:', error)
                }
                resolve()
              }
              audioElement.value.addEventListener('canplay', playWhenReady, { once: true })
              // Trigger load if not already loading
              if (audioElement.value.readyState === 0) {
                audioElement.value.load()
              }
              // Timeout after 2 seconds
              setTimeout(resolve, 2000)
            })
          }
        } else {
          // Fallback: create new audio if preload didn't work
          const audio = new Audio('/send-success.mp3')
          audio.preload = 'auto'
          try {
            await audio.play()
          } catch (error) {
            console.error('Error playing fallback audio:', error)
            // Try loading and playing again
            audio.load()
            await new Promise((resolve) => {
              audio.addEventListener('canplay', async () => {
                try {
                  await audio.play()
                } catch (e) {
                  console.error('Error playing fallback audio after load:', e)
                }
                resolve()
              }, { once: true })
              setTimeout(resolve, 2000)
            })
          }
        }
      } catch (error) {
        console.error('Error in playHtml5Audio:', error)
      }
    }
    
    async function playSound(success) {
      if (!success) return
      
      // Try NativeAudio first (works on Android, should work on iOS with correct setup)
      if ($q.platform.is.capacitor) {
        try {
          await NativeAudio.play({
            assetId: 'send-success'
          })
        } catch (error) {
          console.error('Error playing sound:', error)
          // Fallback: try to preload and play again
          try {
            let path = 'send-success.mp3'
            if ($q.platform.is.ios) {
              path = 'public/assets/send-success.mp3'
            }
            await NativeAudio.preload({
              assetId: 'send-success',
              assetPath: path,
              audioChannelNum: 1,
              volume: 1.0,
              isUrl: false
            })
            await NativeAudio.play({
              assetId: 'send-success'
            })
          } catch (retryError) {
            console.error('Error retrying sound playback:', retryError)
            // Final fallback to HTML5 Audio
            await playHtml5Audio()
          }
        }
      } else {
        // Web fallback (includes Safari)
        await playHtml5Audio()
      }
    }
    
    async function launchConfetti() {
      console.log('[TransactionDetail] launchConfetti called, platform is iOS:', $q.platform.is.ios)
      
      // Play sound for new transaction
      // Ensure audio is ready by waiting for next frame (allows preload to complete)
      await new Promise(resolve => requestAnimationFrame(resolve))
      
      try {
        await playSound(true)
        console.log('[TransactionDetail] Sound played successfully')
      } catch (error) {
        console.error('[TransactionDetail] Error playing sound in launchConfetti:', error)
      }
      
      // Launch confetti from center of page
      try {
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
        console.log('[TransactionDetail] Confetti launched successfully')
      } catch (error) {
        console.error('[TransactionDetail] Error launching confetti:', error)
      }
    }
    
    // Helper function to delay execution (for exponential backoff)
    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms))
    }

    // Core function to search for transaction
    async function searchTransaction(txid) {
      // Search for transaction in wallet history
      const response = await walletStore.walletObj.getTransactions({
        page: 1,
        type: 'incoming',
      })
      
      if (response.success && Array.isArray(response.transactions?.history)) {
        const foundTx = response.transactions.history.find(tx => tx.txid === txid)
        if (foundTx) {
          return foundTx
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
            return foundTx
          }
          
          hasMore = page < pageResponse.transactions.num_pages
          page++
        } else {
          hasMore = false
        }
      }
      
      return null
    }

    async function fetchTransaction(forceServerFetch = false) {
      const txid = route.params.txid
      if (!txid) {
        loadError.value = t('Transaction ID is required')
        return
      }
      
      if (!walletStore.walletHash || !walletStore.walletObj) {
        loadError.value = t('Wallet not initialized')
        return
      }
      
      // Check for preloaded transaction from websocket first
      const websocketTx = preloadedTransaction.value
      if (websocketTx && websocketTx.txid === txid && !forceServerFetch) {
        // Use websocket data immediately if available (unless forcing server fetch)
        transaction.value = websocketTx
        isLoading.value = false
        return
      }
      
      // Only set loading state if we don't already have transaction data (not a background refresh)
      if (!forceServerFetch) {
        isLoading.value = true
      }
      loadError.value = null
      
      const maxRetries = 7
      const websocketFallbackAfterRetries = 2 // Use websocket data after 2 retries
      let retryCount = 0
      let lastError = null
      
      while (retryCount <= maxRetries) {
        try {
          const foundTx = await searchTransaction(txid)
          
          if (foundTx) {
            transaction.value = foundTx
            isLoading.value = false
            return
          }
          
          // Transaction not found - check if we should use websocket data as fallback
          if (retryCount >= websocketFallbackAfterRetries && websocketTx && websocketTx.txid === txid) {
            // Use websocket data after 2 retries if transaction not found in server
            console.log('Transaction not found in server after retries, using websocket data')
            transaction.value = websocketTx
            isLoading.value = false
            return
          }
          
          // Continue retrying if we haven't reached max retries
          if (retryCount < maxRetries) {
            const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000) // Cap at 30 seconds
            await delay(backoffDelay)
            retryCount++
            continue
          } else {
            // All retries exhausted, check websocket data one more time
            if (websocketTx && websocketTx.txid === txid) {
              console.log('Transaction not found in server, using websocket data as fallback')
              transaction.value = websocketTx
              isLoading.value = false
              return
            }
            // No websocket data available either
            // Only set error if this is not a background refresh
            if (!forceServerFetch) {
              loadError.value = t('Transaction not found')
            }
            isLoading.value = false
            return
          }
        } catch (error) {
          console.error(`Error fetching transaction (attempt ${retryCount + 1}/${maxRetries + 1}):`, error)
          lastError = error
          
          // If we've exhausted all retries, try websocket data as fallback
          if (retryCount >= maxRetries) {
            if (websocketTx && websocketTx.txid === txid) {
              console.log('Error fetching transaction, using websocket data as fallback')
              transaction.value = websocketTx
              isLoading.value = false
              return
            }
            // Only set error if this is not a background refresh
            if (!forceServerFetch) {
              loadError.value = t('Failed to load transaction')
            }
            isLoading.value = false
            return
          }
          
          // Retry with exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000) // Cap at 30 seconds
          await delay(backoffDelay)
          retryCount++
        }
      }
      
      // Fallback (shouldn't reach here, but just in case)
      if (!transaction.value) {
        if (websocketTx && websocketTx.txid === txid) {
          transaction.value = websocketTx
        } else if (!forceServerFetch) {
          // Only set error if this is not a background refresh
          loadError.value = lastError ? t('Failed to load transaction') : t('Transaction not found')
        }
      }
      isLoading.value = false
    }
    
    function goBack() {
      router.push({ name: 'home' })
    }
    
    onMounted(async () => {
      // Preload HTML5 audio for Safari compatibility (web platforms)
      if (!$q.platform.is.capacitor) {
        try {
          audioElement.value = new Audio('/send-success.mp3')
          audioElement.value.preload = 'auto'
          // Load the audio (required for Safari)
          audioElement.value.load()
          
          // For Safari, ensure audio is ready by waiting for canplay event
          await new Promise((resolve, reject) => {
            if (audioElement.value.readyState >= 2) {
              resolve()
              return
            }
            audioElement.value.addEventListener('canplay', resolve, { once: true })
            audioElement.value.addEventListener('error', reject, { once: true })
            // Timeout after 3 seconds
            setTimeout(() => {
              if (audioElement.value.readyState >= 2) {
                resolve()
              } else {
                console.warn('Audio preload timeout, but continuing anyway')
                resolve() // Resolve anyway to not block
              }
            }, 3000)
          })
          console.log('[TransactionDetail] HTML5 audio preloaded, readyState:', audioElement.value.readyState)
        } catch (error) {
          console.warn('Failed to preload HTML5 audio:', error)
        }
      }
      
      // Preload sound for native platforms
      if ($q.platform.is.capacitor) {
        try {
          let path = 'send-success.mp3'
          if ($q.platform.is.ios) {
            // For iOS, use the correct path - file should be in public/assets/
            path = 'public/assets/send-success.mp3'
          }
          
          await NativeAudio.preload({
            assetId: 'send-success',
            assetPath: path,
            audioChannelNum: 1,
            volume: 1.0,
            isUrl: false
          })
        } catch (error) {
          console.warn('Failed to preload audio:', error)
          // Continue without preload - will use HTML5 fallback
        }
      }
      
      // Check for preloaded transaction first (from websocket)
      if (preloadedTransaction.value) {
        transaction.value = preloadedTransaction.value
        // Play sound and launch confetti if this is a new transaction
        // Wait for DOM to be fully rendered before triggering
        if (isNewTransaction.value) {
          await nextTick()
          // Wait for next animation frame to ensure content is painted
          await new Promise(resolve => requestAnimationFrame(resolve))
          await launchConfetti()
        }
        // Still try to fetch from server in background to get latest data
        // but don't wait for it - we already have websocket data
        fetchTransaction(true).catch(() => {
          // Silently fail - we already have websocket data
        })
        return
      }
      
      // Otherwise fetch the transaction with retries
      await fetchTransaction()
      
      // Play sound and launch confetti if this is a new transaction (after fetch completes)
      // Wait for DOM to be fully rendered before triggering
      if (isNewTransaction.value && transaction.value) {
        await nextTick()
        // Wait for next animation frame to ensure content is painted
        await new Promise(resolve => requestAnimationFrame(resolve))
        await launchConfetti()
      }
    })
    
    onUnmounted(async () => {
      // Cleanup: unload audio asset for native platforms
      if ($q.platform.is.capacitor) {
        try {
          await NativeAudio.unload({
            assetId: 'send-success'
          })
        } catch (error) {
          // Silently fail if unload doesn't work
        }
      }
    })
    
    const isDarkMode = computed(() => $q.dark.isActive)
    
    // Safe area padding for iOS and Android status bar
    const headerPaddingStyle = computed(() => {
      if ($q.platform.is.ios) {
        return 'padding-top: 3.8em;'
      } else if ($q.platform.is.android) {
        return 'padding-top: 1.5em;'
      }
      return ''
    })
    
    return {
      isDarkMode,
      headerPaddingStyle,
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

