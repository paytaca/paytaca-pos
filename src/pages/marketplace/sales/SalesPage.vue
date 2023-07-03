<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Sales</div>
            <div class="text-grey">Marketplace</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="row items-center q-mb-sm q-px-sm">
        <q-btn
          :outline="!$q.dark.isActive"
          :color="$q.dark.isActive ? 'dark' : undefined"
          rounded
          padding="xs sm"
          no-caps
          label="Reports"
          icon="query_stats"
          :to="{ name: 'marketplace-sales-reports'}"
        />
        <q-space/>
      </div>
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
          <q-btn
            round icon="add"
            padding="sm" color="brandblue"
            :to="{ name: 'marketplace-sale' }"
          />
        </div>
        <div class="row items-center">
          <q-chip clickable class="q-ma-none">
            <q-icon name="date_range" class="q-mr-xs"/>
            <template v-if="parsedFilterOpts.dateRange.exact">
              {{ formatDate(parsedFilterOpts.dateRange.exact) }}
            </template>
            <template v-else-if="parsedFilterOpts.dateRange.from && parsedFilterOpts.dateRange.to">
              {{ formatDate(parsedFilterOpts.dateRange.from) }} to {{ formatDate(parsedFilterOpts.dateRange.to) }}
            </template>
            <template v-else-if="parsedFilterOpts.dateRange?.from">
              from {{ formatDate(parsedFilterOpts.dateRange?.from) }}
            </template>
            <template v-else-if="parsedFilterOpts.dateRange?.to">
              to {{ formatDate(parsedFilterOpts.dateRange?.to) }}
            </template>
            <span v-else class="text-grey">
              Filter date
            </span>
            <q-popup-edit
              v-model="filterOpts.dateRange"
              :cover="false"
              self="top middle"
              class="q-pa-none"
              v-slot="scope"
              @update:model-value="() => fetchSalesOrders()"
            >
              <q-date
                flat
                range
                v-model="scope.value"
              />
              <div class="row items-center justify-around q-gutter-x-sm q-mb-sm">
                <q-btn
                  v-if="!Boolean(scope.initialValue)"
                  flat color="grey"
                  no-caps label="Cancel"
                  @click="scope.cancel"
                />
                <q-btn v-else flat color="grey" no-caps label="Clear" @click="() => {scope.value=null;scope.set();}"/>
                <q-btn flat color="brandblue" no-caps label="Set" @click="scope.set"/>
              </div>
            </q-popup-edit>
          </q-chip>
          <q-space/>
        </div>
      </div>
      <q-table
        :loading="fetchingSalesOrders"
        loading-label="Loading..."
        :columns="salesOrdersTableColumns"
        :rows="salesOrders"
        row-key="id"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
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
              :modelValue="salesOrdersPagination"
              @update:modelValue="fetchSalesOrders"
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
              @click="() => showSalesOrderDetail(props.row)"
            >
              SO#{{ props.row?.number }}
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>
    <SalesOrderDetailDialog
      v-model="salesOrderDetailDialog.show"
      :salesOrder="salesOrderDetailDialog.salesOrder"
    />
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { SalesOrder } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { date } from 'quasar'
import { computed, defineComponent, onMounted, ref } from 'vue'
import SalesOrderDetailDialog from 'src/components/marketplace/sales/SalesOrderDetailDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'

export default defineComponent({
  name: 'SalesPage',
  components: {
    SalesOrderDetailDialog,
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const marketplaceStore = useMarketplaceStore()

    const filterOpts = ref({
      search: '',
      dateRange: {
        from: null,
        to: null,
      }
    })
    const parsedFilterOpts = computed(() => {
      const data = {
        dateRange: { from: null, to: null, exact: null },
      }
      const exactDate = new Date(filterOpts.value.dateRange || undefined)

      // set to start of day
      const dateFrom = new Date(filterOpts.value.dateRange?.from || undefined)
      dateFrom.setHours(0, 0, 0, 0)

      // set to end of day
      const dateTo = new Date(filterOpts.value.dateRange?.to || undefined)
      dateTo.setHours(24, 0, 0, -1)

      if (!isNaN(exactDate)) {
        data.dateRange.exact = new Date(exactDate.toISOString())
        exactDate.setHours(0, 0, 0, 0)
        data.dateRange.from = new Date(exactDate.toISOString())
        exactDate.setHours(24, 0, 0, -1)
        data.dateRange.to = new Date(exactDate.toISOString())
      } else {
        if (!isNaN(dateFrom)) data.dateRange.from = new Date(dateFrom.toISOString())
        if (!isNaN(dateTo)) data.dateRange.to = new Date(dateTo.toISOString())
      }
      
      return data
    })
    
    const salesOrders = ref([].map(SalesOrder.parse))
    const salesOrdersPagination = ref({count: 0, limit: 0, offset: 0 })
    const fetchingSalesOrders = ref(false)
    onMounted(() => fetchSalesOrders())
    function fetchSalesOrders(opts={limit: 0, offset: 0}) {
      const params = {
        shop_id: marketplaceStore.activeShopId,
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
        s: filterOpts.value.search || undefined,
      }

      if (parsedFilterOpts.value?.dateRange?.from) {
        params.created_after = new Date(parsedFilterOpts.value?.dateRange?.from).toISOString()
      }
      if (parsedFilterOpts.value?.dateRange?.to) {
        params.created_before = new Date(parsedFilterOpts.value?.dateRange?.to).toISOString()
      }

      fetchingSalesOrders.value = true
      return backend.get(`sales-orders/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          salesOrders.value = response?.data?.results.map(SalesOrder.parse)
          salesOrdersPagination.value.limit = response?.data?.limit
          salesOrdersPagination.value.offset = response?.data?.offset
          salesOrdersPagination.value.count = response?.data?.count
          return response
        })
        .finally(() => {
          fetchingSalesOrders.value = false
        })
    }

    const salesOrdersTableColumns = [
      { name: 'number', align: 'center', label: 'Number', field: 'number', format: val => `SO#${val}` },
      { name: 'total', align: 'center', label: 'Total', field: obj => obj?.total ? `${obj?.total} ${obj?.currency?.symbol}` : '' },
      { name: 'items', align: 'center', label: 'Items', field: obj => obj?.items?.length || obj?.itemsCount, format: val => val === 1 ? `${val} item` : `${val} items` },
      { name: 'payment-mode', align: 'center', label: 'Payment mode', field: obj => obj?.parsedPaymentMode || obj?.paymentMode },

    ]

    const salesOrderDetailDialog = ref({
      show: false,
      salesOrder: SalesOrder.parse(),
    })
    function showSalesOrderDetail(salesOrder=SalesOrder.parse()) {
      if (!Array.isArray(salesOrder?.items) || !salesOrder?.items?.length) {
        salesOrder.fetchItems()
      }
      salesOrderDetailDialog.value.salesOrder = salesOrder
      salesOrderDetailDialog.value.show = true
    }

    function formatDate(dateObj, format='MMM D, YYYY') {
      return date.formatDate(dateObj, format)
    }

    async function refreshPage(done) {
      try {
        await fetchSalesOrders()
      } finally {
        done()
      }
    }

    return {
      filterOpts,
      parsedFilterOpts,
      salesOrders,
      salesOrdersPagination,
      fetchingSalesOrders,
      fetchSalesOrders,

      salesOrdersTableColumns,

      salesOrderDetailDialog,
      showSalesOrderDetail,

      refreshPage,

      // utils funcs
      formatDateRelative,
      formatTimestampToText,
      formatDate,
    }
  },
})
</script>
