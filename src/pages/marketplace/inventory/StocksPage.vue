<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Stocks</div>
            <div class="text-grey">Marketplace</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md">
          <q-input
            dense
            v-model="filterOpts.search"
            placeholder="PO#, Item name"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn round icon="add" padding="sm" color="brandblue">
            <q-menu>
              <q-list separator>
                <q-item clickable :to="{ name: 'marketplace-create-purchase-order' }">
                  <q-item-section>
                    <q-item-label>Create Purchase Order</q-item-label>
                  </q-item-section>
                </q-item>
                <!-- <q-item clickable v-close-popup @click="() => openCreateStockDialog()">
                  <q-item-section>
                    <q-item-label>Add Stock</q-item-label>
                  </q-item-section>
                </q-item> -->
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="row items-center q-gutter-x-md q-gutter-y-sm">
          <div class="q-space">
            <q-checkbox
              v-model="filterOpts.expired"
              toggle-indeterminate
              label="Expired"
            />
          </div>
          <template v-if="filterOptsMetadata.product?.id">
            <q-chip v-if="filterOptsMetadata?.variant?.id" clickable @click="() => showVariantInfoDialog = true">
              Variant:
              <template v-if="filterOptsMetadata?.product?.name">
                {{ filterOptsMetadata?.product?.name }}
                <template v-if="filterOptsMetadata?.variant?.name">
                  - {{ filterOptsMetadata?.variant?.name }}
                </template>
              </template>
              <template v-else>
                #{{ filterOptsMetadata?.variant?.id }}
              </template>
            </q-chip>
            <q-chip v-else clickable @click="() => showProductInfoDialog = true">
              Product: {{  filterOptsMetadata.product?.name || `#${filterOptsMetadata.product?.id}` }}
            </q-chip>
          </template>
          <div v-else class="row items-center">
            <q-chip
              v-for="category in filterOpts.categories" :key="category"
              removable
              @remove="() => filterOpts.categories = filterOpts.categories.filter(_category => _category != category)"
            >
              {{ category }}
            </q-chip>
            <q-btn
              flat
              :rounded="filterOpts.categories.length > 0"
              padding="xs"
              no-caps
              :label="!filterOpts.categories.length ? 'Filter categories': ''"
              :icon="filterOpts.categories.length ? 'add' : undefined"
              @click="categoriesPrompt"
            />
          </div>
          <ProductInventoryDialog
            v-model="showProductInfoDialog"
            :productObj="filterOptsMetadata.product"
          />
          <VariantInfoDialog
            v-model="showVariantInfoDialog"
            :variant="filterOptsMetadata.variant"
          />
        </div>
      </div>
  
      <q-slide-transition>
        <div v-if="selectedStocks?.length" class="q-mb-sm row items-center q-gutter-sm">
          <StocksListViewDialog v-model="displaySelectedStocks" :stocks="selectedStocks"/>
          <q-btn
            no-caps rounded
            padding="2px 0.75em"
            @click="() => displaySelectedStocks = true"
          >
            {{ selectedStocks?.length }}
            {{ selectedStocks?.length === 1 ? 'stock' : 'stocks' }}
          </q-btn>
          <q-btn
            rounded
            :outline="$q.dark.isActive"
            padding="2px 0.75em"
            no-caps
            label="Recount"
            icon="edit"
            :to="{ name: 'marketplace-add-stock-recount', query: { stockIds: selectedStocks.map(stock => stock?.id).filter(Boolean).join(',') }}"
          />
          <q-btn
            rounded
            :outline="$q.dark.isActive"
            padding="2px 0.75em"
            no-caps
            label="Update"
            icon="edit"
            :to="{ name: 'marketplace-stocks-update', query: { stockIds: selectedStocks.map(stock => stock?.id).filter(Boolean).join(',') }}"
          />
          <q-btn
            rounded
            :outline="$q.dark.isActive"
            color="red"
            padding="2px 0.75em"
            no-caps
            label="Delete"
            icon="delete"
            @click="() => confirmDeleteStocks(selectedStocks)"
          />
        </div>
      </q-slide-transition>
      <q-table
        :loading="fetchingStocks"
        loading-label="Loading..."
        :columns="stocksTableColumns"
        :rows="stocks"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        selection="multiple"
        v-model:selected="selectedStocks"
      >
        <template v-slot:bottom>
          <div class="row items-center full-width">
            <q-space/>
            <LimitOffsetPagination
              :pagination-props="{
                maxPages: 5,
                rounded: true,
                padding: 'sm md',
                flat: true,
                boundaryNumbers: true
              }"
              :hide-below-pages="2"
              :modelValue="stocksPagination"
              @update:modelValue="fetchStocks"
            />
          </div>
        </template>
        <template v-slot:body-cell-product="props">
          <q-td :props="props" @click="() => displayStockDetail(props.row)">
            <div v-if="props.row?.variant?.id" class="row items-center no-wrap">
              <img
                v-if="props.row.imageUrl"
                :src="props.row.imageUrl"
                class="rounded-borders q-mr-sm"
                style="width:50px;"
              />
              <div class="text-left">
                <div class="text-weight-medium">
                  {{ props.row?.variant?.itemName }}
                </div>
                <div v-if="props.row?.variant?.code" class="text-caption bottom">
                  {{ props.row?.variant?.code }}
                </div>
              </div>
            </div>
            <div v-else class="text-grey">
              {{ props.row?.metadata?.product_name }}
              {{ props.row?.metadata?.product_name ? '(Deleted)' : 'Deleted'}}
            </div>
          </q-td>
        </template>
        <template v-slot:body-cell-purchase-order="props">
          <q-td :props="props" @click="() => displayStockPurchaseOrder(props.row)">
            <span :class="{ 'text-weight-medium': props.row?.purchaseOrderId }">
              {{ props.row.purchaseOrderNumber }}
            </span>
          </q-td>
        </template>
        <template v-slot:body-cell-quantity="props">
          <q-td :props="props">
            <span class="text-underline">
              {{ props.row.quantity }}
              <q-spinner v-if="props.row.$state.updatingFields?.has('quantity')" class="q-ml-xs"/>
              <StockQtyPopupEdit :stock="props.row" @updated="updateStockData"/>
            </span>
          </q-td>
        </template>
        <template v-slot:body-cell-cost-price="props">
          <q-td :props="props">
            <span>
              <span v-if="props.row.costPrice" class="text-underline">
                {{ props.row.costPrice }} {{ marketplaceStore?.currency }}
              </span>
              <span v-else class="text-grey text-underline">
                Set price
              </span>
              <q-spinner v-if="props.row.$state.updatingFields?.has('cost_price')" class="q-ml-xs"/>
              <q-popup-edit
                :model-value="props.row.costPrice"
                :cover="false"
                self="top middle"
                @update:model-value="val => updateStock(props.row, 'cost_price', val)"
                v-slot="scope"
              >
                <q-input
                  borderless
                  :suffix="marketplaceStore?.currency"
                  type="number"
                  v-model.number="scope.value"
                  dense
                  autofocus
                  @keyup.enter="scope.set"
                />
              </q-popup-edit>
            </span>
          </q-td>
        </template>
        <template v-slot:body-cell-expires-at="props">
          <q-td :props="props">
            <span>
              <span v-if="props.row.expiresAt" class="text-underline">
                {{ formatDateRelative(props.row.expiresAt) }}
              </span>
              <span v-else class="text-grey text-underline">
                Set expiry
              </span>
              <q-spinner v-if="props.row.$state.updatingFields?.has('expires_at')" class="q-ml-xs"/>
              <q-popup-edit
                :model-value="props.row.expiresAt?.toISOString()"
                :cover="false"
                self="top middle"
                @update:model-value="val => updateStock(props.row, 'expires_at', val ? new Date(val).toISOString() : null)"
                v-slot="scope"
                class="q-pa-none"
              >
                <q-date v-model="scope.value" flat mask="YYYY-MM-DD">
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup no-caps label="Close" flat/>
                    <q-btn v-close-popup no-caps label="Set" color="brandblue" @click="() => scope.set()"/>
                  </div>
                </q-date>
              </q-popup-edit>
            </span>
          </q-td>
        </template>
        <template v-slot:body-cell-updated-at="props">
          <q-td :props="props">
            {{ formatDateRelative(props.row.updatedAt) }}
            <q-menu class="q-py-sm q-px-md">
              <div class="q-mb-sm">
                <div class="text-grey q-mr-xs">Created:</div>
                <div style="white-space:nowrap;">{{ formatTimestampToText(props.row.createdAt) }}</div>
              </div>
              <div class="q-mb-sm">
                <div class="text-grey q-mr-xs">Updated:</div>
                <div style="white-space:nowrap;">{{ formatTimestampToText(props.row.updatedAt) }}</div>
              </div>
            </q-menu>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              flat
              padding="none"
              icon="delete"
              @click="() => confirmRemoveStock(props.row)"
            />
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from "src/marketplace/backend";
import { Product, PurchaseOrder, Stock, Variant } from "src/marketplace/objects";
import { formatDateRelative, formatTimestampToText } from "src/marketplace/utils";
import { useMarketplaceStore } from "src/stores/marketplace";
import { useQuasar } from "quasar";
import { defineComponent, onMounted, ref, watch } from "vue";
import StocksListViewDialog from "src/components/marketplace/inventory/StocksListViewDialog.vue";
import CreateStockFormDialog from "src/components/marketplace/inventory/CreateStockFormDialog.vue";
import StockQtyPopupEdit from "src/components/marketplace/inventory/StockQtyPopupEdit.vue";
import StockDetailDialog from "src/components/marketplace/inventory/StockDetailDialog.vue";
import ProductInventoryDialog from "src/components/marketplace/inventory/ProductInventoryDialog.vue";
import VariantInfoDialog from "src/components/marketplace/inventory/VariantInfoDialog.vue";
import PurchaseOrderDetailDialog from "src/components/marketplace/inventory/PurchaseOrderDetailDialog.vue";
import MarketplaceHeader from "src/components/marketplace/MarketplaceHeader.vue";
import LimitOffsetPagination from "src/components/LimitOffsetPagination.vue";


export default defineComponent({
  name: "StocksPage",
  components: {
    StocksListViewDialog,
    StockQtyPopupEdit,
    MarketplaceHeader,
    ProductInventoryDialog,
    VariantInfoDialog,
    LimitOffsetPagination,
  },
  props: {
    productId: [Number, String],
    variantId: [Number, String],
  },
  setup(props) {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    const categoriesFilter = ref({
      showFormDialog: false,
      opts: [],
    })
    onMounted(() => updateProductCategories())
    function updateProductCategories() {
      const params = {
        shop_id: marketplaceStore.activeShopId,
      }
      return backend.get(`product-categories/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          categoriesFilter.value.opts = response?.data?.results.map(category => category?.name).filter(Boolean)
          return response
        })
    }
    function categoriesPrompt() {
      $q.dialog({
        title: 'Filter categories',
        position: 'bottom',
        options: {
          type: 'checkbox',
          model: filterOpts.value.categories,
          items: categoriesFilter.value.opts.map(category => Object({
            label: category,
            value: category,
            color: 'brandblue',
          })),
        },
        ok: { color: 'brandblue' },
        cancel: { flat: true, color: 'grey' },
      }).onOk(val => {
        filterOpts.value.categories = val
      })
    }

    const filterOpts = ref({
      search: '',
      expired: null,
      productId: Number(props.productId) || null,
      variantId: Number(props.variantId) || null,
      categories: [],
    })

    const filterOptsMetadata = ref({
      product: Product.parse({ id: filterOpts.value.productId }),
      variant: Variant.parse({ id: filterOpts.value.variantId }),
    })
    async function updateFilterOptsMetadata() {
      const productId = filterOpts.value.productId
      const variantId = filterOpts.value.variantId

      let product = null
      let variant = null

      product = Product.parse({id: productId})
      await product.refetch()

      if (variantId) {
        variant = product?.variants?.find?.(v => v?.id == variantId) ||
                  Variant.parse({ id: variantId })
      } else {
        variant = null
      }

      filterOptsMetadata.value.product = product
      filterOptsMetadata.value.variant = variant
    }

    const showProductInfoDialog = ref(false)
    const showVariantInfoDialog = ref(false)

    watch(filterOpts, () => fetchStocks(), { deep: true })
    watch(
      () => [filterOpts.value?.productId, filterOpts.value?.variantId],
      () => updateFilterOptsMetadata(),
    )

    onMounted(() => {
      fetchStocks()
      updateFilterOptsMetadata()
    })

    const stocks = ref([].map(Stock.parse))
    const fetchingStocks = ref(false)
    const stocksPagination = ref({count: 0, limit: 0, offset: 0 })
    const selectedStocks = ref([].map(Stock.parse))
    const displaySelectedStocks = ref(false)
    function fetchStocks(opts={ limit: 0, offset: 0}) {
      const params = {
        shop_id: marketplaceStore.activeShopId,
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
        s: filterOpts.value.search || undefined,
        categories: filterOpts.value.categories.join('|') || undefined,
      }
      if (typeof filterOpts.value.expired === 'boolean') {
        params[filterOpts.value.expired ? 'expired_after' : 'not_expired_after'] = new Date()
      }

      if (filterOpts.value.productId) {
        params.product_id = filterOpts.value.productId
        if (filterOpts.value.variantId) {
          params.variant_id = filterOpts.value.variantId
        }
      }

      fetchingStocks.value = true
      return backend.get("/stocks/", { params }).then((response) => {
        if (!Array.isArray(response.data?.results)) return Promise.reject({ response })
        stocks.value = response.data?.results.map(Stock.parse)
        stocksPagination.value.limit = response?.data?.limit
        stocksPagination.value.offset = response?.data?.offset
        stocksPagination.value.count = response?.data?.count
        return response
      }).finally(() => {
        fetchingStocks.value = false
      }).then(() => {
        selectedStocks.value = selectedStocks.value.filter(stock => {
          return stocks.value.some(_stock => _stock.id === stock.id)
        })
      })
    }

    const stocksTableColumns = [
      { name: 'product', align: 'left', label: 'Product', field: obj => [obj?.variant?.product?.name, obj?.variant?.name].filter(Boolean).join('- ') },
      // { name: 'variant', align: 'center', label: 'Variant', field: obj => obj?.variant?.name },
      { name: 'purchase-order', align: 'center', label: 'Purchase Order', field: 'purchaseOrderNumber' },
      { name: 'quantity', align: 'center', label: 'Qty', field: 'quantity' },
      { name: 'cost-price', align: 'center', label: 'Cost Price', field: obj => obj.costPrice && `${obj.costPrice} ${marketplaceStore?.currency}` },
      { name: 'expires-at', align: 'center', label: 'Expires', field: obj => obj.expiresAt, format: val => val ? formatDateRelative(val) : '' },
      // { name: 'created-at', align: 'center', label: 'Created' },
      { name: 'updated-at', align: 'center', label: 'Updated' },
      { name: 'actions', align: 'center', label: '' },
    ]

    function displayStockDetail(stock=Stock.parse()) {
      $q.dialog({
        component: StockDetailDialog,
        componentProps: { stock: stock },
      })
    }

    function displayStockPurchaseOrder(stock=Stock.parse()) {
      if (!stock.purchaseOrderId) return

      if (!stock.purchaseOrder) {
        stock.purchaseOrder = PurchaseOrder.parse({ id: stock.purchaseOrderId })
        stock.purchaseOrder.refetch()
      }

      $q.dialog({
        component: PurchaseOrderDetailDialog,
        componentProps: {
          purchaseOrder: stock.purchaseOrder,
        }
      })
    }

    function openCreateStockDialog() {
      const variant = {
        id: filterOptsMetadata.value.variant?.id,
        name: filterOptsMetadata.value.variant?.name,
        product: {
          id: filterOptsMetadata.value.product?.id,
          name: filterOptsMetadata.value.product?.name,
        }
      }
      $q.dialog({
        component: CreateStockFormDialog,
        componentProps: {
          variant: variant?.id ? variant : undefined,
        },
      }).onOk(() => fetchStocks())
    }

    function updateStock(stock=Stock.parse(), field='', value) {
      stock.$state.updating = true
      stock.$state.updatingFields.add(field)
      backend.patch(`stocks/${stock.id}/`, { [field]: value })
        .then(response => {
          if (response?.data.id) stock.raw = response.data
        })
        .finally(() => {
          stock.$state.updatingFields.delete(field)
          stock.$state.updating = false
        })
    }

    function updateStockData(stock=Stock.parse()) {
      stocks.value = stocks.value.map(_stock => {
        if (stock.id !== _stock.id) return _stock
        _stock.raw = stock.raw
        return _stock
      })
    }

    function confirmRemoveStock(stock=Stock.parse()) {
      const productName = stock.variant.product.name || stock.metadata?.product_name
      const variantName = stock.variant.name || stock.metadata?.variant_name

      let itemName = productName
      if (variantName) itemName += `- ${variantName}`
      $q.dialog({
        title: 'Remove stock',
        message: `Remove stock for "${itemName}". Are you sure?`,
        ok: true,
        cancel: true,
      })
        .onOk(() => {
          const dialog = $q.dialog({ title: 'Removing stock', progress: true, ok: false })
          backend.delete(`stocks/${stock.id}/`)
            .then(() => {
              dialog.hide()
              fetchStocks()
            })
            .catch(error => {
              let errorMsg = ''
              if (error?.response?.status === 403 && !errorMsg) {
                errorMsg = 'Sorry, you do not have sufficient permissions to access the inventory.'
              }
              dialog.update({
                title: 'Error',
                message: errorMsg || 'Failed to remove stock',
              })
            })
            .finally(() => {
              dialog.update({ progress: false, ok: true })
            })
        })
    }

    function confirmDeleteStocks(stocks=[].map(Stock.parse)) {
      $q.dialog({
        title: 'Remove stocks',
        message: `Removing ${stocks?.length} ${stocks?.length === 1 ? 'stock': 'stocks'}. Are you sure?`,
        ok: true,
        cancel: true,
      })
        .onOk(() => {
          const data = {
            ids: stocks.map(stock => stock?.id),
          }
          const dialog = $q.dialog({ title: 'Removing stocks', ok: false, progress: true })
          backend.post('stocks/batch_delete/', data)
            .then(() => {
              dialog.update({ title: 'Stocks removed' })
              fetchStocks()
            })
            .catch(() => {
              dialog.update({ title: 'Failed to remove stocks',  message: 'Error encountered' })
            })
            .finally(() => {
              dialog.update({ ok: true, progress: false })
            })
        })
    }

    async function refreshPage(done){
      try {
        await Promise.all([
          fetchStocks(),
          updateProductCategories(),
        ])
      } finally {
        done()
      }
    }

    return {
      marketplaceStore,
      categoriesFilter,
      categoriesPrompt,
      filterOpts,
      filterOptsMetadata,
      showProductInfoDialog,
      showVariantInfoDialog,
      stocks,
      fetchingStocks,
      stocksPagination,
      selectedStocks,
      displaySelectedStocks,
      fetchStocks,
      
      stocksTableColumns,
      displayStockDetail,
      displayStockPurchaseOrder,
      openCreateStockDialog,

      updateStock,
      updateStockData,
      confirmRemoveStock,
      confirmDeleteStocks,

      refreshPage,

      // utils funcs
      formatDateRelative, formatTimestampToText,
    }
  },
});
</script>
<style scoped lang="scss">
.my-sticky-column-table::v-deep th.sticky,
.my-sticky-column-table td.sticky {
  background-color: white;
}
.q-dark.my-sticky-column-table::v-deep th.sticky,
.q-dark.my-sticky-column-table td.sticky {
  background-color: $dark;
}
.my-sticky-column-table::v-deep th.sticky,
.my-sticky-column-table td.sticky {
  overflow:hidden;
  position: sticky;
  left: 0;
  z-index: 1;
}
</style>
