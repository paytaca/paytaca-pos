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
          size="1.5rem"
          padding="sm lg"
          icon="home"
          :to="{ name: 'home' }"
        />
      </div>
      <div>
        <div class="receive-page-btn-container shadow-20">
          <q-btn
            flat
            color="brandblue"
            round
            padding="md"
            size="1.75rem"
            icon="qr_code"
            :disable="(!$pinia.state.value.wallet?.walletHash || !walletStore.isDeviceValid)"
            :to="{ name: 'select-receive-page' }"
          />
        </div>
      </div>
      <q-btn
        color="brandblue"
        flat
        :ripple="false"
        size="1.5rem"
        padding="sm lg"
        icon="settings"
        :to="{ name: 'settings' }"
      />
    </div>
  </footer>
</template>
<script>
import { useWalletStore } from 'src/stores/wallet';
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MainFooter',
  setup() {
    const walletStore = useWalletStore()
    
    return {
      walletStore,
    }
  },
})
</script>
<style scoped lang="scss">
.receive-page-btn-container {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -40%);
  border-radius:999px;
  padding: 2px;
  background-color: white;
}
body.body--dark .receive-page-btn-container {
  background: $dark;
}
.layout-footer {
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
  background-color: white;
}
body.body--dark .layout-footer {
  background-color: $dark;  
}
</style>
