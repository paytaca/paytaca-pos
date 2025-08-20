<template>  
  <footer
    elevated
    reveal
    class="layout-footer q-footer fixed-bottom shadow-up-1"
  >
    <div class="row items-center justify-around" :style="$q.platform.is.ios ? 'padding-bottom: 15px;' : ''">
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
import { useMarketplaceStore } from 'src/stores/marketplace';
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { defineComponent, computed, onMounted } from 'vue'

import SetAmountFormDialog from 'src/components/SetAmountFormDialog.vue'
import { Wallet } from 'src/wallet'


export default defineComponent({
  name: 'MainFooter',
  setup() {
    const walletStore = useWalletStore()
    const marketplaceStore = useMarketplaceStore();
    const $q = useQuasar()
    const $router = useRouter()

    const selectedCurrency = computed(() => walletStore.preferences.selectedCurrency)

    async function generateFirstReceivingAddress () {
      const wallet = new Wallet({
        xPubKey: walletStore.xPubKey,
        walletHash: walletStore.walletHash,
        posId: walletStore.posId,
      })
      const addressSet = await wallet.generateReceivingAddress(1, { skipSubscription: false })
      return addressSet.receiving
    }
    onMounted(async () => {
      const firstReceivingAddress = await generateFirstReceivingAddress()
      walletStore.$patch({ firstReceivingAddress })
    })

    function promptAmount () {
      const tokenCategories = [];
      const acceptedTokensData = marketplaceStore.acceptedTokensData?.accepted_tokens;
      if (Array.isArray(acceptedTokensData)) {
        tokenCategories.push(...acceptedTokensData.map(tokenData => tokenData?.category));
      }

      const musdTokenCategory = 'b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366'
      if (!tokenCategories.includes(musdTokenCategory)) {
        tokenCategories.unshift(musdTokenCategory);
      }

      $q.dialog({
        component: SetAmountFormDialog,
        componentProps: {
          currencies: ['BCH', ...tokenCategories],
          hideInvalidOptions: true,
          initialValue: { currency: selectedCurrency.value }
        },
      }).onOk(data => {
        const amount = data?.amount

        if (!amount?.value) return

        const name = 'receive-page'
        const query = {
          setAmount: amount?.value || undefined,
          setCurrency: amount?.currency || undefined,
          setTokenCategory: amount?.tokenCategory || undefined,
          lockAmount: true,
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
