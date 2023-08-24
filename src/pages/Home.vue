<template>
  <q-page class="flex flex-center q-pb-lg">
    <WalletLink
      ref="walletLinkComponent"
      v-if="forceDisplayWalletLink || !walletStore.walletHash"
      :display-link-button="forceDisplayWalletLink"
      @device-linked="() => forceDisplayWalletLink = false"
    />
    <div v-else class="home-main-content q-py-md full-width">
      <div class="text-h5 text-brandblue q-mx-md q-px-sm q-mb-md">
        <div class="ellipsis">{{ walletStore.merchantInfo?.name || 'Paytaca POS' }}</div>
        <div
          v-if="walletStore.deviceInfo?.name"
          class="text-subtitle1 ellipsis"
          :class="$q.dark.isActive ? 'text-grey-5' : 'text-grey-7' "
          style="margin-top:-0.4em;"
        >
          {{ walletStore.deviceInfo?.name }}
        </div>
      </div>
      <div class="q-px-md row q-gutter-sm">
        <SalesReportCard title="Today" :sales-report="walletStore.salesReportSummary.today" class="col-5"/>
        <SalesReportCard title="Yesterday" :sales-report="walletStore.salesReportSummary.yesterday" class="col-5"/>
        <SalesReportCard title="Last 7 days" :sales-report="walletStore.salesReportSummary.last7Days" class="col-5"/>
        <SalesReportCard title="This month" :sales-report="walletStore.salesReportSummary.lastMonth" class="col-5"/>
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
          <TransactionsList :transactions="transactions" class="home-transactions-list" :class="(transactions?.num_pages > 1 ? 'pagination': '')"/>
        </q-card-section>
      </q-card>
    </div>
    <MainFooter/>
  </q-page>
</template>

<script>
import { useWalletStore } from 'stores/wallet'
import { defineAsyncComponent } from 'vue'
import { defineComponent, markRaw, nextTick, onMounted, ref, watch } from 'vue'
import MainFooter from 'src/components/MainFooter.vue'
import { paymentUriHasMatch, findMatchingPaymentLink } from 'src/wallet/utils'
import { useTxCacheStore } from 'src/stores/tx-cache'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

// import historyData from 'src/wallet/mockers/history.json'

export default defineComponent({
  name: 'HomePage',
  components: {
    SalesReportCard: defineAsyncComponent(() => import('src/components/SalesReportCard.vue')),
    TransactionsList: defineAsyncComponent(() => import('src/components/TransactionsList.vue')),
    WalletLink: defineAsyncComponent(() => import('src/components/WalletLink.vue')),
    MainFooter,
  },
  props: {
    walletLinkUrl: String,
  },
  setup (props) {
    const $q = useQuasar()
    const $router = useRouter()
    const walletStore = useWalletStore()
    const txCacheStore = useTxCacheStore()

    onMounted(() => fetchTransactions())
    onMounted(() => walletStore.refetchSalesReport())
    onMounted(() => walletStore.refetchMerchantInfo())
    onMounted(() => walletStore.refetchDeviceInfo())
    onMounted(() => walletStore.refetchPreferences())
    watch(() => [walletStore.walletHash], () => walletStore.refetchMerchantInfo())
    watch(() => [walletStore.walletHash, walletStore.posId], () => walletStore.refetchDeviceInfo())
    watch(() => [walletStore.walletHash], () => walletStore.refetchPreferences())

    const transactions = ref({ history: [] })
    const fetchingTransactions = ref(false)
    function fetchTransactions(page=1) {
      if (!walletStore.walletHash) return
      const opts = {
        page: Number.isInteger(page) ? page : 1,
        type: 'incoming',
      }

      fetchingTransactions.value = true
      walletStore.walletObj.getTransactions(opts)
        .then(response => {
          if (response.success) transactions.value = response.transactions
          transactions.value.page = Number(transactions.value.page)
          searchUnconfirmedPaymentsTransaction()
        })
        .finally(() => {
          fetchingTransactions.value = false
        })
    }
    watch(() => [walletStore.walletHash, walletStore.posId], () => fetchTransactions())

    async function searchUnconfirmedPaymentsTransaction() {
      txCacheStore.unconfirmedTxsFromQrData.forEach(async (qrData) => {
          let hasMatch = false

          if (Array.isArray(transactions.value?.history)) {
            hasMatch = paymentUriHasMatch(qrData, transactions.value.history)
          }

          // search for payment in cached transactions if not found in transactions
          if (!hasMatch) {
            for (const pageKey in txCacheStore.pages) {
              const page = txCacheStore.getPage(pageKey)
              if (!Array.isArray(page?.history)) continue
              hasMatch = paymentUriHasMatch(qrData, page.history, { checkAmount: true })
              if (hasMatch) break
            }
          }

          // last check is checking from bitdb
          if (!hasMatch) {
            const matchingTxs = await findMatchingPaymentLink(qrData, { checkAmount: true })
            hasMatch = Boolean(matchingTxs?.length)
          }

          if (hasMatch) txCacheStore.removeQrDataFromUnconfirmedPayments(qrData)
        })
    }

    const forceDisplayWalletLink = ref(false)
    onMounted(() => {
      if (walletStore.isLinked && !walletStore.isDeviceValid) $q.dialog({
        title: 'Invalid device',
        message: 'Linked device does not match',
        persistent: true,
        ok: false,
        cancel: {
          noCaps: true,
          flat: true,
          color:'red',
          label: 'Link another wallet',
        },
      })
        .onCancel(() => {
          forceDisplayWalletLink.value = true
        })
    })

    watch(() => walletStore.deviceInfo.linkedDevice.unlinkRequest.id, () => promptUnlinkRequest())
    onMounted(() => promptUnlinkRequest())

    function promptUnlinkRequest() {
      if (!walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.id) return
      $q.dialog({
        title: 'Unlink device request',
        message: 'Merchant requested to unlink device',
        persistent: walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.force,
        ok: {
          noCaps: true,
          color: 'red',
          label: 'Confirm unlink',
          flat: true,
        },
        cancel: !walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.force ? {
          flat: true,
          color: 'grey',
          noCaps: true,
        } : false,
      })
        .onOk(() => walletStore.confirmUnlinkRequest().then(() => walletStore.clearAll()))
        .onCancel(() => {
          if (!walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.force) return
          walletStore.cancelUnlinkRequest().then(() => walletStore.refetchDeviceInfo())
        })
    }

    const walletLinkComponent = ref()
    // onMounted(() => linkWalletFromUrl())
    watch(() => [props.walletLinkUrl], linkWalletFromUrl())
    async function linkWalletFromUrl() {
      if (!props.walletLinkUrl) return
      if (walletStore.walletHash && walletStore.isDeviceValid) return

      forceDisplayWalletLink.value = true
      await nextTick()
      walletLinkComponent.value.linkToWallet(props.walletLinkUrl)
      $router.replace({ query: {} }) 
    }

    window.t = walletLinkComponent
    return {
      walletStore,
      transactions,
      fetchingTransactions,
      fetchTransactions,
      forceDisplayWalletLink,
      walletLinkComponent,
    }
  }
})
</script>
<style scoped>
.home-main-content {
  overflow: auto;
  /* max-height:100%; */
  padding-bottom: 50px;
  /* padding-top: 20px; */
}

.home-transactions-list-container {
  position: relative;
  bottom: 0;
  max-height:100%;
}
.home-transactions-list {
  height: 35vh;
  overflow-y: auto;
}
.home-transactions-list.pagination {
  height: 31vh;
}
</style>
