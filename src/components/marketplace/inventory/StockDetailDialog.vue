<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section>
        <div class="text-h5">
          {{
            stock?.itemName ||
            $t(
              'StockId',
              { id: stock?.id },
              `Stock#${stock?.id}`
            )
          }}
        </div>
        <div class="text-caption bottom text-grey">
          {{
            $t(
              'stockId',
              { id: stock?.id },
              `stock#${stock?.id}`
            )
          }}
        </div>
      </q-card-section>
      <q-card-section v-if="stock?.$state?.updating" class="row items-center justify-center">
        <q-spinner size="2.5em"/>
      </q-card-section>
      <q-card-section v-else class="q-pt-none">
        <div class="row items-start q-r-mx-md">
          <div
            v-if="stock.purchaseOrderNumber"
            :class="{ 'text-weight-medium': stock.purchaseOrderId }"
            class="col-6 col-sm-4 q-pa-sm"
            @click="() => showStockPurchaseOrder()"
          >
            <q-item-label class="text-caption top text-grey">{{ $t('PurchaseOrder') }}</q-item-label>
            <q-item-label>
              {{ stock.purchaseOrderNumber }}
            </q-item-label>
          </div>

          <div class="col-6 col-sm-4 q-pa-sm">
            <q-item-label class="text-caption top text-grey">{{ $t('Quantity') }}</q-item-label>
            <q-item-label>{{ stock.quantity || 0 }}</q-item-label>
          </div>
          <div v-if="stock.costPrice" class="col-6 col-sm-4 q-pa-sm">
            <q-item-label class="text-caption top text-grey">{{ $t('CostPrice') }}</q-item-label>
            <q-item-label>{{ stock.costPrice }} {{ marketplaceStore?.currency }}</q-item-label>
          </div>
          <div v-if="stock.shop?.name && displayShop" class="col-6 col-sm-4 q-pa-sm">
            <q-item-label class="text-caption top text-grey">{{ $t('Shop') }}</q-item-label>
            <q-item-label>{{ stock.shop?.name }}</q-item-label>
          </div>
          <div v-if="stock.expiresAt" class="col-6 col-sm-4 q-pa-sm">
            <q-item-label class="text-caption top text-grey">{{ $t('Expires') }}</q-item-label>
            <q-item-label>{{ formatDateRelative(stock.expiresAt) }}</q-item-label>
            <q-menu class="q-pa-sm">
              {{ formatTimestampToText(stock.expiresAt) }}
            </q-menu>
          </div>
        </div>

        <div class="row items-center">
          <div class="text-subtitle1 q-space">
            {{ $t('StockChanges') }}
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
                  <template v-if="adjustment?.previousQuantity">
                    {{
                      $t(
                        'ChangedToFrom',
                        { quantity: adjustment?.quantity, previousQuantity: adjustment?.previousQuantity },
                        `Changed from ${ adjustment?.previousQuantity } to ${ adjustment?.quantity }`
                      )
                    }}
                  </template>
                  <template v-else>
                    {{
                      $t(
                        'ChangedTo',
                        { quantity: adjustment?.quantity},
                        `Changed to ${ adjustment?.quantity }`
                      )
                    }}
                  </template>
                </template>
                <template v-else-if="adjustment?.adjustType === 'add'">
                  <template v-if="adjustment?.quantity < 0">
                    {{
                      $t(
                        'DeductedQuantity',
                        { quantity: Math.abs(adjustment?.quantity) },
                        `Deducted ${ Math.abs(adjustment?.quantity) }`
                      )
                    }}
                  </template>
                  <template v-else>
                    {{
                      $t(
                        'AddedQuantity',
                        { quantity: Math.abs(adjustment?.quantity) },
                        `Added ${ Math.abs(adjustment?.quantity) }`
                      )
                    }}
                  </template>
                </template>
                {{" "}}
                <template v-if="adjustment?.source === 'sales'">
                  <span
                    :class="adjustment.salesOrderId ? 'text-weight-medium': ''"
                    @click="() => showStockAdjustmentSalesOrder(adjustment)"
                  >
                    {{ $t('FromSales') }}
                  </span>
                </template>
                <template v-else-if="adjustment.source === 'purchase_orders'">
                  <span
                    :class="adjustment.purchaseOrderId ? 'text-weight-medium': ''"
                    @click="() => showStockAdjustmentPurchaseOrder(adjustment)"
                  >
                    {{ $t('FromPurchaseOrder') }}
                  </span>
                </template>
                <template v-else-if="adjustment.source === 'stock_recount'">
                  <span
                  :class="adjustment.stockRecountId ? 'text-weight-medium': ''"
                  @click="() => showStockAdjustmentRecount(adjustment)"
                  >
                    {{ $t('FromStockRecount') }}
                  </span>
                </template>
                <template v-else-if="adjustment.source === 'initial_stock'">
                  {{ $t('FromInitialStock') }}
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
            :label="$t('ViewMore')"
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
    <VariantInfoDialog
      v-model="showVariantDialog"
      :variant="stock?.variant"
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
import VariantInfoDialog from './VariantInfoDialog.vue'

export default defineComponent({
  name: "StockDetailDialog",
  components: {
    SalesOrderDetailDialog,
    PurchaseOrderDetailDialog,
    StockRecountDetailDialog,
    VariantInfoDialog,
  },
  props: {
    stock: Stock,
    displayShop: Boolean,
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

    const showVariantDialog = ref(false)

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

        showVariantDialog,

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
