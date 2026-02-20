<template>
  <div class="transactions-list-container">
    <div
      v-for="(tx, index) in transactionsList"
      :key="index"
      class="transaction-item q-py-sm q-px-sm"
      :class="{
        'transaction-item-clickable':
          tx?.record_type === 'incoming' && tx?.txid,
      }"
      v-ripple
      @click="displayTransaction(tx)"
    >
      <div class="row items-center">
        <q-avatar
          :color="tx.record_type === 'incoming' ? 'positive' : 'negative'"
          text-color="white"
          size="36px"
          class="q-mr-md"
        >
          <q-icon
            :name="
              tx.record_type === 'incoming' ? 'arrow_downward' : 'arrow_upward'
            "
            size="20px"
          />
        </q-avatar>
        <div class="q-space">
          <div class="row items-center">
            <span class="text-weight-medium">{{
              recordTypeMap[tx.record_type]
            }}</span>
            <q-icon
              v-if="tx._offline"
              name="cloud_off"
              size="1em"
              class="q-ml-xs"
              :class="$q.dark.isActive ? '' : 'text-grey'"
            />
            <q-chip
              v-if="resolveTransactionSalesOrderId(tx)"
              dense
              clickable
              color="brandblue"
              class="q-my-none q-ml-sm text-white"
              @click.stop="
                () =>
                  displayCommerceHubSalesOrder(
                    resolveTransactionSalesOrderId(tx)
                  )
              "
            >
              Sale
            </q-chip>
          </div>
          <div class="text-caption text-grey q-mt-xs">
            <template v-if="tx.tx_timestamp">{{
              formatDate(tx.tx_timestamp)
            }}</template>
            <template v-else>{{ formatDate(tx.date_created) }}</template>
          </div>
        </div>
        <div class="text-right">
          <div v-if="getTxAmount(tx)?.value" class="text-weight-medium">
            <span
              :class="
                tx.record_type === 'incoming'
                  ? 'text-positive'
                  : 'text-negative'
              "
            >
              {{ tx.record_type === "incoming" ? "+" : "-" }}
            </span>
            {{ formatNumberAutoDecimals(getTxAmount(tx)?.value) }}
            {{ getTxAmount(tx)?.symbol }}
          </div>
          <div
            v-else-if="
              tx?._offline &&
              tx?.marketValue?.currency &&
              tx?.marketValue?.amount
            "
            class="text-weight-medium"
          >
            {{ formatNumberAutoDecimals(tx?.marketValue?.amount) }}
            {{ tx?.marketValue?.currency }}
          </div>
          <div
            v-if="getTxDisplayFiat(tx)?.value !== null"
            class="text-caption text-grey q-mt-xs"
          >
            {{
              formatNumberWithDecimals(Number(getTxDisplayFiat(tx)?.value), 2)
            }}
            {{ getTxDisplayFiat(tx)?.currency }}
          </div>
        </div>
      </div>
      <q-separator class="q-mt-sm" :dark="$q.dark.isActive" />
    </div>
    <TransactionDetailDialog
      v-model="transactionDetailDialog.show"
      :transaction="transactionDetailDialog.transaction"
    />
  </div>
</template>

<script>
import { SalesOrder } from "src/marketplace/objects";
import { resolveTransactionSalesOrderId } from "src/marketplace/utils";
import { useTransactionHelpers } from "src/composables/transaction";
import ago from "s-ago";
import { useQuasar } from "quasar";
import { defineComponent, computed, ref } from "vue";
import { useRouter } from "vue-router";
import TransactionDetailDialog from "src/components/TransactionDetailDialog.vue";
import { useTxCacheStore } from "src/stores/tx-cache";
import SalesOrderDetailDialog from "./marketplace/sales/SalesOrderDetailDialog.vue";
import { useI18n } from "vue-i18n";
import {
  formatNumberAutoDecimals,
  formatNumberWithDecimals,
} from "src/utils/number-format";

export default defineComponent({
  components: {
    TransactionDetailDialog,
  },
  props: {
    transactions: Object,
  },
  setup(props) {
    const { t: $t } = useI18n();
    const $q = useQuasar();
    const router = useRouter();
    const txCacheStore = useTxCacheStore();

    const recordTypeMap = { incoming: $t("RECEIVED"), outgoing: $t("SENT") };

    const {
      selectedMarketCurrency,
      getTxMarketValue,
      getTxDisplayFiat,
      getTxAmount,
    } = useTransactionHelpers();

    const txHistoryTimestampBounds = computed(() => {
      const data = { min: undefined, max: undefined };
      if (!Array.isArray(props.transactions.history)) return data;

      const timestamps = props.transactions.history
        .map((tx) => tx.date_created)
        .map((dateCreated) => new Date(dateCreated) * 1)
        .filter((timestamp) => !Number.isNaN(timestamp));

      data.min = Math.min(...timestamps);
      data.max = Math.max(...timestamps);

      return data;
    });

    const offlineTransactionsToShow = computed(() => {
      const bounds = Object.assign({}, txHistoryTimestampBounds.value);

      if (props.transactions?.page === 1) bounds.max = Infinity;
      if (props.transactions?.page === props.transactions?.num_pages)
        bounds.min = -Infinity;

      return txCacheStore.offlineTransactions.filter((tx) => {
        const timestamp = new Date(tx.date_created) * 1;
        return timestamp >= bounds.min && timestamp <= bounds.max;
      });
    });

    const transactionsList = computed(() => {
      if (!offlineTransactionsToShow.value?.length)
        return props.transactions.history;
      const data = props.transactions.history
        .concat(offlineTransactionsToShow.value)
        .sort((tx1, tx2) => {
          const tx1Timestamp = new Date(tx1.tx_timestamp || tx1.date_created);
          const tx2Timestamp = new Date(tx2.tx_timestamp || tx2.date_created);
          return tx2Timestamp - tx1Timestamp;
        });
      return data;
    });

    const transactionDetailDialog = ref({
      show: false,
      transaction: {},
    });

    function displayTransaction(tx) {
      if (tx?.record_type === "incoming" && tx?.txid) {
        router.push({
          name: "transaction-detail",
          params: { txid: tx.txid },
          state: { tx },
        });
      } else {
        transactionDetailDialog.value.transaction = tx;
        transactionDetailDialog.value.show = true;
      }
    }

    const salesOrder = ref(SalesOrder.parse());
    function displayCommerceHubSalesOrder(salesOrderId = 0) {
      if (!salesOrderId) return;
      if (salesOrder.value.id != salesOrderId) {
        salesOrder.value = SalesOrder.parse({ id: salesOrderId });
        salesOrder.value.refetch();
      }

      $q.dialog({
        component: SalesOrderDetailDialog,
        componentProps: { salesOrder: salesOrder.value },
      });
    }

    function formatDate(date) {
      return ago(new Date(date));
    }

    return {
      recordTypeMap,
      selectedMarketCurrency,
      getTxMarketValue,
      getTxDisplayFiat,
      getTxAmount,
      offlineTransactionsToShow,
      transactionsList,

      transactionDetailDialog,
      displayTransaction,

      salesOrder,
      displayCommerceHubSalesOrder,

      resolveTransactionSalesOrderId,
      formatDate,
      formatNumberAutoDecimals,
      formatNumberWithDecimals,
    };
  },
});
</script>

<style lang="scss" scoped>
.transactions-list-container {
  min-height: 100px;
}

.transaction-item {
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.transaction-item-clickable {
  cursor: pointer;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
}

.body--dark {
  .transaction-item-clickable:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}
</style>
