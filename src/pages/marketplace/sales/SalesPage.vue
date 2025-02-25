<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Sales') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
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
          :label="$t('Reports')"
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
            :placeholder="$t('PoItemName')"
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
              {{
                $t(
                  'DateFromTo',
                  { from: formatDate(parsedFilterOpts.dateRange.from), to: formatDate(parsedFilterOpts.dateRange.to) },
                  `${ formatDate(parsedFilterOpts.dateRange.from) } to ${ formatDate(parsedFilterOpts.dateRange.to) }`
                )
              }}
            </template>
            <template v-else-if="parsedFilterOpts.dateRange?.from">
              {{
                $t(
                  'DateFrom',
                  { from: formatDate(parsedFilterOpts.dateRange?.from) },
                  `from ${ formatDate(parsedFilterOpts.dateRange?.from) }`
                )
              }}
            </template>
            <template v-else-if="parsedFilterOpts.dateRange?.to">
              {{
                $t(
                  'DateTo',
                  { to: formatDate(parsedFilterOpts.dateRange?.to) },
                  `to ${ formatDate(parsedFilterOpts.dateRange?.to) }`
                )
              }}
            </template>
            <span v-else class="text-grey">
              {{ $t('FilterDate') }}
            </span>
            <q-popup-edit
              v-model="filterOpts.dateRange"
              :cover="false"
              self="top middle"
              class="q-pa-none"
              v-slot="scope"
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
                  no-caps
                  :label="$t('Cancel')"
                  @click="scope.cancel"
                />
                <q-btn v-else flat color="grey" no-caps :label="$t('Clear')" @click="() => {scope.value=null;scope.set();}"/>
                <q-btn flat color="brandblue" no-caps :label="$t('Set')" @click="scope.set"/>
              </div>
            </q-popup-edit>
          </q-chip>
          <q-space/>
        </div>
      </div>
      <q-table
        ref="table"
        :loading="fetchingSalesOrders"
        :loading-label="$t('Loading')"
        :columns="salesOrdersTableColumns"
        :rows="salesOrders"
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
              {{
                $t(
                  'SoNumber',
                  { number: props.row?.number },
                  `SO#${ props.row?.number }`
                )
              }}
            </q-btn>
          </q-td>
        </template>
        <template v-slot:body-cell-order="props">
          <q-td :props="props">
            <template v-if="props.row?.orderIds?.length">
              <q-chip
                v-for="orderId in props.row?.orderIds" :key="orderId"
                dense
                clickable
                color="brandblue"
                text-color="white"
                @click="() => displayOrder(orderId)"
              >
                {{ $t('Order') }}#{{orderId}}
              </q-chip>
            </template>
            <div v-else class="text-grey">
              {{ $t('None') }}
            </div>
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>
    <SalesOrderDetailDialog
      v-model="salesOrderDetailDialog.show"
      :salesOrder="salesOrderDetailDialog.salesOrder"
    >
      <template v-slot:menu>
        <q-btn
          flat
          no-caps
          padding="xs none"
          :label="$t('GoToPage')"
          class="text-underline"
          :to="{ name: 'marketplace-sales-order', params: { salesOrderId: salesOrderDetailDialog.salesOrder?.id } }"
        />
      </template>
    </SalesOrderDetailDialog>
    <OrderDetailDialog
      v-model="orderDetailDialog.show"
      :order="orderDetailDialog.order"
    />
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Order, SalesOrder } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { date, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import SalesOrderDetailDialog from 'src/components/marketplace/sales/SalesOrderDetailDialog.vue'
import OrderDetailDialog from 'src/components/marketplace/storefront/OrderDetailDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'

export default defineComponent({
  name: 'SalesPage',
  components: {
    SalesOrderDetailDialog,
    OrderDetailDialog,
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const { t } = useI18n()
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    const filterOpts = ref({
      sort: undefined,
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
    watch(filterOpts, () => fetchSalesOrders(), { deep: true })
    onMounted(() => fetchSalesOrders())
    function fetchSalesOrders(opts={limit: 0, offset: 0}) {
      const params = {
        shop_id: marketplaceStore.activeShopId,
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
        draft: false,
        ordering: filterOpts.value.sort || undefined,
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

    const table = ref()
    const salesOrdersTableColumns = [
      { name: 'number', align: 'center', label: t('Number'), field: 'number', format: val => `SO#${val}`, sortable: true },
      { name: 'status', align: 'center', label: t('Status'), field: 'parsedStatus', sortable: true },
      { name: 'total', align: 'center', label: t('Total'), field: obj => obj?.total ? `${obj?.total} ${obj?.currency?.symbol}` : '', sortable: true },
      { name: 'items', align: 'center', label: t('Items'), field: obj => obj?.items?.length || obj?.itemsCount, format: val => val === 1 ? `${val} item` : `${val} items`, sortable: true },
      { name: 'order', align: 'center', label: t('Orders') },
      { name: 'payment-mode', align: 'center', label: t('PaymentMode'), field: obj => obj?.parsedPaymentMode || obj?.paymentMode, sortable: true },
    ]
    const sortFieldNameMap = {
      items: 'items_count',
      'payment-mode': 'payment_mode',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

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

    const orderDetailDialog = ref({ show: false, order: Order.parse() })
    async function displayOrder(orderId = 0) {
      if (!orderId) return

      const dialog = $q.dialog({
        title: t('FetchingOrder'),
        progress: true,
        color: 'brandblue',
        ok: false,
        cancel: false,
        persistent: true,
      })
      await backend.get(`connecta/orders/${orderId}/`)
        .then(response => {
          orderDetailDialog.value.order = Order.parse(response?.data)
          orderDetailDialog.value.show = true
        })
        .finally(() => dialog.hide())
        dialog.hide()
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

      table,
      salesOrdersTableColumns,
      sortMethod,

      salesOrderDetailDialog,
      showSalesOrderDetail,

      orderDetailDialog,
      displayOrder,

      refreshPage,

      // utils funcs
      formatDateRelative,
      formatTimestampToText,
      formatDate,
    }
  },
})
</script>
