<template>
  <q-page class="q-pb-lg">
    <MainHeader>
      <template #title>
        <q-toolbar-title class="q-ml-md q-pl-xl text-h5">
          Receive Payment
        </q-toolbar-title>
      </template>
    </MainHeader>
    <div class="q-mt-lg q-px-lg">
      <div class="text-subtitle1 q-mb-md">Select the wallet being used to pay</div>
      <q-card>
        <q-item
          class="select-item"
          clickable v-ripple
          @click="promptAmount('paytaca')"
        >
          <q-item-section avatar>
            <img src="~assets/paytaca_logo.png" height="50"/>
          </q-item-section>
          <q-item-section top class="q-py-sm">
            <q-item-label class="text-subtitle1">Paytaca</q-item-label>
            <q-item-label caption>Receive payments from Paytaca</q-item-label>
          </q-item-section>
        </q-item>
      </q-card>
      <q-card>
        <q-item
          class="select-item"
          clickable v-ripple
          @click="promptAmount('purelypeer')"
        >
          <q-item-section avatar>
            <img src="~assets/purelypeer-logo.png" height="50"/>
          </q-item-section>
          <q-item-section top class="q-py-sm">
            <q-item-label class="text-subtitle1">PurelyPeer</q-item-label>
            <q-item-label caption>Claim vouchers from PurelyPeer</q-item-label>
          </q-item-section>
        </q-item>
      </q-card>
      <q-card>
        <q-item
          class="select-item"
          :clickable="isOnline"
          :v-ripple="isOnline"
          :disable="!isOnline"
          @click="promptAmount('other')"
        >
          <q-item-section avatar>
            <img src="~assets/bch-logo.png" height="50"/>
          </q-item-section>
          <q-item-section top class="q-py-sm">
            <q-item-label class="text-subtitle1">Other BCH Wallets</q-item-label>
            <q-item-label caption>Receive payments from other BCH wallets</q-item-label>
          </q-item-section>
        </q-item>
      </q-card>
    </div>
    <MainFooter/>
  </q-page>
</template>
<script>
import MainFooter from 'src/components/MainFooter.vue'
import MainHeader from 'src/components/MainHeader.vue'
import { defineComponent, inject, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useWalletStore } from 'src/stores/wallet'
import SetAmountFormDialog from 'src/components/SetAmountFormDialog.vue'

export default defineComponent({
  components: {
    MainHeader,
    MainFooter,
  },
  setup() {
    const isOnline = inject('$isOnline')
    const $q = useQuasar()
    const $router = useRouter()
    const walletStore = useWalletStore()

    const selectedCurrency = computed(() => walletStore.preferences.selectedCurrency)

    /**
     * 
     * @param {'paytaca' | 'purelypeer' | 'other'} paymentFrom 
     */
    function promptAmount(paymentFrom) {
      let currencies = ['BCH']
      if (paymentFrom === 'paytaca') currencies = ['BCH', 'PHP']
      $q.dialog({
        component: SetAmountFormDialog,
        componentProps: {
          currencies: currencies,
          initialValue: { currency: selectedCurrency.value },
          isPurelyPeer: paymentFrom === 'purelypeer'
        },
      }).onOk(data => {
        const voucher = data?.voucher
        const amount = data?.amount

        if (!amount?.value && !voucher) return

        const name = 'receive-page'
        const query = {
          paymentFrom: paymentFrom,
          setAmount: amount?.value || undefined,
          setCurrency: amount?.currency || undefined,
          lockAmount: true,
          voucher,
        }
        $router.push({ name, query })
      })
    }

    return {
      isOnline,
      promptAmount,
    }
  },
})
</script>
<style scoped>
.select-item {
  /* border: 2px solid grey; */
  border-radius: 8px;
  margin-bottom: 16px;
}
</style>
