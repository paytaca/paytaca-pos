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
import { marketplaceRpc } from 'src/marketplace/rpc'
import { marketplacePushNotificationsManager } from 'src/marketplace/push-notifications'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useWalletStore } from 'src/stores/wallet'
import { computed, defineComponent, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default defineComponent({
  name: 'MarketplaceLayout',
  setup() {
    const $router = useRouter()
    const $route = useRoute()
    const marketplaceStore = useMarketplaceStore()
    const walletStore = useWalletStore()
    const updatingScope = computed(() => {
      return marketplaceStore.fetchingMerchant ||
             marketplaceStore.fetchingShop ||
             marketplaceStore.fetchingUser
    })
    const userId = computed(() => marketplaceStore.user.id)

    onUnmounted(() => marketplaceRpc.disconnect())
    onMounted(async () => {
      const silent = $route.query.silentSync == 'true'
      // marketplaceStore.refetchMerchant({ silent: false })
      // marketplaceStore.refetchShop({ silent: false })
      const branchChanged = marketplaceStore.shop?.watchtowerBranchId == walletStore.deviceInfo?.branchId
      const updateShopPromise = marketplaceStore.updateActiveShopId({ silent: branchChanged, forceSync: false }).catch(console.error)
      if (branchChanged) await updateShopPromise
      await marketplaceStore.refreshUser({ silent: silent }).catch(console.error)

      if (!userId.value && $route?.meta?.requireAuth) {
        $router.replace({ name: 'marketplace-login', query: { redirectTo: $route.fullPath } })
      }
      marketplacePushNotificationsManager.subscribe(userId.value)
        .then(response => {
          console.log('Subscribed push notifications for marketplace', response)
          return response
        })
    })
    watch(userId, () => {
      if (!userId.value && $route?.meta?.requireAuth) {
        $router.replace({ name: 'marketplace-login', query: { redirectTo: $route.fullPath } })
      }
      if (userId.value) {
        marketplacePushNotificationsManager.subscribe(userId.value)
          .then(response => {
            console.log('Subscribed push notifications for marketplace', response)
            return response
          })
      }
    })

    return {
      marketplaceStore,
      updatingScope,
    }
  }
})
</script>