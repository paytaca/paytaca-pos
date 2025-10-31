<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width:300px;">
      <div class="row no-wrap items-center justify-center q-pl-md q-py-sm">
        <div class="text-h5 q-space q-mt-sm"> {{ $t('Transaction') }} </div>
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
                {{ $t('TransactionWasConfirmedOffline') }}
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
            <img
              v-if="tokenMetadata?.imageUrl"
              height="35"
              :src="convertIpfsUrl(tokenMetadata?.imageUrl)"
              :fallback-src="convertIpfsUrl(tokenMetadata?.imageUrl, 1)"
              @error="onImgErrorIpfsSrc"
            />
            <img v-else src="~assets/bch-logo.webp" height="30"/>
          </q-item-section>
          <q-item-section v-if="!transaction?._offline || transaction?.amount">
            <q-item-label class="text-h5">
              <template v-if="transaction.record_type === 'outgoing'">{{ transactionAmount?.value * -1 }}</template>
              <template v-else> {{ transactionAmount?.value }}</template>
              {{ transactionAmount?.symbol }}
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
            <q-item-label class="text-grey" caption>{{ $t('Date') }}</q-item-label>
            <q-item-label>
              <template v-if="transaction.tx_timestamp">{{ formatDate(transaction.tx_timestamp) }}</template>
              <template v-else>{{ formatDate(transaction.date_created) }}</template>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction?.txid" clickable v-ripple @click="copyToClipboard(transaction?.txid)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('ReferenceID') }}</q-item-label>
            <q-item-label>{{ transaction?.txid.substring(0, 6).toUpperCase() }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction?.txid" clickable v-ripple @click="copyToClipboard(transaction?.txid)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('TransactionID') }}</q-item-label>
            <q-item-label>{{ transaction?.txid }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="tokenCategory" clickable v-ripple @click="copyToClipboard(tokenCategory)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('TokenID') }}</q-item-label>
            <q-item-label>{{ tokenCategory }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="tokenMetadata?.name" clickable v-ripple @click="copyToClipboard(tokenMetadata.name)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('TokenName') }}</q-item-label>
            <q-item-label>{{ tokenMetadata.name }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction.record_type === 'incoming' && transaction?.senders?.length" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">
              {{ transaction?.senders?.length > 1 ? $t('Senders') : $t('Sender') }}
            </q-item-label>
            <q-item-label>{{ concatenate(transaction?.senders) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction.record_type === 'outgoing' && transaction?.recipients?.length" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">
              {{ transaction?.recipients?.length > 1 ? $t('Recipients') : $t('Recipient') }}
            </q-item-label>
            <q-item-label>{{ concatenate(transaction?.recipients) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction?.tx_fee">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('MinerFee') }}</q-item-label>
            <q-item-label >{{ transaction?.tx_fee / (10**8) }} BCH</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="commerceHubSalesOrderId" v-ripple clickable @click="() => displayCommerceHubSalesOrder()">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('Sale') }}</q-item-label>
            <q-item-label class="text-underline">{{ $t('ViewInfo') }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="transaction?.txid" clickable>
          <q-item-section>
            <q-item-label class="text-gray" caption>{{ $t('ExplorerLink') }}</q-item-label>
            <q-item-label>
              <a
                :href="'https://blockchair.com/bitcoin-cash/transaction/' + transaction?.txid"
                :class="$q.dark.isActive ? 'text-blue-5' : 'text-blue-9'" style="text-decoration: none;"
                target="_blank"
              >
                {{ $t('ViewInExplorer') }}
              </a>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { SalesOrder } from 'src/marketplace/objects'
import { resolveTransactionSalesOrderId } from 'src/marketplace/utils'
import { useTransactionHelpers } from 'src/composables/transaction'
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, defineComponent, inject, ref, watch } from 'vue'
import SalesOrderDetailDialog from './marketplace/sales/SalesOrderDetailDialog.vue'


export default defineComponent({
  name: 'TransactionDetailDialog',
  emits: [
    'update:model-value',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    modelValue: Boolean,
    transaction: Object,
  },
  setup(props, ctx, ) {
    // dialog plugins requirement
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const $q = useQuasar()
    const cashtokenStore = useCashtokenStore();
    const { t: $t } = useI18n()

    const innerVal = ref(props.modelValue)
    watch(innerVal, () => ctx.emit('update:model-value', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    const actionMap = ref({ incoming: $t('RECEIVED'), outgoing: $t('SENT')})
    const iconMap = ref({ incoming: 'arrow_downward', outgoing: 'arrow_upward'})

    const {
      selectedMarketCurrency,
      getTxMarketValue,
      getTxAmount,
    } = useTransactionHelpers();

    const transactionAmount = computed(() => getTxAmount(props.transaction));
    const transactionAmountMarketValue = computed(() => {
      const marketValue = parseFloat(getTxMarketValue(props.transaction)?.marketValue);
      if (Number.isNaN(marketValue)) return null;
      if (marketValue < 10 ** -2) return marketValue;
      return marketValue.toFixed(2);
    });

    const tokenCategory = computed(() => props.transaction?.ft_category || props.transaction?.nft_category);
    const tokenMetadata = computed(() => cashtokenStore.getTokenMetadata(tokenCategory.value))
    watch(tokenCategory, (newVal) => {
      if (!newVal) return;
      if (cashtokenStore.getTokenMetadata(newVal)) return
      cashtokenStore.fetchTokenMetadata(newVal);
    })

    const salesOrder = ref(SalesOrder.parse())
    const commerceHubSalesOrderId = computed(() => resolveTransactionSalesOrderId(props.transaction))
    function displayCommerceHubSalesOrder() {
      if (salesOrder.value.id != commerceHubSalesOrderId.value) {
        salesOrder.value = SalesOrder.parse({ id: commerceHubSalesOrderId.value })
        salesOrder.value.refetch()
      }

      $q.dialog({
        component: SalesOrderDetailDialog,
        componentProps: { salesOrder: salesOrder.value },
      })
    }

    function concatenate (array) {
      if (!Array.isArray(array)) return ''
      let addresses = array
        .map(item => item?.[0])
        .filter(Boolean)
        .filter((e, i , s) => s.indexOf(e) === i)

      return addresses.join(', ')
    }

    function formatDate (date) {
      const dateObj = new Date(date)
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(dateObj)
    }

    const $copyText = inject('$copyText');
    function copyToClipboard(value, message='') {
      $copyText(value).then(() => {
        $q.notify({
          message: message || $t('Copied to clipboard'),
          timeout: 800,
          icon: 'mdi-clipboard-check',
          color: 'blue-9'
        })
      })
      .catch(() => {})
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,
      actionMap,
      iconMap,

      selectedMarketCurrency,
      transactionAmount,
      transactionAmountMarketValue,
    
      tokenCategory,
      tokenMetadata,

      commerceHubSalesOrderId,
      displayCommerceHubSalesOrder,

      concatenate,
      formatDate,
      copyToClipboard,

      convertIpfsUrl,
      onImgErrorIpfsSrc,
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
