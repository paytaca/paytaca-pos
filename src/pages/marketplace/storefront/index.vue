<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Storefront</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>

    <div v-if="marketplaceStore.storefrontData.id" class="text-subtitle1">
      {{ marketplaceStore.storefrontData.name }}
    </div>
    <q-card v-else>
      <q-card-section>
        <div class="text-grey">No storefront</div>
        <q-btn
          no-caps
          label="Create Storefront"
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
import { useMarketplaceStore } from 'src/stores/marketplace'
import { defineComponent, onMounted } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

export default defineComponent({
  name: 'StorefrontIndexPage',
  components: {
    MarketplaceHeader,
  },
  setup() {
    const marketplaceStore = useMarketplaceStore()
    onMounted(() => marketplaceStore.fetchStorefront())

    const pages = [
      { name: 'Products', icon: 'local_mall', route: { name: 'marketplace-storefront-products' } },
      { name: 'Orders', icon: 'pending_actions', route: { name: 'marketplace-storefront-orders' } },
      { name: 'Settings', icon: 'settings', route: { name: 'marketplace-storefront-settings' } },
    ]

    return {
      marketplaceStore,
      pages,
    }
  }
})
</script>

