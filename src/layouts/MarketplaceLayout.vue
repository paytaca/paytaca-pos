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
import { updateOrCreateKeypair } from 'src/marketplace/chat'
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
    onMounted(() => loadApp())

    async function loadApp() {
      if (marketplaceStore.appRefreshScopePromise) {
        return marketplaceStore.appRefreshScopePromise
      }
      marketplaceStore.appRefreshScopePromise = _loadApp()
      return marketplaceStore.appRefreshScopePromise.finally(() => {
        marketplaceStore.appRefreshScopePromise = undefined
      })
    }
    async function _loadApp() {
      const silent = $route.query.silentSync == 'true'
      const branchChanged = marketplaceStore.shop?.watchtowerBranchId == walletStore.deviceInfo?.branchId
      const updateShopPromise = marketplaceStore.updateActiveShopId({ silent: branchChanged, forceSync: false }).catch(console.error)
      if (branchChanged) await updateShopPromise
      await marketplaceStore.refreshUser({ silent: silent }).catch(console.error)

      if (!userId.value && $route?.meta?.requireAuth) {
        $router.replace({ name: 'marketplace-login', query: { redirectTo: $route.fullPath } })
      }

      if (userId.value) {
        subscribePushNotifications(userId.value)
          .then(response => {
            console.log('Subscribed push notifications for marketplace', response)
            return response
          })
      }
    }

    watch(userId, () => {
      if (!userId.value && $route?.meta?.requireAuth) {
        $router.replace({ name: 'marketplace-login', query: { redirectTo: $route.fullPath } })
      }
      if (userId.value) {
        window.promptedPushNotificationsSettings = false
        subscribePushNotifications(userId.value)
          .then(response => {
            console.log('Subscribed push notifications for marketplace', response)
            return response
          })
      }
    })

    onMounted(() => userId.value ? updateOrCreateKeypair() : null)
    watch(userId, () => userId.value ? updateOrCreateKeypair() : null)

    async function subscribePushNotifications(id) {
      if (!window.promptedPushNotificationsSettings) {
        const promptResponse = await promptEnablePushNotificationSetting(
          'Enable notifications to receive updates'
        ).catch(console.error)
        window.promptedPushNotificationsSettings = promptResponse.prompted
      }
      return marketplacePushNotificationsManager.subscribe(id)
    }

    async function promptEnablePushNotificationSetting(message='') {
      const response = { isPushNotificationEnabled: null, prompted: false }
      const pushNotificationsStatusResponse = await marketplacePushNotificationsManager.isPushNotificationEnabled()
      response.isPushNotificationEnabled = pushNotificationsStatusResponse?.isEnabled
      if (response.isPushNotificationEnabled === false) {
        const openSettingsResponse = await marketplacePushNotificationsManager.openPushNotificationsSettingsPrompt({
          message: message || undefined,
        })
        response.isPushNotificationEnabled = openSettingsResponse?.isEnabled
        response.prompted = true
      }
      return response
    }

    return {
      marketplaceStore,
      updatingScope,
    }
  }
})
</script>
