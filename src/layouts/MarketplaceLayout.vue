<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-dialog :model-value="updatingScope" persistent>
        <div class="row items-center text-white q-pa-md">
          <q-spinner size="3em" class="q-mr-sm"/>
          <div>
            <div v-if="marketplaceStore.fetchingMerchant">Fetching merchant...</div>
            <div v-if="marketplaceStore.fetchingShop">Fetching shop...</div>
            <div v-if="marketplaceStore.fetchingUser">Fetching user...</div>
          </div>
        </div>
      </q-dialog>
      <router-view>
      </router-view>
    </q-page-container>
  </q-layout>
</template>

<script>
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default defineComponent({
  name: 'MarketplaceLayout',
  setup() {
    const $router = useRouter()
    const $route = useRoute()
    const marketplaceStore = useMarketplaceStore()
    const updatingScope = computed(() => {
      return marketplaceStore.fetchingMerchant ||
             marketplaceStore.fetchingShop ||
             marketplaceStore.fetchingUser
    })

    onMounted(async () => {
      // marketplaceStore.refetchMerchant({ silent: false })
      // marketplaceStore.refetchShop({ silent: false })
      await marketplaceStore.updateActiveShopId({ silent: false, forceSync: false }).catch(console.error)
      await marketplaceStore.refreshUser({ silent: false }).catch(console.error)

      if (!marketplaceStore.user.id && $route?.meta?.requireAuth) {
        $router.replace({ name: 'marketplace-login', query: { redirectTo: $route.fullPath } })
      }
    })
    watch(
      () => [marketplaceStore.user?.id],
      () => {
        if (!marketplaceStore.user.id && $route?.meta?.requireAuth) {
          $router.replace({ name: 'marketplace-login', query: { redirectTo: $route.fullPath } })
        }
      }
    )
    return {
      marketplaceStore,
      updatingScope,
    }
  }
})
</script>
