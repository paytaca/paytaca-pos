<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Stocks') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md no-wrap">
          <q-input
            dense
            v-model="filterOpts.search"
            :placeholder="$t('PoItemName')"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn flat padding="sm" icon="tune">
            <q-menu
              v-model="openFilterOptsForm"
              class="q-pa-md"
              @hide="() => syncTempFilterOptsToFilterOpts()"
            >
              <q-btn
                flat
                no-caps
                :label="$t('Reset')"
                color="brandblue"
                padding="xs md"
                class="text-underline q-r-mt-md q-r-mr-lg float-right"
                v-close-popup
                @click="filterOpts = createDefaultFilterOpts(), tempFilterOpts = createDefaultFilterOpts()"
              />
              <div
                v-if="!tempFilterOpts.productId && !tempFilterOpts.variantId"
                class="q-mb-sm"
              >
                <div class="text-subtitle1">{{ $t('Categories') }}</div>
                <div style="min-width:min(50vw, 300px);">
                  <q-select
                    outlined
                    dense
                    multiple
                    use-input
                    use-chips
                    :options="categoriesFilter?.opts"
                    v-model="tempFilterOpts.categories"
                    class="q-r-mx-xs"
                  />
                </div>
              </div>
              <div class="q-mb-sm">
                <div class="text-subtitle1">{{ $t('Expired') }}</div>
                <q-btn-toggle
                  v-model="tempFilterOpts.expired"
                  no-caps
                  no-wrap
                  toggle-color="primary"
                  padding="xs md"
                  :options="[
                    {label: $t('Yes'), value: true },
                    {label: $t('No'), value: false },
                    {label: $t('All'), value: undefined}
                  ]"
                />
              </div>
            </q-menu>
          </q-btn>
          <q-separator vertical class="q-ml-xs q-mr-sm"/>
          <q-btn round icon="add" padding="sm" color="brandblue">
            <q-menu>
              <q-list separator>
                <q-item clickable :to="{ name: 'marketplace-create-purchase-order' }">
                  <q-item-section>
                    <q-item-label>{{ $t('CreatePurchaseOrder') }}</q-item-label>
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
          <div
            v-if="filterOpts?.categories?.length > 0"
            class="ellipsis filter-opt q-px-xs"
            style="max-width:max(500px,75vw);"
            @click="openFilterOptsForm = true"
          >
            {{ filterOpts?.categories?.length === 1 ? $t('Category') : $t('Categories') }}
            :
            {{ filterOpts?.categories?.join(', ') }}
          </div>
          <div
            v-if="(typeof filterOpts?.expired) === 'boolean'"
            class="filter-opt q-px-xs"
            @click="openFilterOptsForm = true"
          >
            <q-icon
              size="1.25em"
              :name="filterOpts?.expired ? 'check_circle' : 'cancel'"
              :color="filterOpts?.expired ? 'green' : 'red'"
              class="q-mr-xs"
            />
            {{ $t('Expired') }}
          </div>
          <template v-if="filterOptsMetadata.product?.id">
            <div
              v-if="filterOptsMetadata?.variant?.id"
              class="filter-opt q-px-xs"
              @click="() => showVariantInfoDialog = true"
            >
              {{ $t('Variant') }}:
              <template v-if="filterOptsMetadata?.product?.name">
                {{ filterOptsMetadata?.product?.name }}
                <template v-if="filterOptsMetadata?.variant?.name">
                  - {{ filterOptsMetadata?.variant?.name }}
                </template>
              </template>
              <template v-else>
                #{{ filterOptsMetadata?.variant?.id }}
              </template>
            </div>
            <div v-else class="filter-opt q-px-xs" @click="() => showProductInfoDialog = true">
              {{ $t('Product') }}: {{  filterOptsMetadata.product?.name || `#${filterOptsMetadata.product?.id}` }}
            </div>
          </template>
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
            {{
              $t(
                'NumberOfStocks',
                {
                  count: selectedStocks?.length,
                  unit: selectedStocks?.length === 1 ? $t('stock') : $t('stocks')
                },
                `${selectedStocks?.length} ${ selectedStocks?.length === 1 ? $t('stock') : $t('stocks') }`
              )
            }}
          </q-btn>
          <q-btn
            rounded
            :outline="$q.dark.isActive"
            padding="2px 0.75em"
            no-caps
            :label="$t('Recount')"
            icon="edit"
            :to="{
              name: 'marketplace-add-stock-recount',
              query: {
                stockIds: selectedStocks.map(stock => stock?.id).filter(Boolean).join(',')
              }
            }"
          />
          <q-btn
            rounded
            :outline="$q.dark.isActive"
            padding="2px 0.75em"
            no-caps
            :label="$t('Update')"
            icon="edit"
            :to="{
              name: 'marketplace-stocks-update',
              query: {
                stockIds: selectedStocks.map(stock => stock?.id).filter(Boolean).join(',')
              }
            }"
          />
        </div>
      </q-slide-transition>
      <q-table
        ref="table"
        :loading="fetchingStocks"
        :loading-label="$t('Loading')"
        :columns="stocksTableColumns"
        :rows="stocks"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        binary-state-sort
        :sort-method="sortMethod"
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
              {{ props.row?.metadata?.product_name ? `(${$t('Deleted')})` : $t('Deleted') }}
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
                {{ $t('SetPrice') }}
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
                {{ $t('SetExpiry') }}
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
                    <q-btn v-close-popup no-caps :label="$t('Close')" flat/>
                    <q-btn v-close-popup no-caps :label="$t('Set')" color="brandblue" @click="() => scope.set()"/>
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
                <div class="text-grey q-mr-xs">{{ $t('Created') }}:</div>
                <div style="white-space:nowrap;">{{ formatTimestampToText(props.row.createdAt) }}</div>
              </div>
              <div class="q-mb-sm">
                <div class="text-grey q-mr-xs">{{ $t('Updated') }}:</div>
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
import { useI18n } from 'vue-i18n'
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
    const { t } = useI18n()
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
        title: t('FilterCategories'),
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

    const openFilterOptsForm = ref(false)
    function createDefaultFilterOpts() {
      return {
        sort: null,
        search: '',
        expired: null,
        productId: Number(props.productId) || null,
        variantId: Number(props.variantId) || null,
        categories: [],
      }
    }
    const filterOpts = ref(createDefaultFilterOpts())
    const tempFilterOpts = ref(createDefaultFilterOpts())
    function syncTempFilterOptsToFilterOpts() {
      filterOpts.value.search = tempFilterOpts.value.search
      filterOpts.value.expired = tempFilterOpts.value.expired
      filterOpts.value.productId = tempFilterOpts.value.productId
      filterOpts.value.variantId = tempFilterOpts.value.variantId

      const tempCategories = tempFilterOpts.value.categories
      const categories = filterOpts.value.categories
      const hasAddedCategories = tempCategories.some(category => !categories.includes(category))
      const hasRemovedCategories = categories.some(category => !tempCategories.includes(category))
      if (!hasAddedCategories && !hasRemovedCategories) return
      filterOpts.value.categories = [...tempFilterOpts.value.categories]
    }

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
        ordering: filterOpts.value.sort || undefined,
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

    const table = ref()
    const stocksTableColumns = [
      { name: 'product', align: 'left', label: t('Product'), field: obj => [obj?.variant?.product?.name, obj?.variant?.name].filter(Boolean).join('- '), sortable: true },
      // { name: 'variant', align: 'center', label: t('Variant'), field: obj => obj?.variant?.name },
      { name: 'purchase-order', align: 'center', label: t('PurchaseOrder'), field: 'purchaseOrderNumber', sortable: true },
      { name: 'quantity', align: 'center', label: t('Qty'), field: 'quantity', sortable: true },
      { name: 'cost-price', align: 'center', label: t('CostPrice'), field: obj => obj.costPrice && `${obj.costPrice} ${marketplaceStore?.currency}`, sortable: true },
      { name: 'expires-at', align: 'center', label: t('Expires'), field: obj => obj.expiresAt, format: val => val ? formatDateRelative(val) : '', sortable: true },
      // { name: 'created-at', align: 'center', label: t('Created') },
      { name: 'updated-at', align: 'center', label: t('Updated'), sortable: true },
      { name: 'actions', align: 'center', label: '', sortable: true },
    ]
    const sortFieldNameMap = {
      product: 'item_name',
      'purchase-order': 'purchase_order_number',
      'cost-price': 'cost_price',
      'expires-at': 'expires_at',
      'updated-at': 'updated_at',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

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
        title: t('RemoveStock'),
        message: t(
          'RemoveStockItemMsg',
          { item: itemName },
          `Remove stock for "${itemName}". Are you sure?`
        ),
        color: 'brandblue',
        ok: { label: t('Delete'), flat: true, color: 'red' },
        cancel: { label: t('Cancel'), flat: true, color: 'grey' },
      })
        .onOk(() => {
          const dialog = $q.dialog({ title: t('RemovingStock'), color: 'brandblue', progress: true, ok: false })
          backend.delete(`stocks/${stock.id}/`)
            .then(() => {
              dialog.hide()
              fetchStocks()
            })
            .catch(error => {
              let errorMsg = error?.response?.data?.detail
              if (error?.response?.status === 403 && !errorMsg) {
                errorMsg = t('RemoveStockErr1')
              }
              dialog.update({
                title: t('Error'),
                message: errorMsg || t('RemoveStockErr2'),
              })
            })
            .finally(() => {
              dialog.update({ progress: false, ok: true })
            })
        })
    }

    // unused
    function confirmDeleteStocks(stocks=[].map(Stock.parse)) {
      $q.dialog({
        title: t('RemoveStocks'),
        message: t(
          'RemoveStocksMsg',
          {
            count: stocks.length,
            unit: stocks?.length === 1 ? t('stock'): t('stocks')
          },
          `Removing ${stocks?.length} ${stocks?.length === 1 ? t('stock'): t('stocks')}. Are you sure?`
        ),
        color: 'brandblue',
        ok: { label: t('Delete'), flat: true, color: 'red' },
        cancel: { label: t('Cancel'), flat: true, color: 'grey' },
      })
        .onOk(() => {
          const data = {
            ids: stocks.map(stock => stock?.id),
          }
          const dialog = $q.dialog({ title: t('RemovingStocks'), ok: false, progress: true })
          backend.post('stocks/batch_delete/', data)
            .then(() => {
              dialog.update({ title: t('StocksRemoved') })
              fetchStocks()
            })
            .catch(() => {
              dialog.update({ title: t('FailedToRemoveStocks'),  message: t('ErrorEncountered') })
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
      openFilterOptsForm,
      createDefaultFilterOpts,
      filterOpts,
      tempFilterOpts,
      syncTempFilterOptsToFilterOpts,
      filterOptsMetadata,
      showProductInfoDialog,
      showVariantInfoDialog,
      stocks,
      fetchingStocks,
      stocksPagination,
      selectedStocks,
      displaySelectedStocks,
      fetchStocks,
      
      table,
      stocksTableColumns,
      sortMethod,
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

.filter-opt {
  border: 1px solid currentColor;
  border-radius: 4px;
}
</style>
