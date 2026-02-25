<template>
  <q-page class="home-page q-pb-lg">
    <q-pull-to-refresh
      @refresh="refreshPage"
      :disable="forceDisplayWalletLink || !walletStore.walletHash"
    >
      <WalletLink
        ref="walletLinkComponent"
        v-if="forceDisplayWalletLink || !walletStore.walletHash"
        :display-link-button="forceDisplayWalletLink"
        @device-linked="() => (forceDisplayWalletLink = false)"
      />
      <div v-else class="home-main-content q-py-md full-width">
        <div class="q-px-md q-mb-md">
          <template v-if="isRefreshing || isInitialLoading">
            <q-card
              class="profile-card q-pa-md"
              :class="{ 'bg-dark': $q.dark.isActive }"
            >
              <div class="row items-center q-gutter-md">
                <q-skeleton type="QAvatar" size="56px" />
                <div class="col">
                  <q-skeleton type="text" width="180px" />
                  <q-skeleton type="text" width="140px" class="q-mt-xs" />
                </div>
              </div>
            </q-card>
          </template>
          <template v-else>
            <q-card
              class="profile-card"
              :class="{ 'bg-dark': $q.dark.isActive }"
            >
              <q-card-section class="q-pa-md">
                <div class="row items-center q-gutter-md">
                  <q-avatar
                    size="56px"
                    color="brandblue"
                    text-color="white"
                    class="profile-avatar"
                  >
                    <q-icon name="store" size="28px" />
                  </q-avatar>
                  <div class="col">
                    <div class="text-h6 text-weight-medium ellipsis">
                      {{ walletStore.merchantInfo?.name || "Paytaca POS" }}
                    </div>
                    <div
                      v-if="walletStore.deviceInfo?.name"
                      class="text-subtitle2 text-grey-7 q-mt-xs ellipsis"
                    >
                      <q-icon name="devices" size="16px" class="q-mr-xs" />
                      {{ walletStore.deviceInfo?.name }}
                    </div>
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </template>
        </div>

        <div class="q-px-md q-mb-md">
          <div class="section-title text-overline text-uppercase q-mb-sm">
            {{ $t("SalesReport") }}
          </div>
          <div class="row q-col-gutter-sm">
            <template v-if="isRefreshing || isInitialLoading">
              <div v-for="n in 4" :key="n" class="col-6">
                <q-card class="sales-card q-pa-md column full-height">
                  <q-skeleton type="text" width="60px" />
                  <div class="column justify-center q-space q-mt-sm">
                    <q-skeleton type="text" width="80px" />
                    <q-skeleton type="text" width="100px" class="q-mt-xs" />
                  </div>
                </q-card>
              </div>
            </template>
            <template v-else>
              <div class="col-6">
                <SalesReportCard
                  :title="$t('Today')"
                  :sales-report="walletStore.salesReportSummary.today"
                />
              </div>
              <div class="col-6">
                <SalesReportCard
                  :title="$t('Yesterday')"
                  :sales-report="walletStore.salesReportSummary.yesterday"
                />
              </div>
              <div class="col-6">
                <SalesReportCard
                  :title="$t('LastSevenDays')"
                  :sales-report="walletStore.salesReportSummary.last7Days"
                />
              </div>
              <div class="col-6">
                <SalesReportCard
                  :title="$t('ThisMonth')"
                  :sales-report="walletStore.salesReportSummary.lastMonth"
                />
              </div>
            </template>
          </div>
        </div>

        <div class="q-px-md q-mb-md">
          <template v-if="isRefreshing || isInitialLoading">
            <q-card
              class="marketplace-card"
              :class="{ 'bg-dark': $q.dark.isActive }"
            >
              <q-card-section class="q-py-sm">
                <div class="row items-center">
                  <div class="text-h6 q-space">
                    <q-skeleton type="text" width="100px" />
                  </div>
                  <q-skeleton type="rect" width="100px" height="30px" />
                </div>
                <div class="row items-start q-r-mx-md q-mt-sm">
                  <div v-for="n in 2" :key="n" class="col-6 col-sm-3 q-pa-sm">
                    <q-skeleton type="rect" width="100%" height="80px" />
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </template>
          <template v-else>
            <MarketplaceWidget />
          </template>
        </div>

        <div class="q-px-md">
          <q-card
            class="transactions-card"
            :class="{ 'bg-dark': $q.dark.isActive }"
          >
            <q-card-section class="q-pb-sm">
              <div class="row items-center">
                <div class="text-h6 text-weight-medium">
                  {{ $t("Transactions") }}
                </div>
                <q-space />
                <q-btn
                  v-if="transactions?.history?.length"
                  flat
                  round
                  dense
                  icon="refresh"
                  size="sm"
                  :loading="fetchingTransactions"
                  @click="() => fetchTransactions(transactions?.page || 1)"
                >
                  <q-tooltip>{{ $t("Refresh") }}</q-tooltip>
                </q-btn>
              </div>
            </q-card-section>
            <q-card-section class="q-pt-none">
              <template v-if="isRefreshing || isInitialLoading">
                <div class="row items-center justify-end q-mb-sm">
                  <q-skeleton type="rect" width="200px" height="32px" />
                </div>
                <div class="transactions-list">
                  <q-list>
                    <q-item v-for="n in 5" :key="n" class="q-pa-sm">
                      <q-item-section side>
                        <q-skeleton type="circle" size="40px" />
                      </q-item-section>
                      <q-item-section>
                        <q-skeleton type="text" width="60%" />
                        <q-skeleton type="text" width="40%" class="q-mt-xs" />
                      </q-item-section>
                      <q-item-section side>
                        <q-skeleton type="text" width="80px" />
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </template>
              <template v-else>
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
                    @update:modelValue="(val) => fetchTransactions(val)"
                  />
                </div>
                <div
                  v-if="fetchingTransactions"
                  class="row items-center justify-center q-px-xs"
                >
                  <q-linear-progress query color="brandblue" />
                </div>
                <div
                  v-else-if="!transactions?.history?.length"
                  class="row items-center justify-center q-pa-md text-grey"
                >
                  <q-icon name="receipt_long" size="48px" class="q-mb-sm" />
                  <div class="full-width text-center">
                    {{ $t("NoTransactionsToDisplay") }}
                  </div>
                </div>
                <TransactionsList
                  v-else
                  :transactions="transactions"
                  class="transactions-list"
                  :class="transactions?.num_pages > 1 ? 'pagination' : ''"
                />
              </template>
            </q-card-section>
          </q-card>
        </div>
      </div>
      <MainFooter />
    </q-pull-to-refresh>
  </q-page>
</template>

<script>
import { useWalletStore } from "stores/wallet";
import { useMarketplaceStore } from "src/stores/marketplace";
import { defineAsyncComponent } from "vue";
import {
  defineComponent,
  markRaw,
  nextTick,
  onMounted,
  ref,
  watch,
  computed,
} from "vue";
import MainFooter from "src/components/MainFooter.vue";
import MarketplaceWidget from "src/components/marketplace/MarketplaceWidget.vue";
import {
  paymentUriHasMatch,
  findMatchingPaymentLink,
  asyncSleep,
} from "src/wallet/utils";
import { useTxCacheStore } from "src/stores/tx-cache";
import { useCashtokenStore } from "src/stores/cashtoken";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

export default defineComponent({
  name: "HomePage",
  components: {
    SalesReportCard: defineAsyncComponent(() =>
      import("src/components/SalesReportCard.vue")
    ),
    TransactionsList: defineAsyncComponent(() =>
      import("src/components/TransactionsList.vue")
    ),
    WalletLink: defineAsyncComponent(() =>
      import("src/components/WalletLink.vue")
    ),
    MarketplaceWidget,
    MainFooter,
  },
  props: {
    walletLinkUrl: String,
  },
  setup(props) {
    const $q = useQuasar();
    const $router = useRouter();
    const walletStore = useWalletStore();
    const marketplaceStore = useMarketplaceStore();
    const txCacheStore = useTxCacheStore();
    const cashtokenStore = useCashtokenStore();
    const { t } = useI18n();

    onMounted(async () => {
      if (!walletStore.walletHash) {
        isInitialLoading.value = false;
        return;
      }

      const initialLoadPromises = [
        fetchTransactions(),
        walletStore
          .refetchSalesReport()
          .then(() => walletStore.refetchSalesReportTokenMetadata()),
        walletStore.refetchDeviceInfo(),
        walletStore.refetchPreferences(),
        walletStore.fetchAcceptedTokens(),
      ];

      await Promise.allSettled(initialLoadPromises);
      isInitialLoading.value = false;
    });
    watch(
      () => [walletStore.walletHash, walletStore.posId],
      () => walletStore.refetchDeviceInfo()
    );
    watch(
      () => [walletStore.walletHash],
      () => walletStore.refetchPreferences()
    );

    const transactions = ref({ history: [] });
    const fetchingTransactions = ref(false);
    const isRefreshing = ref(false);
    const isInitialLoading = ref(true);
    function fetchTransactions(page = 1) {
      if (!walletStore.walletHash) return Promise.resolve();
      const opts = {
        page: Number.isInteger(page) ? page : 1,
        type: "incoming",
      };

      fetchingTransactions.value = true;
      return walletStore.walletObj
        .getTransactions(opts)
        .then(async (response) => {
          if (response.success) {
            await fetchCashtokenMetadata(response.transactions?.history).catch(
              console.error
            );
            transactions.value = response.transactions;
          }
          transactions.value.page = Number(transactions.value.page);
          searchUnconfirmedPaymentsTransaction();
        })
        .finally(() => {
          fetchingTransactions.value = false;
        });
    }
    watch(
      () => [walletStore.walletHash, walletStore.posId],
      () => fetchTransactions()
    );

    async function searchUnconfirmedPaymentsTransaction() {
      txCacheStore.unconfirmedTxsFromQrData.forEach(async (qrData) => {
        let hasMatch = false;

        if (Array.isArray(transactions.value?.history)) {
          hasMatch = paymentUriHasMatch(qrData, transactions.value.history);
        }

        if (!hasMatch) {
          for (const pageKey in txCacheStore.pages) {
            const page = txCacheStore.getPage(pageKey);
            if (!Array.isArray(page?.history)) continue;
            hasMatch = paymentUriHasMatch(qrData, page.history, {
              checkAmount: true,
            });
            if (hasMatch) break;
          }
        }

        if (!hasMatch) {
          const matchingTxs = await findMatchingPaymentLink(qrData, {
            checkAmount: true,
          });
          hasMatch = Boolean(matchingTxs?.length);
        }

        if (hasMatch) txCacheStore.removeQrDataFromUnconfirmedPayments(qrData);
      });
    }

    function fetchCashtokenMetadata(transactions = []) {
      const tokenCategories = transactions
        .map((tx) => [tx?.ft_category, tx?.nft_category])
        .flatMap((category) => category)
        .filter(Boolean)
        .filter((category, index, self) => self.indexOf(category) === index);

      const tokenMetadatafetch = tokenCategories.map((category) => {
        if (cashtokenStore.getTokenMetadata(category)) return Promise.resolve();
        return cashtokenStore.fetchTokenMetadata(category);
      });
      return Promise.race([
        Promise.allSettled(tokenMetadatafetch),
        asyncSleep(5000),
      ]);
    }

    const forceDisplayWalletLink = ref(false);
    onMounted(() => {
      if (walletStore.isLinked && !walletStore.isDeviceValid)
        $q.dialog({
          title: t("InvalidDevice"),
          message: t("InvalidDeviceMsg"),
          persistent: true,
          ok: false,
          cancel: {
            noCaps: true,
            flat: true,
            color: "red",
            label: t("InvalidDeviceLabel"),
          },
        }).onCancel(() => {
          forceDisplayWalletLink.value = true;
        });
    });

    watch(
      () => walletStore.deviceInfo.linkedDevice.unlinkRequest.id,
      () => promptUnlinkRequest()
    );
    onMounted(() => promptUnlinkRequest());

    function promptUnlinkRequest() {
      if (!walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.id) return;
      $q.dialog({
        title: t("UnlinkDeviceTitle"),
        message: t("UnlinkDeviceMsg"),
        persistent: walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.force,
        ok: {
          noCaps: true,
          color: "red",
          label: t("UnlinkDeviceOkMsg"),
          flat: true,
        },
        cancel: !walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.force
          ? {
              flat: true,
              color: "grey",
              noCaps: true,
            }
          : false,
      })
        .onOk(() =>
          walletStore.confirmUnlinkRequest().then(() => walletStore.clearAll())
        )
        .onCancel(() => {
          if (!walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.force)
            return;
          walletStore
            .cancelUnlinkRequest()
            .then(() => walletStore.refetchDeviceInfo());
        });
    }

    const walletLinkComponent = ref();
    watch(
      () => [props.walletLinkUrl],
      () => linkWalletFromUrl()
    );
    async function linkWalletFromUrl() {
      if (!props.walletLinkUrl) return;
      if (walletStore.walletHash && walletStore.isDeviceValid) return;

      forceDisplayWalletLink.value = true;
      await nextTick();
      walletLinkComponent.value.linkToWallet(props.walletLinkUrl);
      $router.replace({ query: {} });
    }

    async function refreshPage(done) {
      isRefreshing.value = true;
      try {
        await Promise.allSettled([
          fetchTransactions(transactions.value?.page || 1),
          walletStore
            .refetchSalesReport()
            .then(() => walletStore.refetchSalesReportTokenMetadata()),
          walletStore.refetchDeviceInfo(),
          walletStore.refetchPreferences(),
          walletStore.fetchAcceptedTokens(),
          marketplaceStore.refreshUser({ silent: true }).catch(() => {}),
          marketplaceStore
            .updateActiveShopId({ silent: true, getOnly: true })
            .catch(() => {}),
        ]);
      } catch (error) {
        console.error("Error refreshing page:", error);
      } finally {
        isRefreshing.value = false;
        done();
      }
    }

    window.t = walletLinkComponent;
    return {
      walletStore,
      transactions,
      fetchingTransactions,
      fetchTransactions,
      forceDisplayWalletLink,
      walletLinkComponent,
      refreshPage,
      isRefreshing,
      isInitialLoading,
    };
  },
});
</script>

<style lang="scss" scoped>
.home-main-content {
  overflow: auto;
  padding-bottom: 80px;
}

.section-title {
  letter-spacing: 1px;
  font-weight: 500;
  color: var(--q-primary);
}

.profile-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.profile-avatar {
  background: linear-gradient(135deg, $brandblue 0%, $primary 100%);
}

.sales-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
}

.marketplace-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.transactions-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.transactions-list {
  max-height: 35vh;
  min-height: 200px;
  overflow-y: auto;
}

.transactions-list.pagination {
  max-height: 31vh;
}

.home-page {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
}

.body--dark {
  .profile-card,
  .sales-card,
  .marketplace-card,
  .transactions-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}
</style>
