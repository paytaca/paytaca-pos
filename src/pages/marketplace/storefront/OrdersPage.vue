<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Orders</div>
            <div class="text-grey">Storefront</div>
          </div>
        </template>
      </MarketplaceHeader>

      <div class="full-width q-px-sm q-mb-sm">
        <div class="row">
          <q-input
            dense
            :loading="Boolean(filterOpts?.search && fetchingOrders)"
            v-model="filterOpts.search"
            placeholder="PO#, Item name"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn-dropdown
            v-model="openFilterOptsForm"
            flat
            no-caps
            padding="xs"
            dropdown-icon="tune"
            no-icon-animation
            style="max-width: 50%;"
            @before-show="() => tempStatusesFilter = [].concat(filterOpts.statuses)"
            @hide="() => syncTempStatusesToFilterOpts()"
          >
            <!-- <template v-slot:label>
              <div v-if="filterOpts.statuses.length" class="ellipsis">
                Status: {{ filterOpts.statuses.map(formatOrderStatus).join(',') }}
              </div>
              <template v-else>
                Filter status
              </template>
            </template> -->
            <q-list separator>
              <q-item
                v-show="Boolean(filterOpts.statuses?.length)"
                clickable
                v-close-popup
                @click="() => tempStatusesFilter = []"
              >
                <q-item-section>
                  <q-item-label class="text-grey">Remove filter</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-for="status in statusOpts" :key="status"
                clickable
                active-class="text-weight-medium"
                @click="() => toggleTempStatusesFilter(status)"
              >
                <q-item-section side>
                  <q-checkbox
                    dense
                    v-model="tempStatusesFilter" :val="status"
                    :color="parseOrderStatusColor(status)"
                  />
                  <!-- <q-icon size="0.6em" name="circle" :color="parseOrderStatusColor(status)"/> -->
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ formatOrderStatus(status) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="circle" size="0.65em" :color="parseOrderStatusColor(status)"/>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
      </div>
      <div class="row q-gutter-sm q-mb-md">
        <div
          v-if="filterOpts?.statuses?.length" style="max-width:45vw;"
          class="ellipsis filter-opt q-px-xs"
          @click="openFilterOptsForm = true"
        >
          Status: {{ filterOpts?.statuses?.map?.(formatOrderStatus)?.join(', ') }}
        </div>
      </div>
      <q-table
        :loading="fetchingOrders"
        :columns="ordersTableColumns"
        :rows="orders"
        :pagination="{ rowsPerPage: 0 }"
        row-key="id"
        hide-pagination
        @row-click="(evt, row) => $router.push({ name: 'marketplace-storefront-order', params: { orderId: row.id } })"
      >
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="props.row?.statusColor">
              {{ props.row.formattedStatus }}
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
  },
  setup(props) {
    const $route = useRoute()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    onMounted(() => refreshPage())

    const statusOpts = [
      'pending', 'confirmed', 'preparing',
      'ready_for_pickup', 'on_delivery', 'delivered',
      'completed', 'cancelled',
    ]
    const tempStatusesFilter = ref([])
    function toggleTempStatusesFilter(status) {
      if (!statusOpts.includes(status)) return
      if (!tempStatusesFilter.value.includes(status)) tempStatusesFilter.value.push(status)
      else tempStatusesFilter.value = tempStatusesFilter.value.filter(_status => _status != status)
    }
    function syncTempStatusesToFilterOpts() {
      const hasAddedStatuses = tempStatusesFilter.value
        .some(status => !filterOpts.value.statuses.includes(status))
      const hasRemovedStatuses = filterOpts.value.statuses
        .some(status => !tempStatusesFilter.value.includes(status))
      if (!hasAddedStatuses && !hasRemovedStatuses) return

      filterOpts.value.statuses = [].concat(tempStatusesFilter.value)
    }

    const openFilterOptsForm = ref(false) 
    const filterOpts = ref({
      search: props.s || '',
      statuses: props.statuses?.split?.(',')?.filter(status => statusOpts.includes(status)) || [],
    })
    watch(filterOpts, () => fetchOrders(), { deep: true })
    watch(filterOpts, () => {
      $router.replace({
        s: filterOpts.value.search || undefined,
        query: Object.assign({}, $route.query, {
          statuses: filterOpts.value?.statuses?.join(',') || undefined,
        })
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
        statuses: filterOpts.value?.statuses?.join(',') || undefined,
        s: filterOpts.value.search || undefined,
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

    const ordersTableColumns = [
      { name: 'id', align: 'left', label: 'Order', field: 'id', format: val => val ? `#${val}` : '' },
      { name: 'status', align: 'left', label: 'Status', field: 'formattedStatus' },
      { name: 'payment-status', align: 'left', label: 'Payment Status', field: 'formattedPaymentStatus' },
      { name: 'subtotal', align: 'left', label: 'Subtotal', field: obj => obj?.subtotal ? `${obj.subtotal} ${obj?.currency?.symbol}` : '' },
      { name: 'customer', align: 'left', label: 'Customer', field: obj => `${obj?.customer?.firstName} ${obj?.customer?.lastName}` },
    ]

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
      tempStatusesFilter,
      openFilterOptsForm,
      filterOpts,
      statusOpts,
      toggleTempStatusesFilter,
      syncTempStatusesToFilterOpts,

      orders,
      fetchingOrders,
      ordersPagination,
      fetchOrders,

      ordersTableColumns,

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
