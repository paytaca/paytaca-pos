<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" transition-show="slide-up" transition-hide="slide-down">
    <q-card class="q-dialog-plugin" style="position:relative;">
      <div class="row no-wrap items-start q-pl-md q-pt-md q-pb-sm q-pr-md">
        <div class="col">
          <div v-if="displayMerchantName" class="text-h6">{{ displayMerchantName }}</div>
          <div v-if="displayPosName" class="text-caption text-grey">{{ displayPosName }}</div>
        </div>
        <q-btn
          flat
          padding="sm"
          icon="close"
          class="text-brandblue"
          v-close-popup
        />
      </div>
      <q-card-section class="q-py-md">
        <div class="text-h6 text-center">
          {{ $t('RECEIVED') }}
        </div>
        <div class="text-h6 text-center q-mt-sm">
          <q-icon name="arrow_downward" class="record-type-icon"/>
        </div>
      </q-card-section>
      <q-card-section class="q-mt-xs">
        <q-item clickable v-ripple @click="copyText(String(displayAmount))">
          <q-item-section v-if="displayLogo" side>
            <img
              v-if="displayLogo && displayLogo !== 'bch-logo.png'"
              height="35"
              :src="displayLogo"
              @error="onImgErrorIpfsSrc"
            />
            <img v-else-if="displayLogo === 'bch-logo.png'" src="~assets/bch-logo.webp" height="30"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-h5">
              {{ formatNumberAutoDecimals(displayAmount) }} {{ displayTokenCurrency }}
            </q-item-label>
            <q-item-label v-if="displayFiatAmount !== null && displayFiatAmount !== undefined && displayFiatCurrency" class="text-body1 text-grey">
              {{ typeof displayFiatAmount === 'number' ? formatNumberWithDecimals(displayFiatAmount, 2) : displayFiatAmount }} {{ displayFiatCurrency }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable v-ripple @click="copyText(displayDate)">
          <q-item-section>
            <q-item-label class="text-grey" caption>{{ $t('Date') }}</q-item-label>
            <q-item-label>{{ displayDate }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="displayTxid" clickable v-ripple @click="copyText(hexToRef(displayTxid.substring(0, 6)))" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('ReferenceID') }}</q-item-label>
            <q-item-label>{{ hexToRef(displayTxid.substring(0, 6)) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="displayTxid" clickable v-ripple @click="copyText(displayTxid)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('TransactionID') }}</q-item-label>
            <q-item-label>{{ displayTxid }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="displaySenders && displaySenders.length > 0" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">
              {{ displaySenders.length > 1 ? $t('Senders') : $t('Sender') }}
            </q-item-label>
            <q-item-label>{{ concatenate(displaySenders) }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { hexToRef } from 'src/utils/reference-id-utils'
import { useI18n } from 'vue-i18n'
import { defineComponent, ref, onMounted, inject, computed, watch } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { useTransactionHelpers } from 'src/composables/transaction'
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useWalletStore } from 'src/stores/wallet'
import confetti from 'canvas-confetti'
import { formatNumberAutoDecimals, formatNumberWithDecimals } from 'src/utils/number-format'

export default defineComponent({
  name: 'ReceiveUpdateDialog',
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    // Individual props (for payment success from websocket)
    txid: String,
    address: String,
    amount: [String, Number],
    tokenCurrency: String,
    marketValue: [String, Number],
    marketValueCurrency: String,
    logo: [String, null],
    expectedAmount: [String, Number],
    fiatReferenceAmount: [String, Number],
    fiatReferenceCurrency: String,
    senders: Array,
    tokenName: String,
    tokenId: String,
    tokenDecimals: Number,
    merchantName: String,
    posName: String,
    // Transaction object (for viewing from history)
    transaction: Object,
    // Whether this is a new transaction (show confetti)
    isNewTransaction: {
      type: Boolean,
      default: true
    },
  },
  setup(props) {
    const $q = useQuasar()
    const { t } = useI18n()
    const walletStore = useWalletStore()
    const cashtokenStore = useCashtokenStore()
    const { getTxAmount, getTxDisplayFiat } = useTransactionHelpers()

    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    
    const $copyText = inject('$copyText')
    
    // If transaction object is provided, extract data from it
    const isFromTransaction = computed(() => Boolean(props.transaction))
    
    // Computed values that work with both individual props and transaction object
    const displayTxid = computed(() => {
      if (isFromTransaction.value) return props.transaction?.txid
      return props.txid
    })
    
    const displayAmount = computed(() => {
      if (isFromTransaction.value) {
        const txAmount = getTxAmount(props.transaction)
        return txAmount?.value || props.transaction?.amount
      }
      return props.amount
    })
    
    const displayTokenCurrency = computed(() => {
      if (isFromTransaction.value) {
        const txAmount = getTxAmount(props.transaction)
        return txAmount?.symbol || 'BCH'
      }
      return props.tokenCurrency || 'BCH'
    })
    
    const displayFiatAmount = computed(() => {
      if (isFromTransaction.value) {
        const fiat = getTxDisplayFiat(props.transaction)
        return fiat?.value
      }
      return props.fiatReferenceAmount || props.marketValue
    })
    
    const displayFiatCurrency = computed(() => {
      if (isFromTransaction.value) {
        const fiat = getTxDisplayFiat(props.transaction)
        return fiat?.currency
      }
      return props.fiatReferenceCurrency || props.marketValueCurrency
    })
    
    const displayLogo = computed(() => {
      if (isFromTransaction.value) {
        const tokenCategory = props.transaction?.ft_category || props.transaction?.nft_category
        if (tokenCategory) {
          const metadata = cashtokenStore.getTokenMetadata(tokenCategory)
          if (metadata?.imageUrl) {
            return convertIpfsUrl(metadata.imageUrl)
          }
        }
        return 'bch-logo.png'
      }
      return props.logo
    })
    
    const displayDate = computed(() => {
      if (isFromTransaction.value) {
        const date = props.transaction?.tx_timestamp || props.transaction?.date_created
        if (date) {
          return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(date))
        }
      }
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date())
    })
    
    const displayMerchantName = computed(() => {
      if (isFromTransaction.value) return null
      return props.merchantName
    })
    
    const displayPosName = computed(() => {
      if (isFromTransaction.value) return null
      return props.posName
    })
    
    const displaySenders = computed(() => {
      if (isFromTransaction.value) {
        return props.transaction?.senders || []
      }
      return props.senders || []
    })
    
    // Fetch token metadata when transaction is provided
    watch(() => props.transaction, (tx) => {
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
      // Launch confetti from center of dialog
      // Origin: center horizontally (0.5), slightly above center vertically (0.4)
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
    
    onMounted(() => {
      // Only show confetti for new transactions (payment success)
      if (props.isNewTransaction) {
      // Trigger confetti after the slide-up animation completes (400ms)
      setTimeout(() => {
          launchConfetti()
      }, 400)
      }
    })

    function onOk() {
      // Only check expected amount for payment success (not for history views)
      if (isFromTransaction.value || !props.expectedAmount) return onDialogOK()

      const expectedAmount = parseFloat(props.expectedAmount)
      const amount = parseFloat(props?.amount)
      const errorAmount = Math.abs(expectedAmount - amount)
      const allowedErrorAmount = 1000 / 10 ** 8
      if (errorAmount > allowedErrorAmount ) {
        $q.dialog({
          title: t('AmountErrTitle'),
          message: t('AmountErrMsg'),
          ok: { color: 'brandblue' },
          cancel: true,
        }).onOk(() => onDialogOK())
          .onDismiss(() => onDialogHide())
      } else {
        onDialogOK()
      }
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      onOk,
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
      concatenate,
      copyText,
      hexToRef,
      onImgErrorIpfsSrc,
      formatNumberAutoDecimals,
      formatNumberWithDecimals,
    }
  },
})
</script>
<style lang="scss" scoped>
.record-type-icon {
  /* color: #3b7bf6; */
  color: white;
  font-size: 30px;
  background: $brandblue;
  border-radius: 20px;
  padding: 4px;
}
</style>
