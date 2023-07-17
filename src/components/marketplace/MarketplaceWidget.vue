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
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useWalletStore } from 'src/stores/wallet'
import { computed, defineComponent, onMounted, ref } from 'vue'

export default defineComponent({
  name: 'MarketplaceWidget',
  setup() {
    const marketplaceStore = useMarketplaceStore()
    const walletStore = useWalletStore()

    const loading = ref(false)
    onMounted(async () => {
      try {
        loading.value = true

        const branchChanged = marketplaceStore.shop?.watchtowerBranchId == walletStore.deviceInfo?.branchId
        const updateShopPromise = marketplaceStore.updateActiveShopId({ silent: true, getOnly: true }).catch(console.error)
        if (branchChanged) await updateShopPromise
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
        data.push({ name: 'Sale', icon: 'point_of_sale', route: { name: 'marketplace-sale', query: { silentSync: true } } })
      }
      if (hasStorefrontRole.value) {
        data.push({ name: 'Orders', icon: 'pending_actions', route: { name: 'marketplace-storefront-orders', query: { silentSync: true } } })
      }
      return data
    })

    return {
      marketplaceStore,
      loading,

      hasCashierRole,
      hasStorefrontRole,
      pages,
    }
  },
})
</script>
