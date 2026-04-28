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

        <div v-if="isMarketplaceUserLoggedIn" class="q-px-md q-mb-md">
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

        <div class="q-px-md q-mb-md">
          <template v-if="hasFullSalesReportAccess">
            <div class="section-title text-overline text-uppercase q-mb-sm">
              {{ $t("SalesLast24h") }}
            </div>
          </template>
          <div class="row q-col-gutter-sm">
            <template v-if="isRefreshing || isInitialLoading">
              <div class="col-12">
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
              <div class="col-12">
                <SalesReportCard
                  :featured="!hasFullSalesReportAccess"
                  :title="hasFullSalesReportAccess ? $t('SalesLast24h') : $t('SalesToday')"
                  :sales-report="salesToday24h"
                />
              </div>
            </template>
          </div>
        </div>

        <template v-if="hasFullSalesReportAccess">
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
        </template>

        <div class="q-px-md q-mb-md">
          <q-btn
            unelevated
            no-caps
            class="receive-payment-btn full-width"
            :class="{ 'receive-payment-btn--dark': $q.dark.isActive }"
            @click="showSetAmountDialog()"
          >
            <div class="receive-payment-btn__icon">
              <q-icon name="mdi-qrcode" size="28px" />
            </div>
            <div class="receive-payment-btn__content">
              <div class="receive-payment-btn__title">
                {{ $t("ReceivePayment") }}
              </div>
              <div class="receive-payment-btn__subtitle">
                {{ $t("CreatePaymentRequest") }}
              </div>
            </div>
            <q-icon
              name="mdi-arrow-right"
              size="22px"
              class="receive-payment-btn__arrow"
            />
          </q-btn>
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
                  <span v-if="!hasFullSalesReportAccess" class="text-caption text-grey">
                    ({{ $t("Last24Hours") }})
                  </span>
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
                  @click="() => fetchTransactions(filteredTransactions?.page || 1)"
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
                    v-if="filteredTransactions?.num_pages > 1"
                    :modelValue="filteredTransactions?.page"
                    :max="filteredTransactions?.num_pages || 0"
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
                  v-else-if="!filteredTransactions?.history?.length"
                  class="row items-center justify-center q-pa-md text-grey"
                >
                  <q-icon name="receipt_long" size="48px" class="q-mb-sm" />
                  <div class="full-width text-center">
                    {{ $t("NoTransactionsToDisplay") }}
                  </div>
                </div>
                <TransactionsList
                  v-else
                  :transactions="filteredTransactions"
                  class="transactions-list"
                  :class="filteredTransactions?.num_pages > 1 ? 'pagination' : ''"
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
import SetAmountFormDialog from "src/components/SetAmountFormDialog.vue";
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
import { useTransactionHelpers } from "src/composables/transaction";

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
    const { getTxDisplayFiat } = useTransactionHelpers();

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    const isMarketplaceUserLoggedIn = computed(() => {
      return marketplaceStore.user?.id > 0;
    });

    const hasFullSalesReportAccess = computed(() => {
      return marketplaceStore.userPermissions?.admin;
    });

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

    const filteredTransactions = computed(() => {
      if (hasFullSalesReportAccess.value) {
        return transactions.value;
      }

      const now = Date.now();
      const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;
      const todayHistory = (transactions.value.history || []).filter((tx) => {
        if (!tx?.tx_timestamp) return false;
        const txTime = new Date(tx.tx_timestamp).getTime();
        return txTime >= twentyFourHoursAgo;
      });

      const hasTransactions = todayHistory.length > 0;

      return {
        ...transactions.value,
        history: todayHistory,
        count: todayHistory.length,
        page: hasTransactions ? 1 : 0,
        num_pages: hasTransactions ? 1 : 0,
        has_next: false,
      };
    });

    const salesToday24h = computed(() => {
      const now = Date.now();
      const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;
      const txList = transactions.value?.history || [];

      const recentTxs = txList.filter((tx) => {
        if (tx.record_type !== 'incoming') return false;
        const txTime = new Date(tx.tx_timestamp || tx.date_created).getTime();
        return txTime >= twentyFourHoursAgo && txTime <= now;
      });

      if (!recentTxs.length) {
        return { total: 0, count: 0, tokenAmounts: [], totalMarketValue: null, currency: null };
      }

      let total = 0;
      const tokenAmountsMap = new Map();
      let totalMarketValue = 0;
      let currency = null;

      recentTxs.forEach((tx) => {
        if (tx.ft_category) {
          tokenAmountsMap.set(
            tx.ft_category,
            (tokenAmountsMap.get(tx.ft_category) || 0) + Number(tx.amount || 0)
          );
        } else if (!tx.nft_category) {
          total += Number(tx.amount || 0);
        }

        const fiat = getTxDisplayFiat(tx);
        if (fiat.value && !Number.isNaN(fiat.value)) {
          totalMarketValue += fiat.value;
          if (!currency) currency = fiat.currency;
        }
      });

      const tokenAmounts = [];
      for (const [category, amount] of tokenAmountsMap.entries()) {
        tokenAmounts.push({ category, amount });
      }

      return {
        total: Number(total.toFixed(8)),
        count: recentTxs.length,
        tokenAmounts,
        totalMarketValue: Number.isFinite(totalMarketValue) ? Number(totalMarketValue.toFixed(5)) : null,
        currency,
      };
    });
    function fetchTransactions(page = 1) {
      if (!walletStore.walletHash) return Promise.resolve();
      if (!walletStore.walletObj) return Promise.resolve();
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
    watch(
      () => hasFullSalesReportAccess.value,
      (newVal) => {
        if (newVal && !transactions.value.history?.length) {
          fetchTransactions();
        }
      }
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
      () => walletStore.deviceInfo?.linkedDevice?.unlinkRequest?.id,
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

    function showSetAmountDialog() {
      $q.dialog({
        component: SetAmountFormDialog,
        componentProps: {
          currencies: ["BCH"],
        },
      }).onOk((data) => {
        const amount = data?.amount;
        if (!amount) return;

        const query = {};
        if (amount.fiatAmount && amount.fiatCurrency) {
          query.amount = amount.fiatAmount;
          query.currency = amount.fiatCurrency;
        } else {
          query.amount = amount.value;
          query.currency = amount.currency || "BCH";
        }
        if (amount.tokenCategory) {
          query.tokenCategory = amount.tokenCategory;
        }
        if (amount.priceId) {
          query.priceId = amount.priceId;
        }

        $router.push({ name: "receive-page", query });
      });
    }

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
      hasFullSalesReportAccess,
      isMarketplaceUserLoggedIn,
      showSetAmountDialog,
      filteredTransactions,
      salesToday24h,
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

.receive-payment-btn {
  min-height: 72px;
  border-radius: 999px;
  background: $brandblue;
  color: white;
  padding: 0.25rem 0.5rem;
  box-shadow: 0 8px 18px rgba(2, 123, 227, 0.2);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(2, 123, 227, 0.24);
    filter: brightness(1.02);
  }

  &:active {
    transform: translateY(0);
  }
}

.receive-payment-btn :deep(.q-btn__content) {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.9rem;
  padding: 0 0.6rem;
}

.receive-payment-btn__icon {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.receive-payment-btn__content {
  min-width: 0;
  flex: 1;
  text-align: left;
}

.receive-payment-btn__title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.receive-payment-btn__subtitle {
  margin-top: 0.12rem;
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.78);
}

.receive-payment-btn__arrow {
  opacity: 0.85;
  flex-shrink: 0;
}

.receive-payment-btn--dark {
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.35);
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
