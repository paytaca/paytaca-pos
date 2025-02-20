<template>
  <footer
    elevated
    reveal
    class="layout-footer q-footer fixed-bottom shadow-up-1"
  >
    <div class="row items-center justify-around">
      <div>  
        <q-btn
          color="brandblue"
          flat
          :ripple="false"
          padding="md sm sm sm"
          :to="{ name: 'marketplace' }"
        >
          <div>
            <q-icon name="home"/>
            <div class="text-caption">Home</div>
          </div>
        </q-btn>
      </div>

      <div>  
        <q-btn
          color="brandblue"
          flat
          :ripple="false"
          padding="md sm sm sm"
          :to="{ name: 'marketplace-products' }"
        >
          <div>
            <!-- <img src="~assets/icons/inventory.svg" height="35" width="35"/> -->
            <!-- <q-icon name="img:assets/icons/inventory.svg"/> -->
            <q-icon name="local_mall"/>
            <div class="text-caption">Products</div>
          </div>
        </q-btn>
      </div>

      <div>
        <q-btn
          color="brandblue"
          flat
          :ripple="false"
          padding="md sm sm sm"
          :to="{ name: 'marketplace-storefront-orders' }"
        >
          <div>
            <q-icon name="pending_actions"/>
            <div class="text-caption">Orders</div>
          </div>
        </q-btn>
      </div>

      <div>
        <q-btn
          color="brandblue"
          flat
          :ripple="false"
          padding="md sm sm sm"
          :to="{ name: 'home' }"
        >
          <div>
            <q-icon name="exit_to_app"/>
            <div class="text-caption">Exit</div>
          </div>
        </q-btn>
      </div>
    </div>
  </footer>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MarketplaceFooterNav',
  setup() {
    
  },
})
</script>
<style lang="scss" scoped>
.layout-footer {
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
  background-color: white;
}
body.body--dark .layout-footer {
  background-color: $dark;  
}

</style>
