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
      <div v-if="walletStore.walletHash">
        <div class="receive-page-btn-container shadow-20">
          <q-btn
            flat
            style="border: 1px solid rgb(68, 68, 83);"
            color="brandblue"
            round
            padding="md"
            size="1.75rem"
            icon="qr_code"
            :disable="(!$pinia.state.value.wallet?.walletHash || !walletStore.isDeviceValid)"
            @click="promptAmount"
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
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { defineComponent, computed } from 'vue'

import SetAmountFormDialog from 'src/components/SetAmountFormDialog.vue'


export default defineComponent({
  name: 'MainFooter',
  setup() {
    const walletStore = useWalletStore()
    const $q = useQuasar()
    const $router = useRouter()

    const selectedCurrency = computed(() => walletStore.preferences.selectedCurrency)

    function promptAmount () {
      $q.dialog({
        component: SetAmountFormDialog,
        componentProps: {
          currencies: ['BCH'],
          initialValue: { currency: selectedCurrency.value }
        },
      }).onOk(data => {
        const amount = data?.amount

        if (!amount?.value) return

        const name = 'receive-page'
        const query = {
          setAmount: amount?.value || undefined,
          setCurrency: amount?.currency || undefined,
          lockAmount: true,
          resetQr: data?.resetQr,
        }
        $router.push({ name, query })
      })
    }
    
    return {
      walletStore,
      promptAmount,
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
