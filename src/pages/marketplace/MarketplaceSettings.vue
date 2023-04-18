<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Shop</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-card class="q-pt-sm q-mt-lg text-weight-medium" style="border-radius:16px;">
      <q-card-section class="q-py-xs">
        <div class="text-h6">
          <q-icon name="storefront" size="1.5em" class="q-mr-xs"/>
          Info
        </div>
      </q-card-section>
      <q-separator/>
      <q-list separator>
        <q-item class="">
          <q-item-section class="text-grey" top>
            <q-item-label>Name</q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>{{ marketplaceStore.shop?.name }}</q-item-label>
            <q-item-label v-if="marketplaceStore.merchant?.name" class="text-grey text-caption">
              {{ marketplaceStore.merchant?.name }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="marketplaceStore.shop?.location?.formatted" class="">
          <q-item-section class="text-grey" top>
            <q-item-label>Address</q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>
              {{ marketplaceStore.shop?.location?.formatted }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="">
          <q-item-section class="text-grey" top>
            <q-item-label>Currency</q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>
              {{ marketplaceStore?.merchant?.currency?.symbol }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>
<script>
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { defineComponent, onMounted } from 'vue'

export default defineComponent({
  name: 'MarketplaceSettings',
  components: {
    MarketplaceHeader
  },
  setup() {
    const marketplaceStore = useMarketplaceStore()

    onMounted(() => {
      marketplaceStore.updateActiveShopId({ silent: true, forceSync: true, forceSyncAge: 5 * 60 * 1000 })
    })

    return {
      marketplaceStore,
    }
  },
})
</script>
