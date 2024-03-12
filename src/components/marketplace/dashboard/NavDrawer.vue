<template>
  <q-drawer v-model="innerVal" v-bind="drawerProps">
    <slot name="default" v-bind="{ pageGroups, toggleValue }">
      <q-list v-for="(pageGroup, name) in pageGroups" :key="name">
        <template v-if="pageGroup.pages?.length">
          <q-item-label header> {{ pageGroup.name }}</q-item-label>
          <q-item
            v-for="(page, index) in pageGroup.pages" :key="index" 
            clickable v-ripple v-close-popup
            :to="page.route"
          >
            <q-item-section avatar>
              <q-icon :name="page.icon"/>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ page.name }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="page?.badge" side>
              <q-badge color="red">
                {{ page?.badge }}
              </q-badge>
            </q-item-section>
          </q-item>
        </template>
      </q-list>
    </slot>
  </q-drawer>
</template>
<script>
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, ref, watch } from 'vue'

export default defineComponent({
  emits: [
    'update:model-value'
  ],
  props: {
    modelValue: Boolean,
    drawerProps: Object,
    toReviewPurchaseOrdersCount: Number,
    pendingOrdersCount: Number,
  },
  setup(props, { emit: $emit }) {
    const marketplaceStore = useMarketplaceStore()
    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))

    function toggleValue() {
      innerVal.value = !innerVal.value
    }

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
        storefront: {
          name: 'Storefront',
          pages: [],
        }
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
          { name: 'Purchase Orders', icon: 'assignment_returned', badge: props.toReviewPurchaseOrdersCount, route: { name: 'marketplace-purchase-orders' } },
        )
      }

      if (marketplaceStore.userPermissions.admin) {
        data.shop.pages.push(
          { name: 'Staff', icon: 'supervisor_account', route: { name: 'marketplace-staff' } },
        )
      }

      data.shop.pages.push({ name: 'Shop info', icon: 'store', route: { name: 'marketplace-settings' } })
      if (marketplaceStore.userPermissions.storefront) {
        if (marketplaceStore.storefrontData?.id) {
          data.storefront.pages.push(
            { name: 'Products', icon: 'local_mall', route: { name: 'marketplace-storefront-products' } },
            { name: 'Collections', icon: 'collections', route: { name: 'marketplace-storefront-collections' } },
            { name: 'Orders', icon: 'pending_actions', badge: props.pendingOrdersCount, route: { name: 'marketplace-storefront-orders' } },
            { name: 'Payments', icon: 'payments', route: { name: 'marketplace-storefront-payments' } },
          )
        }

        data.storefront.pages.push(
          { name: 'Settings', icon: 'settings', route: { name: 'marketplace-storefront-settings' } },
        )
      }

      return data
    })

    return {
      innerVal,
      toggleValue,

      pageGroups,
    }
  },
})
</script>
