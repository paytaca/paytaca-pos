<template>
  <q-page class="flex flex-center q-pb-lg">
    <WalletLink
      ref="walletLinkComponent"
      v-if="forceDisplayWalletLink || !walletStore.walletHash"
      :display-link-button="forceDisplayWalletLink"
      @device-linked="() => forceDisplayWalletLink = false"
    />
    <div v-else class="home-main-content q-py-md full-width" :style="$q.platform.is.ios ? 'padding-top:3.8em;' : ''">
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
        <SalesReportCard :title="$t('Today')" :sales-report="walletStore.salesReportSummary.today" class="col-5"/>
        <SalesReportCard :title="$t('Yesterday')" :sales-report="walletStore.salesReportSummary.yesterday" class="col-5"/>
        <SalesReportCard :title="$t('LastSevenDays')" :sales-report="walletStore.salesReportSummary.last7Days" class="col-5"/>
        <SalesReportCard :title="$t('ThisMonth')" :sales-report="walletStore.salesReportSummary.lastMonth" class="col-5"/>
      </div>

      <MarketplaceWidget class="q-mx-md q-mt-md"/>

      <q-card class="q-mx-md q-mt-md home-transactions-list-container" style="border-radius:25px;">
        <q-card-section class="text-h6">
          {{ $t('Transactions') }}
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
          <TransactionsList
            :transactions="transactions"
            class="home-transactions-list"
            :class="(transactions?.num_pages > 1 ? 'pagination': '')"
          />
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
import MarketplaceWidget from 'src/components/marketplace/MarketplaceWidget.vue'
import { paymentUriHasMatch, findMatchingPaymentLink, asyncSleep } from 'src/wallet/utils'
import { useTxCacheStore } from 'src/stores/tx-cache'
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'


// import historyData from 'src/wallet/mockers/history.json'

export default defineComponent({
  name: 'HomePage',
  components: {
    SalesReportCard: defineAsyncComponent(() => import('src/components/SalesReportCard.vue')),
    TransactionsList: defineAsyncComponent(() => import('src/components/TransactionsList.vue')),
    WalletLink: defineAsyncComponent(() => import('src/components/WalletLink.vue')),
    MarketplaceWidget,
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
    const cashtokenStore = useCashtokenStore()
    const { t } = useI18n()

    onMounted(() => fetchTransactions())
    onMounted(() => walletStore.refetchSalesReport())
    // onMounted(() => walletStore.refetchMerchantInfo())
    onMounted(() => walletStore.refetchDeviceInfo())
    onMounted(() => walletStore.refetchPreferences())
    // watch(() => [walletStore.walletHash], () => walletStore.refetchMerchantInfo())
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
        .then(async response => {
          if (response.success) {
            await fetchCashtokenMetadata(response.transactions?.history).catch(console.error)
            transactions.value = response.transactions
          }
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

    function fetchCashtokenMetadata(transactions=[]) {
      const tokenCategories = transactions
        .map(tx => [tx?.ft_category, tx?.nft_category])
        .flatMap(category => category)
        .filter(Boolean)
        .filter((category, index, self) => self.indexOf(category) === index)

      const tokenMetadatafetch = tokenCategories.map(category => {
        if (cashtokenStore.getTokenMetadata(category)) return Promise.resolve()
        return cashtokenStore.fetchTokenMetadata(category)
      })
      return Promise.race([Promise.allSettled(tokenMetadatafetch), asyncSleep(5000)]);
    }

    const forceDisplayWalletLink = ref(false)
    onMounted(() => {
      if (walletStore.isLinked && !walletStore.isDeviceValid) $q.dialog({
        title: t('InvalidDevice'),
        message: t('InvalidDeviceMsg'),
        persistent: true,
        ok: false,
        cancel: {
          noCaps: true,
          flat: true,
          color:'red',
          label: t('InvalidDeviceLabel'),
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
        title: t('UnlinkDeviceTitle'),
        message: t('UnlinkDeviceMsg'),
        persistent: walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.force,
        ok: {
          noCaps: true,
          color: 'red',
          label: t('UnlinkDeviceOkMsg'),
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
    watch(() => [props.walletLinkUrl], () => linkWalletFromUrl())
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
  padding-bottom: 50px;
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
