<template>
  <q-page class="flex flex-center">
    <WalletLink v-if="!walletStore.walletHash"/>
    <div v-else class="home-main-content q-py-md full-width">
      <div class="text-h4 text-brandblue q-mx-md q-px-sm q-mb-md">
        Paytaca POS
      </div>
      <div class="q-px-md">
        <q-btn
          :color="$q.dark.isActive ? 'dark' : 'white'"
          :text-color="$q.dark.isActive ? 'white' : 'black'"
          padding="sm"
          rounded
          class="full-width"
          :to="{ name: 'receive-page' }"
        >
          <div>
            <q-icon name="qr_code" size="5rem"/>
            <div class="text-caption">Receive Payment</div>
          </div>
        </q-btn>
      </div>

      <q-card class="q-mx-md q-mt-md home-transactions-list-container" style="border-radius:25px;">
        <q-card-section class="text-h6">
          Transactions
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div class="row items-center justify-end">
            <q-pagination
              v-if="transactions?.num_pages > 1"
              :modelValue="transactions?.page"
              :max="transactions?.num_pages || 0"
              :max-pages="7"
              input
              unelevated
              padding="xs sm"
              boundary-numbers
              @update:modelValue="val => fetchTransactions(val)"
            />
          </div>
          <div v-if="fetchingTransactions" class="row items-center justify-center q-px-xs">
            <q-linear-progress query color="brandblue"/>
          </div>
          <TransactionsList :transactions="transactions" class="home-transactions-list"/>
        </q-card-section>
      </q-card>
    </div>
    <MainFooter/>
  </q-page>
</template>

<script>
import { Wallet } from 'src/wallet'
import { useWalletStore } from 'stores/wallet'
import { defineComponent, markRaw, onMounted, ref, watch } from 'vue'
import TransactionsList from 'src/components/TransactionsList.vue'
import WalletLink from 'src/components/WalletLink.vue'
import MainFooter from 'src/components/MainFooter.vue'

// import historyData from 'src/wallet/mockers/history.json'

export default defineComponent({
  name: 'HomePage',
  components: {
    TransactionsList,
    WalletLink,
    MainFooter
},
  setup () {
    const walletStore = useWalletStore()

    const wallet = ref(null)
    onMounted(() => {
      wallet.value = markRaw(new Wallet({
        walletHash: walletStore.walletHash,
        xPubKey: walletStore.xPubKey,
        posId: walletStore.posId,
      }))
    })

    const transactions = ref({ history: [] })
    const fetchingTransactions = ref(false)
    function fetchTransactions(page=1) {
      const opts = {
        page: Number.isInteger(page) ? page : 1,
        type: 'all',
      }

      fetchingTransactions.value = true
      walletStore.walletObj.getTransactions(opts)
        .then(response => {
          if (response.success) transactions.value = response.transactions
          transactions.value.page = Number(transactions.value.page)
        })
        .finally(() => {
          fetchingTransactions.value = false
        })
    }
    onMounted(() => fetchTransactions())
    watch(() => [walletStore.walletHash, walletStore.posId], () => fetchTransactions())

    onMounted(() => {
      window.t = () => {
        fetchingTransactions.value = !fetchingTransactions.value
      }
    })
    return {
      walletStore,
      transactions,
      fetchingTransactions,
      fetchTransactions,
    }
  }
})
</script>
<style scoped>
.home-main-content {
  position: absolute;
  top: 1.5rem;
  overflow: auto;
  /* max-height:100%; */
}

.home-transactions-list-container {
  position: relative;
  bottom: 0;
  max-height:100%;
}
.home-transactions-list {
  height: 40vh;
  overflow-y: auto;
}
</style>
