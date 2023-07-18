<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width:300px;">
      <div class="row no-wrap items-center justify-center q-pl-md q-py-sm">
        <div class="text-h5 q-space q-mt-sm"> Transaction </div>
        <q-btn
          flat
          padding="sm"
          icon="close"
          v-close-popup
        />
      </div>
      <q-card-section class="q-pt-none">
        <div class="text-h6 text-center">
          {{ actionMap[transaction.record_type] }}
          <q-icon
            v-if="transaction._offline"
            name="cloud_off"
            size="1.25em"
            :class="$q.dark.isActive ? '': 'text-grey'"
          >
            <q-popup-proxy :breakpoint="0">
              <div class="q-pa-md">
                Transaction was confirmed offline
              </div>
            </q-popup-proxy>
          </q-icon>
        </div>
        <div class="text-h6 text-center q-mt-sm">
          <q-icon :name="iconMap[transaction.record_type]" class="record-type-icon"/>
        </div>
      </q-card-section>
      <q-card-section class="q-mt-xs">
        <q-item clickable v-ripple @click="copyToClipboard(String(transaction.amount))">
          <q-item-section v-if="!transaction?._offline || transaction?.amount" side>
            <img src="~assets/bch-logo.png" height="30"/>
          </q-item-section>
          <q-item-section v-if="!transaction?._offline || transaction?.amount">
            <q-item-label class="text-h5">
              <template v-if="transaction.record_type === 'outgoing'">{{ transaction.amount * -1 }} BCH</template>
              <template v-else> {{ transaction.amount }} BCH </template>
            </q-item-label>
            <q-item-label v-if="transactionAmountMarketValue" caption>
              {{ transactionAmountMarketValue }} {{ selectedMarketCurrency }}
            </q-item-label>
          </q-item-section>
          <q-item-section v-else-if="transaction?.marketValue?.amount && transaction?.marketValue?.currency">
            <q-item-label class="text-h5">
              {{transaction?.marketValue?.amount}} {{transaction?.marketValue?.currency}}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable v-ripple @click="copyToClipboard(formatDate(transaction.tx_timestamp || transaction.date_created))">
          <q-item-section>
            <q-item-label class="text-grey" caption>Date</q-item-label>
            <q-item-label>
              <template v-if="transaction.tx_timestamp">{{ formatDate(transaction.tx_timestamp) }}</template>
              <template v-else>{{ formatDate(transaction.date_created) }}</template>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction?.txid" clickable v-ripple @click="copyToClipboard(transaction?.txid)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">Transaction ID</q-item-label>
            <q-item-label>{{ transaction?.txid }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction.record_type === 'incoming' && transaction?.senders?.length" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">
              {{ transaction?.senders?.length > 1 ? 'Senders' : 'Sender' }}
            </q-item-label>
            <q-item-label>{{ concatenate(transaction?.senders) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction.record_type === 'outgoing' && transaction?.recipients?.length" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">
              {{ transaction?.recipients?.length > 1 ? 'Recipients' : 'Recipient' }}
            </q-item-label>
            <q-item-label>{{ concatenate(transaction?.recipients) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction?.tx_fee">
          <q-item-section>
            <q-item-label caption class="text-grey">Miner fee</q-item-label>
            <q-item-label >{{ transaction?.tx_fee / (10**8) }} BCH</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="commerceHubSalesOrderId" v-ripple clickable @click="() => displayCommerceHubSalesOrder()">
          <q-item-section>
            <q-item-label caption class="text-grey">Sale</q-item-label>
            <q-item-label>View Info</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction?.txid" clickable>
          <q-item-section>
            <q-item-label class="text-gray" caption>Explorer Link</q-item-label>
            <q-item-label>
              <a
                :href="'https://blockchair.com/bitcoin-cash/transaction/' + transaction?.txid"
                :class="$q.dark.isActive ? 'text-blue-5' : 'text-blue-9'" style="text-decoration: none;"
                target="_blank"
              >
                View in explorer
              </a>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { SalesOrder } from 'src/marketplace/objects'
import { resolveTransactionSalesOrderId } from 'src/marketplace/utils'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, defineComponent, ref } from 'vue'
import { useWalletStore } from 'src/stores/wallet'
import SalesOrderDetailDialog from './marketplace/sales/SalesOrderDetailDialog.vue'

const walletStore = useWalletStore()

export default defineComponent({
  name: 'TransactionDetailDialog',
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    transaction: Object,
  },
  computed: {
    asset() {
      return {
        symbol: 'BCH',
        logo: '~assets/bch-logo.png',
      }
    }
  },
  computed: {
    selectedMarketCurrency () {
      return walletStore?.preferences?.selectedCurrency || 'USD'
    },
    marketPrice() {
      if(this.transaction?.usd_price && this.selectedMarketCurrency === 'USD') return this.transaction?.usd_price
      if (this.transaction?.market_prices?.[this.selectedMarketCurrency]) return this.transaction?.market_prices?.[this.selectedMarketCurrency]
      return null
    },
    transactionAmountMarketValue() {
      if (!this.marketPrice) return

      const value = Number(this.transaction.amount) * Number(this.marketPrice)
      if (value < 10 ** -2) return value
      return value.toFixed(2)
    },
  },
  methods: {
    concatenate (array) {
      if (!Array.isArray(array)) return ''
      let addresses = array
        .map(item => item?.[0])
        .filter(Boolean)
        .filter((e, i , s) => s.indexOf(e) === i)

      return addresses.join(', ')
    },
    formatDate (date) {
      const dateObj = new Date(date)
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(dateObj)
    },
    copyToClipboard(value, message='') {
      this.$copyText(value)
        .then(() => {
          this.$q.notify({
            message: message || 'Copied to clipboard',
            timeout: 800,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        })
        .catch(() => {})
    }
  },
  setup(props, ctx, ) {
    // dialog plugins requirement
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const $q = useQuasar()

    const actionMap = ref({ incoming: 'RECEIVED', outgoing: 'SENT'})
    const iconMap = ref({ incoming: 'arrow_downward', outgoing: 'arrow_upward'})

    const salesOrder = ref(SalesOrder.parse())
    const commerceHubSalesOrderId = computed(() => resolveTransactionSalesOrderId(props.transaction))
    function displayCommerceHubSalesOrder() {
      if (salesOrder.value.id != commerceHubSalesOrderId.value) {
        const _salesOrder = SalesOrder.parse({ id: commerceHubSalesOrderId.value })
        _salesOrder.refetch()
          .then(() => {
            salesOrder.value.raw = _salesOrder.raw
          })
      }

      $q.dialog({
        component: SalesOrderDetailDialog,
        componentProps: { salesOrder: salesOrder.value },
      })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      actionMap,
      iconMap,

      commerceHubSalesOrderId,
      displayCommerceHubSalesOrder,
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