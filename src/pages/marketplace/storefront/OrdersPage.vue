<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Orders') }}</div>
            <div class="text-grey">{{ $t('Storefront') }}</div>
          </div>
        </template>
      </MarketplaceHeader>

      <div class="full-width q-px-sm q-mb-sm">
        <div class="row">
          <q-input
            dense
            :loading="Boolean(filterOpts?.search && fetchingOrders)"
            v-model="filterOpts.search"
            :placeholder="$t('PoItemName')"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn
            flat
            no-caps
            padding="xs"
            icon="tune"
            style="max-width: 50%;"
          >
            <q-menu
              v-model="openFilterOptsForm" class="q-pa-md"  
              @before-show="() => syncFilterOptsToTemp()"
              @hide="() => syncTempToFilterOpts()"
            >
              <q-btn
                flat
                no-caps
                :label="$t('Reset')"
                color="brandblue"
                padding="xs md"
                class="text-underline q-r-mr-lg float-right"
                v-close-popup
                @click="() => tempFilterOpts = createDefaultFilterOpts()"
              />
              <div class="q-mb-sm">
                <div class="text-subtitle1">{{ $t('Statuses') }}</div>
                <div>
                  <q-checkbox
                    v-for="status in statusOpts" :key="status"
                    dense
                    :label="formatOrderStatus(status)"
                    :val="status"
                    v-model="tempFilterOpts.statuses"
                    class="q-pa-xs"
                  />
                </div>
              </div>
              <div class="q-mb-sm">
                <div class="text-subtitle1">{{ $t('HasOngoingDispute') }}</div>
                <q-btn-toggle
                  v-model="tempFilterOpts.hasOngoingDispute"
                  no-caps
                  spread
                  toggle-color="primary"
                  padding="none xs"
                  :options="[
                    {label: $t('Yes'), value: true },
                    {label: $t('No'), value: false },
                    {label: $t('All'), value: undefined}
                  ]"
                />
              </div>
              <q-btn
                no-caps
                :label="$t('ApplyFilter')"
                class="full-width q-mt-sm"
                color="brandblue"
                v-close-popup
              />
            </q-menu>
          </q-btn>
        </div>
      </div>
      <div class="row q-gutter-sm q-mb-md">
        <div
          v-if="filterOpts?.statuses?.length" style="max-width:45vw;"
          class="ellipsis filter-opt q-px-xs"
          @click="openFilterOptsForm = true"
        >
          {{
            $t(
              'StatusValue',
              { value: filterOpts?.statuses?.map?.(formatOrderStatus)?.join(', ') },
              `Status: ${filterOpts?.statuses?.map?.(formatOrderStatus)?.join(', ')}`
            )
          }}
        </div>
        <div
          v-if="(typeof filterOpts?.hasOngoingDispute === 'boolean')"
          class="ellipsis filter-opt q-px-xs"
          @click="openFilterOptsForm = true"
        >
          <template v-if="filterOpts?.hasOngoingDispute">
            {{ $t('HasDispute') }}
          </template>
          <template v-else>
            {{ $t('HasNoDispute') }}
          </template>
        </div>
      </div>
      <q-table
        ref="table"
        :loading="fetchingOrders"
        :columns="ordersTableColumns"
        :rows="orders"
        :pagination="{ rowsPerPage: 0 }"
        row-key="id"
        hide-pagination
        binary-state-sort
        :sort-method="sortMethod"
        @row-click="(evt, row) => $router.push({
          name: 'marketplace-storefront-order',
          params: { orderId: row.id }
        })"
      >
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="props.row?.statusColor">
              {{ props.row.formattedStatus }}
            </q-badge>
            <br/>
            <q-badge v-if="props.row?.hasOngoingDispute" color="red">
              {{ $t('Dispute') }}
            </q-badge>
          </q-td>
        </template>
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
              :modelValue="ordersPagination"
              @update:modelValue="fetchOrders"
            />
          </div>
        </template>
      </q-table>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Order } from 'src/marketplace/objects'
import { formatOrderStatus, parseOrderStatusColor } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { defineComponent, onMounted, watch, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'

export default defineComponent({
  name: 'OrdersPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  props: {
    s: String,
    statuses: String,
    dispute: String,
  },
  setup(props) {
    const { t } = useI18n()
    const $route = useRoute()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    onMounted(() => refreshPage())

    const statusOpts = [
      'pending', 'confirmed', 'preparing',
      'ready_for_pickup', 'on_delivery', 'delivered',
      'completed', 'cancelled',
    ]

    function createDefaultFilterOpts(useProps=false) {
      const data = {
        sort: undefined,
        search: '',
        statuses: [],
        hasOngoingDispute: [].map(Boolean)[0],
      }
      if (useProps) {
        data.statuses = props.statuses?.split?.(',')?.filter(status => statusOpts.includes(status)) || []
        data.search = props.search || ''
        console.log('props.dispute', props.dispute)
        if (props.dispute == 'true') data.hasOngoingDispute = true
        if (props.dispute == 'false') data.hasOngoingDispute = false
      }
      return data
    }
    const tempFilterOpts = ref(createDefaultFilterOpts())
    function syncTempToFilterOpts() {
      const hasAddedStatuses = tempFilterOpts.value.statuses
        .some(status => !filterOpts.value.statuses.includes(status))
      const hasRemovedStatuses = filterOpts.value.statuses
        .some(status => !tempFilterOpts.value.statuses.includes(status))

      if (hasAddedStatuses || hasRemovedStatuses) {
        filterOpts.value.statuses = [].concat(tempFilterOpts.value.statuses)
      }

      filterOpts.value.hasOngoingDispute = tempFilterOpts.value.hasOngoingDispute
    }
    function syncFilterOptsToTemp() {
      tempFilterOpts.value = {
        sort: filterOpts.value.sort,
        search: filterOpts.value.search,
        statuses: filterOpts.value.statuses.map(e => e),
        hasOngoingDispute: filterOpts.value.hasOngoingDispute,
      }
    }

    const openFilterOptsForm = ref(false) 
    const filterOpts = ref(createDefaultFilterOpts(true))
    watch(filterOpts, () => fetchOrders(), { deep: true })
    watch(filterOpts, () => {
      $router.replace({
        query: Object.assign({}, $route.query, {
          s: filterOpts.value.search || undefined,
          statuses: filterOpts.value?.statuses?.join(',') || undefined,
          dispute: typeof filterOpts.value?.hasOngoingDispute === 'boolean'
            ? String(filterOpts.value?.hasOngoingDispute) : undefined,
        }),
      })
    }, { deep: true })

    const fetchingOrders = ref(false)
    const orders = ref([].map(Order.parse))
    const ordersPagination = ref({ count: 0, limit: 0, offset: 0 })
    function fetchOrders(opts={ limit: 0, offset: 0 }) {
      const params = {
        storefront_id: marketplaceStore.storefrontData?.id || null,
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
        ordering: filterOpts.value?.sort || undefined,
        statuses: filterOpts.value?.statuses?.join(',') || undefined,
        s: filterOpts.value.search || undefined,
      }
      if (typeof filterOpts.value.hasOngoingDispute == 'boolean') {
        params.has_ongoing_dispute = filterOpts.value.hasOngoingDispute
      }

      fetchingOrders.value = true
      return backend.get(`connecta/orders`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          orders.value = response?.data?.results.map(Order.parse)
          ordersPagination.value.count = response?.data?.count
          ordersPagination.value.limit = response?.data?.limit
          ordersPagination.value.offset = response?.data?.offset

          return response
        })
        .finally(() => {
          fetchingOrders.value = false
        })
    }

    const table = ref()
    const ordersTableColumns = [
      { name: 'id', align: 'left', label: t('Order'), field: 'id', format: val => val ? `#${val}` : '', sortable: true },
      { name: 'status', align: 'left', label: t('Status'), field: 'formattedStatus', sortable: true },
      { name: 'payment-status', align: 'left', label: t('PaymentStatus'), field: 'formattedPaymentStatus', sortable: true },
      { name: 'subtotal', align: 'left', label: t('Subtotal'), field: obj => obj?.subtotal ? `${obj.subtotal} ${obj?.currency?.symbol}` : '', sortable: true },
      { name: 'customer', align: 'left', label: t('Customer'), field: obj => `${obj?.customer?.firstName} ${obj?.customer?.lastName}`, sortable: true },
    ]
    const sortFieldNameMap = {
      customer: 'customer_name',
      'payment-status': 'paid_pctg',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

    async function refreshPage(done=() => {}) {
      try {
        await Promise.all([
          fetchOrders(),
        ])
      } finally {
        done()
      }
    }

    return {
      createDefaultFilterOpts,
      tempFilterOpts,
      syncTempToFilterOpts,
      syncFilterOptsToTemp,
      openFilterOptsForm,
      filterOpts,
      statusOpts,

      orders,
      fetchingOrders,
      ordersPagination,
      fetchOrders,

      ordersTableColumns,
      table,
      sortMethod,

      refreshPage,

      // utils funcs
      formatOrderStatus, parseOrderStatusColor,
    }
  },
})
</script>
<style lang="scss" scoped>
.filter-opt {
  border: 1px solid currentColor;
  border-radius: 4px;
}
</style>
