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
        </div>
        <div class="text-h6 text-center q-mt-sm">
          <q-icon :name="iconMap[transaction.record_type]" class="record-type-icon"/>
        </div>
      </q-card-section>
      <q-card-section class="q-mt-xs">
        <q-item clickable v-ripple @click="copyToClipboard(String(transaction.amount))">
          <q-item-section side>
            <img src="~assets/bch-logo.png" height="30"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-h5">
              <template v-if="transaction.record_type === 'outgoing'">{{ transaction.amount * -1 }} BCH</template>
              <template v-else> {{ transaction.amount }} BCH </template>
            </q-item-label>
            <q-item-label v-if="transactionAmountMarketValue" caption>
              {{ transactionAmountMarketValue }} {{ selectedMarketCurrency }}
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
        <q-item clickable v-ripple @click="copyToClipboard(transaction?.txid)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">Transaction ID</q-item-label>
            <q-item-label>{{ transaction?.txid }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction.record_type === 'incoming'" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">
              {{ transaction?.senders?.length > 1 ? 'Senders' : 'Sender' }}
            </q-item-label>
            <q-item-label>{{ concatenate(transaction?.senders) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction.record_type === 'outgoing'" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">
              {{ transaction?.recipients?.length > 1 ? 'Recipients' : 'Recipient' }}
            </q-item-label>
            <q-item-label>{{ concatenate(transaction?.recipients) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section>
            <q-item-label caption class="text-grey">Miner fee</q-item-label>
            <q-item-label >{{ transaction?.tx_fee / (10**8) }} BCH</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable>
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
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref } from 'vue'

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
      return 'USD'
    },
    transactionAmountMarketValue() {
      if (!this.transaction?.usd_price) return
      const value = Number(this.transaction.amount) * Number(this.transaction?.usd_price)
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

    const actionMap = ref({ incoming: 'RECEIVED', outgoing: 'SENT'})
    const iconMap = ref({ incoming: 'arrow_downward', outgoing: 'arrow_upward'})
    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      actionMap,
      iconMap,
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