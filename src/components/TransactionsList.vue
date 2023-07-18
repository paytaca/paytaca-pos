<template>
  <div>
    <div
      v-for="(tx, index) in transactionsList" :key="index"
      class="q-pt-sm q-mt-sm q-pb-xs q-mb-xs q-px-sm"
      style="position:relative" v-ripple
      @click="displayTransaction(tx)"
    >
      <div class="row items-start">
        <div class="q-space">
          <div class="text-weight-medium">
            {{ recordTypeMap[tx.record_type] }}
            <q-icon
              v-if="tx._offline"
              name="cloud_off"
              size="1.25em"
              class="q-ml-xs"
              :class="$q.dark.isActive ? '': 'text-grey'"
            />
            <q-chip v-if="resolveTransactionSalesOrderId(tx)" color="brandblue" dense class="q-my-none">
              Sale
            </q-chip>
          </div>
          <div class="text-subtitle text-grey">
            <template v-if="tx.tx_timestamp">{{ formatDate(tx.tx_timestamp) }}</template>
            <template v-else>{{ formatDate(tx.date_created) }}</template>
          </div>
        </div>
        <div class="text-body2 text-weight-medium text-right">
          <div v-if="tx.amount">
            {{ tx.amount }} BCH
          </div>
          <div v-else-if="tx?._offline && tx?.marketValue?.currency && tx?.marketValue?.amount">
            {{ tx?.marketValue?.amount }} {{ tx?.marketValue?.currency }}
          </div>
          <div 
            v-if="marketValue(tx)?.marketValue"
            class="text-caption text-grey"
            :class="[$q.dark.isActive ? 'text-weight-light' : '']"
            style="margin-top:-0.25em;"
          >
            {{ marketValue(tx)?.marketValue }} {{ selectedMarketCurrency }}
          </div>
        </div>
      </div>
      <q-separator/>
    </div>
  </div>
</template>
<script>
import { resolveTransactionSalesOrderId } from 'src/marketplace/utils'
import ago from 's-ago'
import { defineComponent, computed, ref } from 'vue'
import TransactionDetailDialog from 'src/components/TransactionDetailDialog.vue'
import { useWalletStore } from 'src/stores/wallet'
import { useTxCacheStore } from 'src/stores/tx-cache'

const walletStore = useWalletStore()

export default defineComponent({
  props: {
    transactions: Object,
  },
  data() {
    return {
      recordTypeMap: {
        incoming: 'RECEIVED',
        outgoing: 'SENT'
      },
    }
  },
  computed: {
    selectedMarketCurrency () {
      return walletStore?.preferences?.selectedCurrency || 'USD'
    },
  },
  methods: {
    formatDate (date) {
      return ago(new Date(date))
    },
    displayTransaction(tx) {
      this.$q.dialog({
        component: TransactionDetailDialog,
        componentProps: { transaction: tx },
      })
    },
    marketValue(transaction) {
      const data = {
        marketAssetPrice: null,
        marketValue: null,
      }

      if (this.selectedMarketCurrency === 'USD' && transaction?.usd_price) {
        data.marketAssetPrice = transaction.usd_price
      } else if (transaction?.market_prices?.[this.selectedMarketCurrency]) {
        data.marketAssetPrice = transaction?.market_prices?.[this.selectedMarketCurrency]
      }

      if (data.marketAssetPrice) {
        data.marketValue = (Number(transaction?.amount) * Number(data.marketAssetPrice)).toFixed(5)
      }
      return data
    }
  },
  setup(props) {
    const txCacheStore = useTxCacheStore()
    const txHistoryTimestampBounds = computed(() => {
      const data = { min: undefined, max: undefined }
      if (!Array.isArray(props.transactions.history)) return data
 
      const timestamps = props.transactions.history
        .map(tx => tx.date_created)
        .map(dateCreated => new Date(dateCreated) * 1)
        .filter(timestamp => !Number.isNaN(timestamp))

      data.min = Math.min(...timestamps)
      data.max = Math.max(...timestamps)

      return data
    })

    const offlineTransactionsToShow = computed(() => {
      const bounds = Object.assign({}, txHistoryTimestampBounds.value)

      if (props.transactions?.page === 1) bounds.max = Infinity
      if (props.transactions?.page === props.transactions?.num_pages) bounds.min = -Infinity

      return txCacheStore.offlineTransactions
        .filter(tx => {
          const timestamp = new Date(tx.date_created) * 1
          return timestamp >= bounds.min && timestamp <= bounds.max
        })
    })

    const transactionsList = computed(() => {
      if (!offlineTransactionsToShow.value?.length) return props.transactions.history
      const data = props.transactions.history.concat(offlineTransactionsToShow.value)
        .sort((tx1, tx2) => {
          const tx1Timestamp = new Date(tx1.tx_timestamp || tx1.date_created)
          const tx2Timestamp = new Date(tx2.tx_timestamp || tx2.date_created)
          return tx2Timestamp - tx1Timestamp
        })
      return data
    })

    return {
      offlineTransactionsToShow,
      transactionsList,

      resolveTransactionSalesOrderId,
    }
  }
})
</script>
