<template>
  <q-card v-if="pages?.length || marketplaceStore.shop?.id" class="q-mx-md" style="border-radius: 10px;">
    <q-card-section class="q-py-sm">
      <div class="row items-center">
        <div class="text-h6 q-space">
          Marketplace
          <q-spinner v-if="loading" size="0.75em"/>
        </div>
        <q-btn
          flat
          no-caps
          padding="xs none"
          label="Go to marketplace"
          class="text-underline"
          :to="{ name: 'marketplace', query: { silentSync: true } }"
        />
      </div>
      <div class="row items-start q-r-mx-md">
        <div
          v-for="(page, index) in pages" :key="index" 
          class="col-6 col-sm-3 q-pa-sm"
        >
          <q-btn
            outline
            color="brandblue"
            no-caps
            :disable="loading"
            :to="page.route"
            class="full-width"
            style="min-height: 80px;"
          >
            <q-badge v-if="page?.badge" floating color="red">
              {{ page?.badge }}
            </q-badge>
            <div>
              <div><q-icon :name="page.icon" size="2em"/></div>
              <div>{{ page.name }}</div>
            </div>
          </q-btn>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>
<script>
import { debounce } from 'quasar'
import { backend } from 'src/marketplace/backend'
import { marketplaceRpc } from 'src/marketplace/rpc'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useWalletStore } from 'src/stores/wallet'
import { computed, defineComponent, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

export default defineComponent({
  name: 'MarketplaceWidget',
  setup() {
    const marketplaceStore = useMarketplaceStore()
    const walletStore = useWalletStore()

    const loading = ref(false)
    let updateShopPromise = ref()
    onMounted(async () => {
      try {
        loading.value = true

        const branchChanged = marketplaceStore.shop?.watchtowerBranchId == walletStore.deviceInfo?.branchId
        updateShopPromise.value = marketplaceStore.updateActiveShopId({ silent: true, getOnly: true }).catch(console.error)
        if (branchChanged) await updateShopPromise.value
        await marketplaceStore.refreshUser({ silent: true }).catch(console.error)
      } finally {
        loading.value = false
      }
    })

    const hasCashierRole = computed(() => marketplaceStore.userRoles.indexOf(marketplaceStore.roles.cashier) >= 0)
    const hasStorefrontRole = computed(() => marketplaceStore.userRoles.indexOf(marketplaceStore.roles.storefront) >= 0)

    const pages = computed(() => {
      const data = []
      if (hasCashierRole.value) {
        data.push({
          name: 'Sale',
          icon: 'point_of_sale',
          route: { name: 'marketplace-sale', query: { silentSync: true } },
        })
      }
      if (hasStorefrontRole.value && marketplaceStore.storefront?.id) {
        data.push({
          name: 'Orders',
          icon: 'pending_actions',
          badge: ordersCount.value,
          route: { name: 'marketplace-storefront-orders', query: { silentSync: true } },
        })
      }
      return data
    })

    const ordersCount = ref(0)
    onMounted(async () => {
      await updateShopPromise.value?.catch?.(() => {})
      if (marketplaceStore.shopData?.id != marketplaceStore?.storefrontData?.shop_id) {
        await marketplaceStore.fetchStorefront()
      }
      updateOrdersCount()
    })
    const updateOrdersCount = debounce(async function () {
      const params = {
        storefront_id: marketplaceStore.storefrontData?.id || null,
        limit: 1, offset: 999,
        statuses: ['pending', 'confirmed', 'preparing'].join(','),
      }

      return backend.get(`connecta/orders/`, { params })
        .then(response => {
          ordersCount.value = response?.data?.count
          return response
        })
    }, 500)

    const orderUpdateEventName = 'order_updates'
    watch(() => [marketplaceStore.storefrontData?.id], () => subscribeUpdatesToRpc())
    onMounted(() => setTimeout(() => subscribeUpdatesToRpc(), 500))
    onUnmounted(() => unsubscribeUpdatesToRpc())
    async function subscribeUpdatesToRpc() {
      if (!marketplaceRpc.isConnected()) await marketplaceRpc.connect()
      marketplaceRpc.client.call('subscribe', [
        orderUpdateEventName,
        { storefront_id: parseInt(marketplaceStore.storefrontData?.id) },
      ])

      if (!marketplaceRpc.client.onNotification.includes(onNotificationHandler)) {
        marketplaceRpc.client.onNotification.push(onNotificationHandler)
      }
    }

    async function unsubscribeUpdatesToRpc() {
      if (!marketplaceRpc.isConnected()) return
      marketplaceRpc.client.call('unsubscribe', [orderUpdateEventName])
      marketplaceRpc.client.onNotification = marketplaceRpc.client.onNotification
        .filter(handler => handler !== onNotificationHandler)
    }
  
    const onNotificationHandler = notification  => {
      if (notification?.event != orderUpdateEventName) return
      if (notification?.data?.storefront_id != marketplaceStore.storefrontData?.id) return
      updateOrdersCount()
    }

    return {
      marketplaceStore,
      loading,

      hasCashierRole,
      hasStorefrontRole,
      pages,

      ordersCount,
    }
  },
})
</script>
