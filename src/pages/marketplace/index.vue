<template>
  <q-page class="q-pa-md" style="padding-bottom: 4.5rem;">
    <MarketplaceHeader class="q-pl-md"/>
    <!-- <q-item
      dense
      v-if="marketplaceStore?.shop?.id"
      class="row items-center q-mb-md text-subtitle1"
    >
      <q-item-section side top>
        <q-icon name="store" size="2.5em" class="q-mr-sm"/>
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ marketplaceStore?.shop?.name }}</q-item-label>
        <q-item-label v-if="marketplaceStore?.shop?.location?.formatted" class="text-caption">
          {{ marketplaceStore?.shop?.location?.formatted }}
        </q-item-label>
      </q-item-section>
    </q-item> -->

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
        <template v-if="pageGroup.pages?.length">
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
  </q-page>
</template>
<script>
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, onMounted } from 'vue'
import MainFooter from 'src/components/MainFooter.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

export default defineComponent({
  name: 'MarketplacePage',
  components: {
    MainFooter,
    MarketplaceHeader,
  },
  setup() {
    const marketplaceStore = useMarketplaceStore()
    onMounted(() => {
      // to prevent extra api call when layout is already refetching
      setTimeout(() => {
        if (marketplaceStore.fetchingShop) return
        marketplaceStore.refetchShop()
      }, 100)
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
          { name: 'Purchase Orders', icon: 'assignment_returned', route: { name: 'marketplace-purchase-orders' } },
        )
      }


      if (marketplaceStore.userPermissions.admin) {
        data.shop.pages.push(
          { name: 'Staff', icon: 'supervisor_account', route: { name: 'marketplace-staff' } },
        )
      }
      data.shop.pages.push({ name: 'Shop info', icon: 'store', route: { name: 'marketplace-settings' } })
      data.shop.pages.push({ name: 'Storefront', icon: 'storefront', route: { name: 'marketplace-storefront' } })
      return data
    })

    return {
      marketplaceStore,
      pageGroups,
    }
  },
})
</script>
