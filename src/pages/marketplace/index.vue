<template>
  <q-page class="q-pa-md" style="padding-bottom: 4.5rem;">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader class="q-pl-md">
        <template v-slot:title>
          <div class="q-space">
            <div class="text-h5 ellipsis" style="max-width:calc(100vw - 6rem);">
              {{ marketplaceStore.shop?.name || 'Marketplace' }}
            </div>
            <div v-if="marketplaceStore.shop?.name" class="text-subtitle2 text-grey">
              Marketplace
            </div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="row justify-end">
        <q-btn
          :ripple="false"
          flat no-caps
          :label="marketplaceStore.dashboard.showSummary ? 'Hide summary' : 'Show summary'"
          class="text-underline"
          padding="xs sm"
          @click="() => marketplaceStore.dashboard.showSummary = !marketplaceStore.dashboard.showSummary"
        />
      </div>
      <q-slide-transition>
        <div
          v-if="marketplaceStore.dashboard.showSummary"
          class="snap-container row no-wrap q-mx-xs q-mb-md"
        >
          <DashboardCard
            v-if="marketplaceStore.userPermissions.inventory"
            title="Inventory" :loading="salesToday?.loading" ripple class="q-space"
            @click="() => tabs.active = tabs.active === 'inventory' ? '' : 'inventory'"
          >
            <div v-if="Number.isFinite(productsCount)">
              {{ productsCount }} product{{ productsCount == 1 ? '' : 's' }}
            </div>
            <div v-if="Number.isFinite(toReviewPurchaseOrdersCount)" class="ellipsis">
              {{ toReviewPurchaseOrdersCount }} pending purchase orders
            </div>
          </DashboardCard>
    
          <DashboardCard
            v-if="marketplaceStore.userPermissions.storefront"
            title="Storefront" :loading="salesToday?.loading" ripple class="q-space"
            @click="() => tabs.active = tabs.active === 'storefront' ? '' : 'storefront'"
          >
            <template v-if="marketplaceStore.storefrontData?.id">
              <div v-if="typeof storefrontHours?.isOpen === 'boolean'" class="row">
                <div v-if="storefrontHours?.isOpen" class="text-green">OPEN</div>
                <template v-else>
                  <div class="text-red q-pr-xs">CLOSED</div>
                  <template v-if="storefrontHours?.nextOpenTimestamp">
                    <span class="text-grey">
                      Opens {{ formatDateRelative(storefrontHours?.nextOpenTimestamp) }}
                    </span>
                  </template>
                </template>
              </div>
              <template v-if="Number.isFinite(pendingOrdersCount)">
                <div v-if="pendingOrdersCount">
                  {{ pendingOrdersCount }} pending order{{ pendingOrdersCount === 1 ? '' : 's' }}
                </div>
                <div v-else class="text-grey">No pending orders</div>
              </template>
            </template>
            <div v-else class="text-grey">
              Storefront not setup
            </div>
          </DashboardCard>
  
          <DashboardCard
            v-if="marketplaceStore.userPermissions.cashier"
            title="Sales" :loading="salesToday?.loading" ripple class="q-space"
            @click="() => tabs.active = tabs.active === 'sales' ? '' : 'sales'"
          >
            <template v-if="salesToday.data?.length">
              <div v-for="(report, index) in salesToday.data" :key="index">
                {{ report?.total }} {{ report?.currency }}
              </div>
            </template>
            <div v-else class="text-grey">None</div>
          </DashboardCard>
  
          <DashboardCard
            v-if="marketplaceStore.userPermissions.admin"
            title="Shop" ripple class="q-space"
            @click="() => tabs.active = tabs.active === 'shop' ? '' : 'shop'"
          >
            <div v-if="staffCount !== undefined">{{ staffCount }} staff</div>
          </DashboardCard>
        </div>
      </q-slide-transition>
  
      <div
        v-if="!marketplaceStore.hasRole"
        :class="[
          'q-pa-md rounded-borders text-weight-medium q-mb-md',
          'text-white',
          $q.dark.isActive ? 'bg-amber-8' : 'bg-amber',
        ]"
      >
        <q-icon name="warning" class="q-mr-sm"/>
        You do not have access to the shop. Contact a shop admin to grant access.
      </div>
      <div>
        <div v-for="(pageGroup, name) in pageGroups" :key="name">
          <template v-if="pageGroup.pages?.length && (!tabs?.active || tabs?.active == name)">
            <div class="text-h6 q-pl-sm">{{ pageGroup.name }}</div>
            <div class="row items-start">
              <div
                v-for="(page, index) in pageGroup.pages" :key="index" 
                class="col-6 col-sm-3 q-pa-sm"
              >
                <q-btn
                  outline
                  color="brandblue"
                  no-caps
                  :to="page.route"
                  class="full-width"
                  style="min-height: 120px;"
                >
  
                  <q-badge v-if="page?.badge" floating color="red">
                    {{ page?.badge }}
                  </q-badge>
                  <div>
                    <div><q-icon :name="page.icon" size="3em"/></div>
                    <div>{{ page.name }}</div>
                  </div>
                </q-btn>
              </div>
            </div>
          </template>
        </div>
        <!-- <div class="row items-start">
          <div
            v-for="(page, index) in pages" :key="index" 
            class="col-6 col-sm-3 q-pa-sm"
          >
            <q-btn
              outline
              color="brandblue"
              no-caps
              :to="page.route"
              class="full-width"
              style="min-height: 100px;"
            >
              <div>
                <div><q-icon :name="page.icon" size="3em"/></div>
                <div>{{ page.name }}</div>
              </div>
            </q-btn>
          </div>
        </div> -->
      </div>
      <MainFooter/>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { formatDateRelative, formatDateToText } from 'src/marketplace/utils'
import { debounce } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import DashboardCard from 'src/components/marketplace/dashboard/DashboardCard.vue'
import MainFooter from 'src/components/MainFooter.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

export default defineComponent({
  name: 'MarketplacePage',
  props: {
    activeTab: String,
  },
  components: {
    DashboardCard,
    MainFooter,
    MarketplaceHeader,
  },
  setup(props) {
    const $route = useRoute()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    onMounted(() => {
      // to prevent extra api call when layout is already refetching
      setTimeout(() => {
        if (marketplaceStore.fetchingShop) return
        marketplaceStore.refetchShop()
      }, 100)
    })
    onMounted(() => setTimeout(async () => {
      await marketplaceStore.appRefreshScopePromise?.catch?.(() => {})
      refreshPage()
    }, 100))

    const tabOpts = ['sales', 'inventory', 'storefront', 'shop']
    const tabs = ref({
      active: tabOpts.includes(props.activeTab) ? props.activeTab : '',
      opts: tabOpts,
    })
    watch(() => [tabs.value.active], () => {
      const query = { ...$route.query, activeTab: tabs.value.active }
      if (!query.activeTab) delete query.activeTab
      $router.replace({ query: query })
    })
    watch(() => props.activeTab, () => {
      tabs.value.active = tabOpts.includes(props.activeTab) ? props.activeTab : ''
    })

    const pageGroups = computed(() => {
      const data = {
        sales: {
          name: 'Sales',
          pages: [],
        },
        inventory: {
          name: 'Inventory',
          pages: [],
        },
        shop: {
          name: 'Shop',
          pages: [],
        },
      }

      data.sales.pages.push({ name: 'Sales Report', icon: 'query_stats', route: { name: 'marketplace-sales-reports' } })
      if (marketplaceStore.userPermissions.cashier) {
        data.sales.pages.push(
          { name: 'Sale', icon: 'point_of_sale', route: { name: 'marketplace-sale' } },
          { name: 'Sales', icon: 'receipt', route: { name: 'marketplace-sales' } },
        )
      }

      if (marketplaceStore.userPermissions.inventory) {
        data.inventory.pages.push(
          { name: 'Products', icon: 'local_mall', route: { name: 'marketplace-products' } },
          { name: 'Stocks', icon: 'inventory', route: { name: 'marketplace-stocks' } },
          { name: 'Purchase Orders', icon: 'assignment_returned', badge: toReviewPurchaseOrdersCount.value, route: { name: 'marketplace-purchase-orders' } },
        )
      }


      if (marketplaceStore.userPermissions.admin) {
        data.shop.pages.push(
          { name: 'Staff', icon: 'supervisor_account', route: { name: 'marketplace-staff' } },
        )
      }
      data.shop.pages.push({ name: 'Shop info', icon: 'store', route: { name: 'marketplace-settings' } })
      if (marketplaceStore.userPermissions.storefront) {
        data.shop.pages.push({ name: 'Storefront', icon: 'storefront', route: { name: 'marketplace-storefront' } })

        if (tabs.value.active === 'storefront') {
          data.storefront = {
            name: 'Storefront',
            pages: [
              { name: 'Products', icon: 'local_mall', route: { name: 'marketplace-storefront-products' } },
              { name: 'Collections', icon: 'collections', route: { name: 'marketplace-storefront-collections' } },
              { name: 'Orders', icon: 'pending_actions', badge: pendingOrdersCount.value, route: { name: 'marketplace-storefront-orders' } },
              { name: 'Payments', icon: 'payments', route: { name: 'marketplace-storefront-payments' } },
              { name: 'Settings', icon: 'settings', route: { name: 'marketplace-storefront-settings' } },
            ]
          }
          if (!marketplaceStore.storefrontData?.id) {
            data.storefront.pages = [
              { name: 'Setup storefront', icon: 'settings', route: { name: 'marketplace-storefront-settings' } }, 
            ]
          }
        }

      }
      return data
    })

    const salesToday = ref({
      totalCount: 0,
      dateString: '',
      data: [].map(() => Object({ total: 0, count: 0, currency: '' })),
      loading: false,
    })
    async function updateSalesToday() {
      if (!marketplaceStore.userPermissions.cashier) return

      const now = Date.now()
      const data = {
        shop_id: marketplaceStore.activeShopId,
        timestamp_from: new Date(now),
        timestamp_to: new Date(now),
      }
      data.timestamp_from.setHours(0,0,0,0)
      data.timestamp_to.setHours(24,0,0,-1)

      salesToday.value.loading = true
      return backend.post(`sales-orders/report/`, data)
        .then(response => {
          if (!Array.isArray(response?.data?.data)) return Promise.reject({ response })
          salesToday.value.data = response?.data?.data
          // salesToday.value.data = [
          //   { total: 100, count: 3, currency: 'PHP' },
          //   { total: 12.31, count: 3, currency: 'USD' },
          // ]
          salesToday.value.totalCount = salesToday.value.data.reduce((subtotal, report) => {
            return subtotal + (report?.count || 0)
          }, 0)
          salesToday.value.dateString = formatDateToText(data.timestamp_from)
          return response
        })
        .finally(() => {
          salesToday.value.loading = false
        })
    }

    const productsCount = ref([].map(Number)[0])
    function getProductsCount() {
      const params = { shop_id: marketplaceStore.shopData?.id || 0, limit: 1, offset: 999 }
      return backend.get(`products`, { params })
        .then(response => {
          productsCount.value = response?.data?.count
          return response
        })
    }

    const toReviewPurchaseOrdersCount = ref([].map(Number)[0])
    function getToReviewPurchaseOrderCount() {
      const params = {
        to_review: true,
        reviewed: false,
        limit: 1,
        offset: 999,
      }

      return backend.get('/purchase-orders/', { params })
        .then(response => {
          if (response?.data?.count === undefined) return Promise.reject({ response })
          toReviewPurchaseOrdersCount.value = response?.data?.count
          return response
        })
    }

    watch(() => [marketplaceStore.storefront?.id], () => updateOrdersCount())
    const pendingOrdersCount = ref([].map(Number)[0])
    const updateOrdersCount = debounce(async function () {
      if (!marketplaceStore.userPermissions.storefront) return
      const params = {
        storefront_id: marketplaceStore.storefrontData?.id || null,
        limit: 1, offset: 999,
        statuses: ['pending', 'confirmed', 'preparing'].join(','),
      }

      return backend.get(`connecta/orders/`, { params })
        .then(response => {
          pendingOrdersCount.value = response?.data?.count
          return response
        })
    }, 500)

    const storefrontHours = computed(() => {
      const data = { isOpen: [].map(Boolean)[0], nextOpenTimestamp: 0 }

      const openStatus = marketplaceStore.storefrontHoursData.open_status
      if (openStatus) data.isOpen = openStatus == 'open'

      const now = Date.now()
      const nextOpenHours = marketplaceStore.nextOpenHours
        .filter(timeRange => now < timeRange[0] || now < timeRange[1])[0]

      if (openStatus == 'auto' && nextOpenHours?.length == 2) {
        data.isOpen = nextOpenHours[0] <= now && now <= nextOpenHours[1]
        data.nextOpenTimestamp = nextOpenHours[0]
      }
      return data
    })

    const staffCount = ref([].map(Number)[0])
    function getStaffCount() {
      const params = { limit: 1, offset: 999 }
      return backend.get(`shops/${marketplaceStore.shopData?.id}/staff/`, { params })
        .then(response => {
          staffCount.value = response?.data?.count
          return response
        })
    }

    async function refreshPage(done=() => {}) {
      try {
        await Promise.all([
          !marketplaceStore.fetchingShop ? marketplaceStore.refetchShop() : null,
          updateSalesToday(),
          getProductsCount(),
          getToReviewPurchaseOrderCount(),
          marketplaceStore.fetchStorefront()
            .then(() => {
              if (!marketplaceStore.storefrontData?.id) return
              return marketplaceStore.fetchStorefrontHours()
            }),
          updateOrdersCount(),
          getStaffCount(),
        ])
      } finally {
        done?.()
      }
    }

    return {
      marketplaceStore,
      tabs,
      pageGroups,

      salesToday,
      productsCount,
      toReviewPurchaseOrdersCount,
      pendingOrdersCount,
      storefrontHours,
      staffCount,

      refreshPage,

      formatDateRelative,
    }
  },
})
</script>
<style lang="scss" scoped>
.snap-container {
  overflow-x:auto;
  scroll-snap-type: x mandatory;
}
.snap-container > div {
  display: inline-block;
  // height: 80%;
  // border-radius: 10%;
  // aspect-ratio: 1/1;
  // margin: 5px;
  scroll-snap-align: start;
}
</style>
