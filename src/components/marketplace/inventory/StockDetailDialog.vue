<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section>
        <div class="text-h5">{{ stock?.itemName || `Stock#${stock?.id}` }}</div>
        <div class="text-caption bottom text-grey">stock#{{ stock?.id }}</div>
      </q-card-section>
      <q-card-section v-if="stock?.$state?.updating" class="row items-center justify-center">
        <q-spinner size="2.5em"/>
      </q-card-section>
      <q-card-section v-else class="q-pt-sm">
        <div class="row items-start q-gutter-x-md q-gutter-y-sm">
          <div
            v-if="stock.purchaseOrderNumber"
            :class="{ 'text-weight-medium': stock.purchaseOrderId }"
            @click="() => showStockPurchaseOrder()"
          >
            <q-item-label class="text-caption top">Purchase Order</q-item-label>
            <q-item-label>
              {{ stock.purchaseOrderNumber }}
            </q-item-label>
          </div>

          <div>
            <q-item-label class="text-caption top">Quantity</q-item-label>
            <q-item-label>{{ stock.quantity || 0 }}</q-item-label>
          </div>
          <div v-if="stock.costPrice">
            <q-item-label class="text-caption top">Cost Price</q-item-label>
            <q-item-label>{{ stock.costPrice }} {{ marketplaceStore?.currency }}</q-item-label>
          </div>
          <div v-if="stock.shop?.name">
            <q-item-label class="text-caption top">Shop</q-item-label>
            <q-item-label>{{ stock.shop?.name }}</q-item-label>
          </div>
          <div v-if="stock.expiresAt">
            <q-item-label class="text-caption top">Expires</q-item-label>
            <q-item-label>{{ formatDateRelative(stock.expiresAt) }}</q-item-label>
            <q-menu class="q-pa-sm">
              {{ formatTimestampToText(stock.expiresAt) }}
            </q-menu>
          </div>
        </div>

        <div class="row items-center q-mt-md">
          <div class="text-subtitle1 q-space">
            Stock changes
            <q-spinner v-if="stock?.$state?.fetchingAdjustments" size="1.25em"/>
          </div>
          <q-btn
            flat
            round
            padding="sm"
            icon="refresh"
            @click="() => stock?.fetchAdjustments({ append: false })"
          />
        </div>
        <q-list
          v-if="!stock?.$state?.fetchingAdjustments || appending" 
          separator
          style="max-height:45vh;overflow:auto;"
        >
          <q-item v-for="(adjustment,index) in stock?.adjustments?.data" :key="index" dense>
            <q-item-section>
              <q-item-label>
                <template v-if="adjustment?.adjustType === 'set'">
                  Changed
                  <template v-if="adjustment?.previousQuantity">
                    from {{ adjustment?.previousQuantity }}
                  </template>
                  to {{ adjustment?.quantity }}
                </template>
                <template v-else-if="adjustment?.adjustType === 'add'">
                  <template v-if="adjustment?.quantity < 0">Deducted</template>
                  <template v-else>Added</template>
                  {{ Math.abs(adjustment?.quantity) }}
                </template>
                <template v-if="adjustment?.source === 'sales'">
                  from
                  <span
                    :class="adjustment.salesOrderId ? 'text-weight-medium': ''"
                    @click="() => showStockAdjustmentSalesOrder(adjustment)"
                  >
                    sales
                  </span>
                </template>
                <template v-else-if="adjustment.source === 'purchase_orders'">
                  from
                  <span
                    :class="adjustment.purchaseOrderId ? 'text-weight-medium': ''"
                    @click="() => showStockAdjustmentPurchaseOrder(adjustment)"
                  >
                    purchase order
                  </span>
                </template>
                <template v-else-if="adjustment.source === 'stock_recount'">
                  from 
                  <span
                    :class="adjustment.stockRecountId ? 'text-weight-medium': ''"
                    @click="() => showStockAdjustmentRecount(adjustment)"
                  >
                    stock recount
                  </span>
                </template>
                <template v-else-if="adjustment.source === 'initial_stock'">
                  from initial stock
                </template>
              </q-item-label>
              <q-item-label class="text-caption">
                {{ adjustment?.createdBy?.firstName }}
                {{ adjustment?.createdBy?.lastName }}
              </q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-item-label>
                {{ formatDateRelative(adjustment?.createdAt) }}
                <q-menu class="q-py-sm q-px-md">
                  {{ formatTimestampToText(adjustment?.createdAt) }}
                </q-menu>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-if="stock?.adjustments?.hasMore" class="row items-center justify-center">
          <q-btn
            flat
            no-caps
            label="View more"
            padding="sm md"
            class="full-width"
            @click="() => viewMoreAdjustments()"
          />
        </div>
      </q-card-section>
    </q-card>
    <SalesOrderDetailDialog
      v-model="salesOrderDetailDialog.show"
      :salesOrder="salesOrderDetailDialog.salesOrder"
    />
    <PurchaseOrderDetailDialog
      v-model="purchaseOrderDetailDialog.show"
      :purchaseOrder="purchaseOrderDetailDialog.purchaseOrder"
    />
    <StockRecountDetailDialog
      v-model="stockRecountDetailDialog.show"
      :stockRecount="stockRecountDetailDialog.stockRecount"
    />
  </q-dialog>
</template>
<script>

import { PurchaseOrder, SalesOrder, Stock, StockAdjustment, StockRecount } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { defineComponent, onMounted, ref, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useMarketplaceStore } from 'src/stores/marketplace'
import SalesOrderDetailDialog from 'src/components/marketplace/sales/SalesOrderDetailDialog.vue'
import PurchaseOrderDetailDialog from './PurchaseOrderDetailDialog.vue'
import StockRecountDetailDialog from './StockRecountDetailDialog.vue'

export default defineComponent({
  name: "StockDetailDialog",
  components: {
    SalesOrderDetailDialog,
    PurchaseOrderDetailDialog,
    StockRecountDetailDialog,
  },
  props: {
    stock: Stock,
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
    const marketplaceStore = useMarketplaceStore();
    onMounted(() => refreshAdjustments())
    watch(() => [props.stock], () => refreshAdjustments())
    function refreshAdjustments() {
      if (!props.stock.adjustments) props.stock.fetchAdjustments()
    }
    const appending = ref(false);
    async function viewMoreAdjustments() {
      try {
        appending.value = true;
        await props.stock.fetchAdjustments?.({ append: true });
      } finally {
        appending.value = false;
      }
    }

    const salesOrderDetailDialog = ref({ show: false, salesOrder: SalesOrder.parse() })
    function showStockAdjustmentSalesOrder(stockAdjustment = StockAdjustment.parse()) {
      if (!stockAdjustment.salesOrderId) return

      if (!stockAdjustment.salesOrder?.id) {
        stockAdjustment.salesOrder = SalesOrder.parse({ id: stockAdjustment.salesOrderId });
        stockAdjustment.salesOrder.refetch();
      }
      salesOrderDetailDialog.value.salesOrder = stockAdjustment.salesOrder
      salesOrderDetailDialog.value.show = true
    }

    const purchaseOrderDetailDialog = ref({ show: false, purchaseOrder: PurchaseOrder.parse() })
    function showStockAdjustmentPurchaseOrder(stockAdjustment = StockAdjustment.parse()) {
      if (!stockAdjustment.purchaseOrderId) return

      if (!stockAdjustment.purchaseOrder?.id) {
        stockAdjustment.purchaseOrder = PurchaseOrder.parse({ id: stockAdjustment.purchaseOrderId });
        stockAdjustment.purchaseOrder.refetch();
      }
      purchaseOrderDetailDialog.value.purchaseOrder = stockAdjustment.purchaseOrder
      purchaseOrderDetailDialog.value.show = true
    }

    const stockRecountDetailDialog = ref({ show: false, stockRecount: StockRecount.parse() })
    function showStockAdjustmentRecount(stockAdjustment = StockAdjustment.parse()) {
      if (!stockAdjustment.stockRecountId) return
      if (!stockAdjustment.stockRecount?.id) {
        stockAdjustment.stockRecount = StockRecount.parse({ id: stockAdjustment.stockRecountId })
        stockAdjustment.stockRecount.refetch()
      }

      stockRecountDetailDialog.value.stockRecount = stockAdjustment.stockRecount
      stockRecountDetailDialog.value.show = true
    }

    async function showStockPurchaseOrder() {
      if (!props.stock?.purchaseOrderId) return
      purchaseOrderDetailDialog.value.purchaseOrder = props.stock.purchaseOrder || PurchaseOrder.parse({ id: props.stock.purchaseOrderId });
      purchaseOrderDetailDialog.value.show = true

      if (!props.stock.purchaseOrder) {
        await props.stock.fetchPurchaseOrder()
        purchaseOrderDetailDialog.value.purchaseOrder = props.stock.purchaseOrder
      }
    }

    return {
        dialogRef,
        onDialogHide,
        onDialogOK,
        onDialogCancel,
        marketplaceStore,
        appending,
        viewMoreAdjustments,

        salesOrderDetailDialog,
        showStockAdjustmentSalesOrder,

        purchaseOrderDetailDialog,
        showStockAdjustmentPurchaseOrder,
        showStockPurchaseOrder,

        stockRecountDetailDialog,
        showStockAdjustmentRecount,

        // utils funcs
        formatDateRelative,
        formatTimestampToText,
    };
  },
})
</script>
