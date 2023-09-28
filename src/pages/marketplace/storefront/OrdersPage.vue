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
          <q-space/>
          <q-btn-dropdown
            flat
            no-caps
            padding="xs"
            :label="filterOpts.status ? `Status: ${formatOrderStatus(filterOpts.status)}` : 'Filter status'"
          >
            <q-list separator>
              <q-item
                v-show="Boolean(filterOpts.status)"
                clickable
                v-close-popup
                @click="() => filterOpts.status = ''"
              >
                <q-item-section>
                  <q-item-label class="text-grey">Remove filter</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-for="status in statusOpts" :key="status"
                :active="filterOpts.status == status"
                clickable
                v-close-popup
                active-class="text-weight-medium"
                @click="() => filterOpts.status = status"
              >
                <q-item-section side>
                  <q-icon size="0.6em" name="circle" :color="parseOrderStatusColor(status)"/>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ formatOrderStatus(status) }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
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
import { defineComponent, onMounted, watch, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'

export default defineComponent({
  name: 'OrdersPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const marketplaceStore = useMarketplaceStore()
    onMounted(() => refreshPage())

    const filterOpts = ref({
      status: '',
    })
    watch(filterOpts, () => fetchOrders(), { deep: true })
    const statusOpts = [
      'pending', 'confirmed', 'preparing',
      'ready_for_pickup', 'on_delivery', 'delivered',
      'completed', 'cancelled',
    ]

    const fetchingOrders = ref(false)
    const orders = ref([].map(Order.parse))
    const ordersPagination = ref({ count: 0, limit: 0, offset: 0 })
    function fetchOrders(opts={ limit: 0, offset: 0 }) {
      const params = {
        storefront_id: marketplaceStore.storefrontData?.id || null,
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
        status: filterOpts.value?.status || undefined,
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
      filterOpts,
      statusOpts,

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
