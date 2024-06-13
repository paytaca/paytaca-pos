<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('PurchaseOrders') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <q-card
        v-if="toReviewPurchaseOrdersCount" class="q-mb-md"
        v-ripple
        @click="() => filterToReviewPurchaseOrders()"
      >
        <q-card-section>
          {{
            $t(
              'PurchaseOrderCount',
              { count: toReviewPurchaseOrdersCount },
              `${ toReviewPurchaseOrdersCount } purchase order(s) assigned to you for review`
            )
          }}
        </q-card-section>
      </q-card>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md no-wrap">
          <q-input
            dense
            v-model="filterOpts.search"
            :placeholder="$t('PoSupplierItemNameCode')"
            debounce="500"
            class="q-space"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn flat padding="sm" icon="tune">
            <q-menu v-model="openFilterOptsForm" class="q-pa-md" @hide="() => syncTempFilterOptsToFilterOpts()">
              <q-btn
                flat
                no-caps
                :label="$t('Reset')"
                color="brandblue"
                padding="xs md"
                class="text-underline q-r-mt-md q-r-mr-lg float-right"
                v-close-popup
                @click="() => filterOpts = createDefaultFilterOpts()"
              />
              <div class="q-mb-sm">
                <div class="text-subtitle1">{{ $t('Statuses') }}</div>
                <div>
                  <q-checkbox
                    v-for="status in statusOpts" :key="status"
                    dense
                    :label="formatPurchaseOrderStatus(status)"
                    :val="status"
                    v-model="tempFilterOpts.statuses"
                    class="q-pa-xs"
                  />
                </div>
              </div>
              <div class="q-mb-sm">
                <div class="text-subtitle1">{{ $t('Reviewed') }}</div>
                <q-btn-toggle
                  v-model="tempFilterOpts.reviewed"
                  no-caps
                  spread
                  toggle-color="primary"
                  padding="none xs"
                  :options="[
                    {label: $t('Yes'), value: true },
                    {label: $t('No'), value: false },
                    {label: $t('All'), value: null}
                  ]"
                />
              </div>
              <div class="q-mb-sm">
                <div class="text-subtitle1">{{ $t('AssignedToMe') }}</div>
                <q-btn-toggle
                  v-model="tempFilterOpts.assignedToMe"
                  no-caps
                  spread
                  toggle-color="primary"
                  padding="none xs"
                  :options="[
                    {label: $t('Yes'), value: true },
                    {label: $t('No'), value: false },
                  ]"
                />
              </div>
            </q-menu>
          </q-btn>
          <q-separator vertical class="q-ml-xs q-mr-sm"/>
          <q-btn
            round icon="add" padding="sm" color="brandblue"
            :to="{ name: 'marketplace-create-purchase-order' }"
          />
        </div>
        <div class="row items-start q-gutter-sm">
          <div
            v-if="filterOpts?.statuses?.length" style="max-width:45vw;"
            class="ellipsis filter-opt q-px-xs"
            @click="openFilterOptsForm = true"
          >
            {{
              $t(
                'StatusValue',
                { value: filterOpts?.statuses?.map?.(formatPurchaseOrderStatus)?.join(', ') },
                `Status: ${filterOpts?.statuses?.map?.(formatPurchaseOrderStatus)?.join(', ')}`
              )
            }}
          </div>
          <div
            v-if="(typeof filterOpts?.reviewed) === 'boolean'"
            class="filter-opt q-px-xs"
            @click="openFilterOptsForm = true"
          >
            <q-icon
              size="1.25em"
              :name="filterOpts?.reviewed ? 'check_circle' : 'cancel'"
              :color="filterOpts?.reviewed ? 'green' : 'red'"
              class="q-mr-xs"
            />
            {{ $t('Reviewed') }}
          </div>
          <q-chip v-if="filterOpts.filterToReview" removable @remove="() => filterOpts.filterToReview = null">
            {{ $t('ToReview') }}
          </q-chip>
        </div>
      </div>
      <q-table
        ref="table"
        :loading="fetchingPurchaseOrders"
        :loading-label="$t('Loading')"
        :columns="purchaseOrdersTableColumns"
        :rows="purchaseOrders"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        binary-state-sort
        :sort-method="sortMethod"
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
              :modelValue="purchaseOrderPagination"
              @update:modelValue="fetchPurchaseOrders"
            />
          </div>
        </template>
        <template v-slot:body-cell-number="props">
          <q-td :props="props">
            <q-btn
              v-if="props.row?.number"
              flat
              padding="none md"
              class="full-width"
              :to="{name: 'marketplace-purchase-order', params: { purchaseOrderId: props.row.id }}"
            >
              {{
                $t(
                  'PoNumber',
                  { number: props.row?.number },
                  `PO#${props.row?.number}`
                )
              }}
            </q-btn>
          </q-td>
        </template>
  
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <div class="row no-wrap items-center">
              {{ formatPurchaseOrderStatus(props?.row?.status) }}
              <q-icon v-if="props?.row?.reviewedAt" name="check_circle" color="green" size="1.25em" class="q-ml-xs">
                <q-menu class="q-px-md q-py-sm">
                  {{
                    $t(
                      'PurchaseOrderReviewed',
                      { date: formatDateRelative(props?.row?.reviewedAt) },
                      `Purchase order reviewed ${ formatDateRelative(props?.row?.reviewedAt) }`
                    )
                  }}
                  <template v-if="props?.row?.reviewedBy?.id">
                    {{
                      $t(
                        'PurchaseOrderReviewedBy',
                        { date: formatDateRelative(props?.row?.reviewedAt), name: props?.row?.reviewedBy?.fullName },
                        `Purchase order reviewed ${ formatDateRelative(props?.row?.reviewedAt) } by ${ props?.row?.reviewedBy?.fullName }`
                      )
                    }}
                    <span v-if="marketplaceStore?.user?.id === props?.row?.reviewedBy?.id">
                      {{
                        $t(
                          'PurchaseOrderReviewedYou',
                          { date: formatDateRelative(props?.row?.reviewedAt), name: props?.row?.reviewedBy?.fullName },
                          `Purchase order reviewed ${ formatDateRelative(props?.row?.reviewedAt) } by ${ props?.row?.reviewedBy?.fullName } (you)`
                        )
                      }}
                    </span>
                  </template>
                </q-menu>
              </q-icon>
            </div>
          </q-td>
        </template>
  
        <template v-slot:body-cell-items="props">
          <q-td
            :props="props"
            class="text-underline"
            @click="() => showPurchaseOrderItems(props.row)"
          >
            {{
              $t(
                'ItemCount',
                { count: props.row?.items?.length || props.row?.itemsCount },
                `${ (props.row?.items?.length || props.row?.itemsCount) } item(s)`
              )
            }}
          </q-td>
        </template>
  
        <template v-slot:body-cell-vendor="props">
          <q-td :props="props" @click="() => displayVendorInfo(props.row?.vendor)">
            <span class="text-underline">
              {{ props?.row?.vendor?.name }}
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
            <q-btn flat icon="more_vert" padding="sm">
              <q-menu anchor="bottom right" self="top right">
                <q-list separator>
                  <q-item
                    clickable
                    :to="{name: 'marketplace-purchase-order', params: { purchaseOrderId: props.row.id }}"
                    v-close-popup
                  >
                    <q-item-section>
                      <q-item-label>{{ $t('View') }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </q-td>
        </template>
      </q-table>    
    </q-pull-to-refresh>
    <VendorInfoDialog v-model="vendorInfoDialog.show" :vendor="vendorInfoDialog.vendor"/>
    <q-dialog v-model="purchaseOrderItemsDialog.show" position="bottom">
      <q-card>
        <q-card-section>
          <div class="row items-center">
            <div class="text-h5">
              {{
                $t(
                  'PoNumberItems',
                  { number: purchaseOrderItemsDialog.purchaseOrder?.number },
                  `PO#${ purchaseOrderItemsDialog.purchaseOrder?.number } Items`
                )
              }}
            </div>
            <q-space/>
            <q-btn
              flat
              padding="sm"
              no-caps
              :label="$t('GoToPage')"
              class="text-underline"
              :to="{
                name: 'marketplace-purchase-order',
                params: { purchaseOrderId: purchaseOrderItemsDialog.purchaseOrder?.id }
              }"
            />
          </div>
        </q-card-section>
        <div v-if="purchaseOrderItemsDialog.purchaseOrder?.$state?.loading" class="row items-center justify-center q-pa-md">
          <q-spinner size="4em"/>
        </div>
        <q-list v-else separator class="q-px-sm q-mb-md">
          <q-item v-for="item in purchaseOrderItemsDialog.purchaseOrder.items" :key="item?.id">
            <q-item-section v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl" side top>
              <img
                :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                style="width:50px;"
                class="rounded-borders"
              />
            </q-item-section>
            <q-item-section top>
              <q-item-label>{{ item?.variant?.itemName || item?.itemName }}</q-item-label>
              <q-item-label>
                {{ item?.quantity }} x
                {{ item?.costPrice }} {{ purchaseOrderItemsDialog.purchaseOrder?.currency?.symbol }}
              </q-item-label>
            </q-item-section>
            <q-item-section avatar top>
              <q-item-label v-if="item?.deliveredAt">
                {{
                  $t(
                    'DeliveredAt',
                    { date: formatDateRelative(item?.deliveredAt) },
                    `Delivered ${ formatDateRelative(item?.deliveredAt) }`
                  )
                }}
                <q-menu class="q-pa-sm">{{ formatTimestampToText(item?.deliveredAt) }}</q-menu>
              </q-item-label>
              <q-item-label v-else class="text-grey">
                {{ $t('NotYetDelivered') }}
              </q-item-label>
              <q-item-label v-if="item?.stockId">
                <q-btn
                  flat padding="2px none"
                  no-caps
                  :label="$t('ViewStocks')"
                  class="text-underline"
                  @click="() => displayItemStock(item)"
                />
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { formatDateRelative, formatPurchaseOrderStatus, formatTimestampToText } from 'src/marketplace/utils'
import { PurchaseOrder, PurchaseOrderItem, Stock, Vendor } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { defineComponent, onMounted, ref, watch } from 'vue'
import VendorInfoDialog from 'src/components/marketplace/inventory/VendorInfoDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'

export default defineComponent({
  name: 'PurchaseOrdersPage',
  components: {
    VendorInfoDialog,
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()

    const openFilterOptsForm  = ref(false)
    const statusOpts = ['pending', 'partial', 'received', 'complete']
    function createDefaultFilterOpts() {
      return {
        sort: undefined,
        search: '',
        statuses: [].map(String),
        reviewed: null,
        filterToReview: null,
        assignedToMe: false,
      }
    }
    const filterOpts = ref(createDefaultFilterOpts())
    watch(filterOpts, () => fetchPurchaseOrders(), { deep: true })
    const tempFilterOpts = ref(createDefaultFilterOpts())
    function syncTempFilterOptsToFilterOpts() {
      filterOpts.value.search = tempFilterOpts.value.search
      filterOpts.value.reviewed = tempFilterOpts.value.reviewed
      filterOpts.value.filterToReview = tempFilterOpts.value.filterToReview
      filterOpts.value.assignedToMe = tempFilterOpts.value.assignedToMe
      
      const tempStatuses = tempFilterOpts.value.statuses
      const statuses = filterOpts.value.statuses
      const hasAddedStatuses = tempStatuses.some(category => !statuses.includes(category))
      const hasRemovedStatuses = statuses.some(category => !tempStatuses.includes(category))
      if (!hasAddedStatuses && !hasRemovedStatuses) return
      filterOpts.value.statuses = [...tempFilterOpts.value.statuses]
    }

    const purchaseOrders = ref([].map(PurchaseOrder.parse))
    const fetchingPurchaseOrders = ref(false)
    const purchaseOrderPagination = ref({ limit: 0, offset: 0, count: 0})

    onMounted(() => fetchPurchaseOrders())
    function fetchPurchaseOrders(opts={ limit: 0, offset: 0 }) {
      const params = {
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
        shop_id: marketplaceStore.activeShopId,
        ordering: filterOpts.value.sort || undefined,
        statuses: filterOpts.value.statuses?.join?.(',') || undefined,
        s: filterOpts.value.search || undefined,
        to_review: Boolean(filterOpts.value.filterToReview) || undefined,
        assigned_to_user: Boolean(filterOpts.value.assignedToMe) || undefined,
        reviewed: typeof filterOpts.value.reviewed === 'boolean' ? filterOpts.value.reviewed : undefined,
      }

      fetchingPurchaseOrders.value = true
      return backend.get('purchase-orders/', { params })
        .then(response => {
          if(!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          purchaseOrders.value = response?.data?.results?.map(PurchaseOrder.parse)
          purchaseOrderPagination.value.limit = response?.data?.limit
          purchaseOrderPagination.value.offset = response?.data?.offset
          purchaseOrderPagination.value.count = response?.data?.count
          return response
        })
        .finally(() => {
          fetchingPurchaseOrders.value = false
        })
    }

    onMounted(() => updateToReviewPurchaseOrders())
    const toReviewPurchaseOrdersCount = ref(0)
    function updateToReviewPurchaseOrders() {
      const params = {
        shop_id: marketplaceStore.activeShopId,
        to_review: true,
        limit: 1,
      }
      return backend.get(`purchase-orders/`, { params })
        .then(response => {
          if (!response?.data?.results?.length) return response
          toReviewPurchaseOrdersCount.value = response?.data?.count
          return response
        })
    }
    function filterToReviewPurchaseOrders() {
      filterOpts.value.filterToReview = true
      filterOpts.value.reviewed = null
      filterOpts.value.statuses = []
    }

    const table = ref()
    const purchaseOrdersTableColumns = [
      { name: 'number', align: 'center', label: t('Number'), field: 'number', format: val => `PO#${val}`, sortable: true },
      { name: 'status', align: 'center', label: t('Status'), field: 'status', format: formatPurchaseOrderStatus, sortable: true },
      { name: 'items', align: 'center', label: t('Items'), field: obj => obj?.items?.length || obj?.itemsCount, format: val => val === 1 ? `${val} item` : `${val} items`, sortable: true },
      { name: 'vendor', align: 'center', label: t('Supplier'), field: obj => obj?.vendor?.name, sortable: true },
      { name: 'updated-at', align: 'center', label: t('Updated'), field: 'updatedAt', sortable: true },
      // { name: 'actions', align: 'center', label: '' },
    ]
    const sortFieldNameMap = {
      items: 'items_count',
      vendor: 'vendor__name',
      'updated-at': 'updated_at',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

    const vendorInfoDialog = ref({ vendor: Vendor.parse(), show: false })
    function displayVendorInfo(vendor=Vendor.parse()) {
      vendorInfoDialog.value.vendor = vendor
      vendorInfoDialog.value.show = true
    }

    const purchaseOrderItemsDialog = ref({ show: false, purchaseOrder: PurchaseOrder.parse() })
    async function showPurchaseOrderItems(purchaseOrder=PurchaseOrder.parse()) {
      if (!Array.isArray(purchaseOrder?.items) ||! purchaseOrder?.items?.length) {
        purchaseOrder.fetchItems()
      }

      purchaseOrderItemsDialog.value.purchaseOrder = purchaseOrder
      purchaseOrderItemsDialog.value.show = true
    }


    function displayItemStock(item=PurchaseOrderItem.parse()) {
      if (!item.stockId) return

      if (!item.stock) {
        item.stock = Stock.parse({ id: item.stockId })
        // item.stock.$state.updating = true
        item.stock.refetch()
      }

      $q.dialog({
        component: StockDetailDialog,
        componentProps: { stock: item.stock },
      })
    }

    async function refreshPage(done) {
      try {
        await Promise.all([
          fetchPurchaseOrders(),
          updateToReviewPurchaseOrders(),
        ])
      } finally {
        done()
      }
    }

    return {
      marketplaceStore,

      openFilterOptsForm,
      statusOpts,
      createDefaultFilterOpts,
      filterOpts,
      tempFilterOpts,
      syncTempFilterOptsToFilterOpts,

      purchaseOrders,
      fetchingPurchaseOrders,
      purchaseOrderPagination,
      fetchPurchaseOrders,

      toReviewPurchaseOrdersCount,
      updateToReviewPurchaseOrders,
      filterToReviewPurchaseOrders,

      table,
      purchaseOrdersTableColumns,
      sortMethod,

      vendorInfoDialog,
      displayVendorInfo,

      purchaseOrderItemsDialog,
      showPurchaseOrderItems,
      displayItemStock,

      refreshPage,

      // utils funcs
      formatPurchaseOrderStatus,
      formatDateRelative, formatTimestampToText,
    }
  }
})
</script>
<style lang="scss" scoped>
.filter-opt {
  border: 1px solid currentColor;
  border-radius: 4px;
}
</style>
