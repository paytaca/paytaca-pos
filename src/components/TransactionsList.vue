<template>
  <div>
    <div
      v-for="(tx, index) in transactions.history" :key="index"
      class="q-pt-sm q-mt-sm q-pb-xs q-mb-xs q-px-sm"
      style="position:relative" v-ripple
      @click="displayTransaction(tx)"
    >
      <div class="row items-center">
        <div class="q-space">
          <div class="text-weight-medium">{{ recordTypeMap[tx.record_type] }}</div>
          <div class="text-subtitle text-grey">
            <template v-if="tx.tx_timestamp">{{ formatDate(tx.tx_timestamp) }}</template>
            <template v-else>{{ formatDate(tx.date_created) }}</template>
          </div>
        </div>
        <div class="text-body2 text-weight-medium text-right">
          <div>
            {{ tx.amount }} BCH
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
import ago from 's-ago'
import { defineComponent, ref } from 'vue'
import TransactionDetailDialog from 'src/components/TransactionDetailDialog.vue'
import { useWalletStore } from 'src/stores/wallet'

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
})
</script>
