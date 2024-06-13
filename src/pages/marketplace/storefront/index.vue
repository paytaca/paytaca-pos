<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">{{ $t('Storefront') }}</div>
          <div class="text-grey">{{ $t('Marketplace') }}</div>
        </div>
      </template>
    </MarketplaceHeader>

    <div v-if="marketplaceStore.storefrontData.id" class="text-subtitle1">
      {{ marketplaceStore.storefrontData.name }}
    </div>
    <q-card v-else>
      <q-card-section>
        <div class="text-grey">{{ $t('NoStorefront') }}</div>
        <q-btn
          no-caps
          :label="$t('CreateStorefront')"
          color="brandblue"
          class="full-width q-mt-sm"
          :to="{name: 'marketplace-storefront-setup'}"
        />
      </q-card-section>
    </q-card>

    <div v-if="marketplaceStore.storefrontData.id" class="row items-start">
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
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { debounce } from 'quasar'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

export default defineComponent({
  name: 'StorefrontIndexPage',
  components: {
    MarketplaceHeader,
  },
  setup() {
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()
    onMounted(() => marketplaceStore.fetchStorefront())
    onMounted(() => updateOrdersCount())

    const pages = computed(() => {
      return [
        { name: t('Products'), icon: 'local_mall', route: { name: 'marketplace-storefront-products' } },
        { name: t('Collections'), icon: 'collections', route: { name: 'marketplace-storefront-collections' } },
        { name: t('Orders'), icon: 'pending_actions', badge: ordersCount.value, route: { name: 'marketplace-storefront-orders' } },
        { name: t('Payments'), icon: 'payments', route: { name: 'marketplace-storefront-payments' } },
        { name: t('Settings'), icon: 'settings', route: { name: 'marketplace-storefront-settings' } },
      ]
    })

    watch(() => [marketplaceStore.storefront?.id], () => updateOrdersCount())
    const ordersCount = ref([0].map(Number)[0])
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

    return {
      marketplaceStore,
      pages,
    }
  }
})
</script>

