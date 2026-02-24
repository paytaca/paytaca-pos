<template>
  <q-card class="sales-card q-pa-md column full-height">
    <div class="row items-center">
      <q-avatar
        :color="avatarColor"
        text-color="white"
        size="32px"
        class="q-mr-sm"
      >
        <q-icon :name="icon" size="18px" />
      </q-avatar>
      <div class="text-subtitle1 text-weight-medium">{{ title }}</div>
      <q-space />
      <q-badge :label="salesReport.count" color="primary" class="q-ml-xs" />
    </div>
    <div class="column justify-center q-space q-mt-md">
      <div class="text-h6">
        {{ formatNumberAutoDecimals(salesReport.total) }} BCH
      </div>
      <div
        v-if="salesReport?.tokenAmounts?.length"
        class="text-caption text-grey q-mt-xs"
      >
        + {{ salesReport?.tokenAmounts?.length }}
        {{
          salesReport?.tokenAmounts?.length === 1 ? $t("Token") : $t("Tokens")
        }}
      </div>
      <div
        v-if="salesReport.currency && salesReport.totalMarketValue"
        class="text-caption text-grey"
        style="margin-top: -0.25em"
      >
        {{ formatNumberAutoDecimals(salesReport.totalMarketValue) }}
        {{ salesReport.currency }}
      </div>
    </div>
    <q-menu v-if="salesReport?.tokenAmounts?.length" class="q-pa-md">
      <div
        v-for="amountData in salesReport?.tokenAmounts"
        :key="amountData?.category"
        class="row items-center justify-between no-wrap q-gutter-sm"
      >
        <div>{{ formatTokenAmount(amountData) }}</div>
        <div>
          <q-btn
            flat
            icon="content_copy"
            padding="sm"
            size="sm"
            @click="() => copyToClipboard(amountData?.category)"
          />
        </div>
      </div>
    </q-menu>
  </q-card>
</template>

<script>
import { useCashtokenStore } from "src/stores/cashtoken";
import { useQuasar } from "quasar";
import { defineComponent, inject, computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatNumberAutoDecimals } from "src/utils/number-format";

export default defineComponent({
  name: "SalesReportCard",
  props: {
    title: String,
    salesReport: {
      type: Object,
      default: () => ({
        total: 0,
        tokenAmounts: [].map(() => {
          return { category: "", amount: 0 };
        }),
        totalMarketValue: 0,
        currency: 0,
        count: 0,
      }),
    },
  },
  setup(props) {
    const $q = useQuasar();
    const { t: $t } = useI18n();
    const cashtokenStore = useCashtokenStore();

    const iconMap = {
      Today: "today",
      Yesterday: "event",
      Last7Days: "date_range",
      LastSevenDays: "date_range",
      ThisMonth: "calendar_month",
    };

    const colorMap = {
      Today: "brandblue",
      Yesterday: "primary",
      Last7Days: "secondary",
      LastSevenDays: "secondary",
      ThisMonth: "accent",
    };

    const icon = computed(() => iconMap[props.title] || "analytics");
    const avatarColor = computed(() => colorMap[props.title] || "brandblue");

    function formatTokenAmount(amountData) {
      const tokenMetadata = cashtokenStore.getTokenMetadata(
        amountData?.category
      );
      if (!tokenMetadata) return `${amountData.amount} ${$t("Token")}`;

      const decimals = parseInt(tokenMetadata?.decimals) || 0;
      const symbol = tokenMetadata?.symbol;
      const amount = amountData.amount / 10 ** decimals;
      return `${formatNumberAutoDecimals(amount)} ${symbol}`;
    }

    const $copyText = inject("$copyText");
    function copyToClipboard(value, message = "") {
      $copyText(value)
        .then(() => {
          $q.notify({
            message: message || $t("CopiedToClipboard"),
            timeout: 800,
            icon: "mdi-clipboard-check",
            color: "blue-9",
          });
        })
        .catch(() => {});
    }

    return {
      formatTokenAmount,
      copyToClipboard,
      formatNumberAutoDecimals,
      icon,
      avatarColor,
    };
  },
});
</script>

<style lang="scss" scoped>
.sales-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease, transform 0.2s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }
}

.body--dark {
  .sales-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}
</style>
