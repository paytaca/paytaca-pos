<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card
      class="rounded-borders column no-wrap"
      style="width: 100%; max-width: 640px; max-height: 88vh;"
    >
      <div class="q-pa-md row items-start no-wrap">
        <div class="q-space">
          <div class="text-h6">
            {{ $t("DiscountForecast", {}, "Discount forecast") }}
          </div>
          <div class="text-caption text-grey">
            {{
              $t(
                "DiscountForecastSubtitle",
                {},
                "A preview of how this discount would have affected recent sales. Nothing is saved until you create it."
              )
            }}
          </div>
        </div>
        <q-btn flat round icon="close" padding="sm" v-close-popup />
      </div>

      <q-separator />

      <div class="col overflow-auto q-pa-md q-gutter-y-md">
        <div v-if="loading" class="text-center q-py-xl">
          <q-spinner color="brandblue" size="2.5rem" />
          <div class="text-subtitle1 q-mt-sm">
            {{ $t("GeneratingForecast", {}, "Generating forecast") }}
          </div>
          <div class="text-caption text-grey">
            {{
              $t(
                "GeneratingForecastHint",
                {},
                "Checking recent sales against this discount."
              )
            }}
          </div>
        </div>

        <div v-else-if="errorMessage" class="text-center q-py-lg">
          <q-icon name="warning_amber" color="amber-8" size="2.5rem" />
          <div class="text-subtitle1 q-mt-sm">
            {{ $t("ForecastUnavailable", {}, "Forecast unavailable") }}
          </div>
          <div class="text-body2 text-grey q-mt-xs">{{ errorMessage }}</div>
          <q-btn
            outline
            no-caps
            color="brandblue"
            class="q-mt-md"
            :label="$t('Retry', {}, 'Retry')"
            @click="fetchForecast"
          />
        </div>

        <template v-else-if="forecast">
          <div v-if="windowText" class="text-caption text-grey">
            {{ windowText }}
          </div>

          <q-banner
            v-if="warnings.length"
            class="forecast-warnings rounded-borders cursor-pointer"
            :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-amber-1'"
            role="button"
            tabindex="0"
            @click="toggleWarnings"
          >
            <div class="row items-start no-wrap">
              <q-icon
                name="info"
                size="md"
                :color="$q.dark.isActive ? 'amber-4' : 'amber-8'"
                class="q-mr-sm q-mt-xs"
              />
              <div class="col overflow-hidden q-pt-sm">
                <div style="float: right;">
                  <q-badge
                    v-if="warnings.length > 1"
                    :color="$q.dark.isActive ? 'amber-4' : 'amber-8'"
                    :text-color="$q.dark.isActive ? 'dark' : 'white'"
                    class="q-mr-xs"
                  >
                    {{ warnings.length }}
                  </q-badge>
                  <q-icon
                    name="expand_more"
                    class="forecast-warnings__chevron"
                    :class="{
                      'forecast-warnings__chevron--expanded': warningsExpanded,
                    }"
                    :color="$q.dark.isActive ? 'amber-4' : 'amber-8'"
                  />
                </div>
                <div
                  ref="warningsSummary"
                  class="forecast-warnings__summary"
                  :class="{
                    'forecast-warnings__summary--expanded': warningsExpanded,
                    'forecast-warnings__summary--collapsed':
                      !warningsExpanded && !warningsCollapsing,
                  }"
                  :style="{ height: warningsSummaryHeight }"
                  @transitionend="onWarningsTransitionEnd"
                >
                  <span
                    v-for="(warning, index) in warnings"
                    :key="index"
                    class="forecast-warnings__item"
                  >
                    {{ warning }}<br v-if="index < warnings.length - 1" />
                  </span>
                </div>
              </div>
            </div>
          </q-banner>

          <template v-if="hasMatches">
            <div
              v-for="(summary, index) in summaries"
              :key="summary.currency || index"
              class="q-gutter-y-sm"
            >
              <div class="text-subtitle2">
                {{ $t("MatchedSales", {}, "Matched sales") }}
                <span v-if="summary.currency" class="text-grey">
                  · {{ summary.currency }}
                </span>
              </div>

              <div class="row q-col-gutter-sm">
                <div class="col-6">
                  <div class="forecast-tile">
                    <div class="text-caption text-grey">
                      {{ $t("DiscountCost", {}, "Discount cost") }}
                    </div>
                    <div class="text-h6">
                      {{ formatMoney(summary.discount_total, summary.currency) }}
                    </div>
                    <div class="text-caption text-grey">
                      {{ matchedOrdersText(summary) }}
                    </div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="forecast-tile">
                    <div class="text-caption text-grey">
                      {{ $t("RevenueAfter", {}, "Revenue after") }}
                    </div>
                    <div class="text-h6">
                      {{ formatMoney(revenueAfter(summary), summary.currency) }}
                    </div>
                    <div class="text-caption text-grey">
                      {{
                        $t(
                          "WasAmount",
                          {
                            amount: formatMoney(
                              summary.revenue_before,
                              summary.currency
                            ),
                          },
                          "was {amount}"
                        )
                      }}
                    </div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="forecast-tile">
                    <div class="text-caption text-grey">
                      {{ $t("ProfitAfter", {}, "Profit after") }}
                    </div>
                    <div
                      class="text-h6"
                      :class="profitColor(summary.profit_after)"
                    >
                      {{ formatMoney(summary.profit_after, summary.currency) }}
                    </div>
                    <div
                      v-if="summary.profit_before === null"
                      class="text-caption text-grey"
                    >
                      {{
                        $t(
                          "CostDataUnavailable",
                          {},
                          "Cost data is unavailable for some items"
                        )
                      }}
                    </div>
                    <div v-else class="text-caption text-grey">
                      {{
                        $t(
                          "WasAmount",
                          {
                            amount: formatMoney(
                              summary.profit_before,
                              summary.currency
                            ),
                          },
                          "was {amount}"
                        )
                      }}
                      <span
                        v-if="profitDelta(summary)"
                        :class="profitColor(profitDelta(summary))"
                      >
                        ({{ formatSignedMoney(profitDelta(summary), summary.currency) }})
                      </span>
                    </div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="forecast-tile">
                    <div class="text-caption text-grey">
                      {{ $t("MarginAfter", {}, "Margin after") }}
                    </div>
                    <div class="text-h6">
                      {{ formatPercent(summary.margin_after) }}
                    </div>
                    <div class="text-caption text-grey">
                      {{
                        $t(
                          "WasPercent",
                          { value: formatPercent(summary.margin_before) },
                          "was {value}"
                        )
                      }}
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="breakEvenText(summary)"
                class="row items-center no-wrap q-gutter-x-xs text-body2"
              >
                <q-icon name="trending_up" color="brandblue" size="18px" />
                <span>{{ breakEvenText(summary) }}</span>
              </div>

              <div v-if="index < summaries.length - 1">
                <q-separator spaced />
              </div>
            </div>
          </template>

          <div v-else class="text-center q-py-lg text-grey">
            <q-icon name="search_off" size="2rem" />
            <div class="text-subtitle1">
              {{
                $t(
                  "NoForecastMatches",
                  {},
                  "No orders in this window match the discount conditions."
                )
              }}
            </div>
            <div class="text-caption">
              {{
                $t(
                  "NoForecastMatchesHint",
                  {},
                  "Try a wider condition or a smaller discount to see an impact."
                )
              }}
            </div>
          </div>

          <q-expansion-item
            v-if="products.length"
            icon="inventory_2"
            class="rounded-borders"
            :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-1'"
            :label="$t('AffectedProducts', {}, 'Affected products')"
            :caption="productsCaption"
          >
            <q-list separator>
              <q-item v-for="(product, index) in products" :key="index" dense>
                <q-item-section>
                  <q-item-label>
                    {{ product.product_name }}
                    <span v-if="product.variant_name" class="text-grey">
                      · {{ product.variant_name }}
                    </span>
                  </q-item-label>
                  <q-item-label caption>
                    {{ formatQuantity(product.quantity) }}
                    {{ $t("Units", "units") }}
                    <template v-if="productUnitPrice(product) !== null">
                      · {{ formatMoney(productUnitPrice(product), product.currency) }}
                    </template>
                  </q-item-label>
                </q-item-section>
                <q-item-section side top>
                  <div class="text-weight-medium">
                    {{ formatMoney(product.discount_total, product.currency) }}
                  </div>
                </q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
        </template>
      </div>

      <q-separator />

      <div class="q-pa-md row items-center justify-end q-gutter-x-sm">
        <q-btn flat no-caps color="grey-7" :label="$t('Cancel')" v-close-popup />
        <q-btn
          v-if="errorMessage"
          no-caps
          color="brandblue"
          :label="$t('CreateWithoutForecast', {}, 'Create without forecast')"
          @click="onDialogOK"
        />
        <q-btn
          v-else
          no-caps
          color="brandblue"
          :label="$t('CreateDiscount', {}, 'Create discount')"
          :loading="loading"
          :disable="loading"
          @click="onDialogOK"
        />
      </div>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from "src/marketplace/backend";
import { formatDateToText } from "src/marketplace/utils";
import { formatNumberAutoDecimals } from "src/utils/number-format";
import { useDialogPluginComponent } from "quasar";
import { useI18n } from "vue-i18n";
import { computed, defineComponent, nextTick, onMounted, ref } from "vue";

export default defineComponent({
  name: "DiscountForecastDialog",
  props: {
    forecastRequest: {
      type: Object,
      required: true,
    },
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props) {
    const { t: $t } = useI18n();
    const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

    const loading = ref(false);
    const errorMessage = ref("");
    const forecast = ref(null);
    const warningsExpanded = ref(false);
    const warningsCollapsing = ref(false);
    const warningsSummary = ref(null);
    const warningsSummaryHeight = ref(null);

    const assumptions = computed(() => forecast.value?.assumptions);
    const summaries = computed(() =>
      Array.isArray(forecast.value?.summaries)
        ? forecast.value.summaries
        : []
    );
    const products = computed(() =>
      Array.isArray(forecast.value?.products) ? forecast.value.products : []
    );
    const hasMatches = computed(() =>
      summaries.value.some((summary) => Number(summary?.orders) > 0)
    );
    const warnings = computed(() => {
      const list = Array.isArray(forecast.value?.warnings)
        ? forecast.value.warnings
        : [];
      // Drop API-internal suggestions that do not mean anything to a user.
      return list.filter(
        (warning) => !String(warning).startsWith("Set cost_fallback")
      );
    });
    const windowText = computed(() => {
      const from = forecast.value?.window?.timestamp_from;
      const to = forecast.value?.window?.timestamp_to;
      if (!from || !to) return "";
      return $t(
        "ForecastBasedOnWindow",
        { from: formatDateToText(from), to: formatDateToText(to) },
        "Based on sales from {from} to {to}."
      );
    });
    const productsCaption = computed(() => {
      const count = products.value.length;
      const productLabel = count === 1 ? $t("Product") : $t("Products");
      return `${count} ${productLabel}`;
    });

    function toNumber(value) {
      if (value === null || value === undefined || value === "") return NaN;
      return Number(value);
    }

    function formatMoney(value, currency) {
      const amount = toNumber(value);
      if (!Number.isFinite(amount)) return "—";
      const text = formatNumberAutoDecimals(amount, 2);
      return currency ? `${text} ${currency}` : text;
    }

    function formatSignedMoney(value, currency) {
      const amount = toNumber(value);
      if (!Number.isFinite(amount)) return "—";
      const sign = amount > 0 ? "+" : "";
      return `${sign}${formatMoney(amount, currency)}`;
    }

    function formatPercent(value) {
      const amount = toNumber(value);
      if (!Number.isFinite(amount)) return "—";
      return `${formatNumberAutoDecimals(amount * 100, 1)}%`;
    }

    function formatQuantity(value) {
      const amount = toNumber(value);
      if (!Number.isFinite(amount)) return "—";
      return formatNumberAutoDecimals(amount, 2);
    }

    function profitColor(value) {
      const amount = toNumber(value);
      if (!Number.isFinite(amount) || amount === 0) return "text-grey-9";
      return amount < 0 ? "text-negative" : "text-positive";
    }

    function revenueAfter(summary) {
      const revenueBefore = toNumber(summary?.revenue_before);
      const discountTotal = toNumber(summary?.discount_total);
      const deliveryDiscount = toNumber(summary?.delivery_fee_discount_total) || 0;
      if (!Number.isFinite(revenueBefore) || !Number.isFinite(discountTotal)) {
        return null;
      }
      return revenueBefore - (discountTotal - deliveryDiscount);
    }

    function profitDelta(summary) {
      const profitBefore = toNumber(summary?.profit_before);
      const profitAfter = toNumber(summary?.profit_after);
      if (!Number.isFinite(profitBefore) || !Number.isFinite(profitAfter)) {
        return null;
      }
      return profitAfter - profitBefore;
    }

    function productUnitPrice(product) {
      const revenueBefore = toNumber(product?.revenue_before);
      const quantity = toNumber(product?.quantity);
      if (
        !Number.isFinite(revenueBefore) ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        return null;
      }
      return revenueBefore / quantity;
    }

    function matchedOrdersText(summary) {
      const matched = Number(summary?.orders) || 0;
      const total = Number(assumptions.value?.orders_evaluated);
      if (Number.isFinite(total) && total > 0) {
        return $t(
          "MatchedOrders",
          { matched, total },
          "{matched} of {total} orders matched"
        );
      }
      return $t("MatchedOrdersOnly", { matched }, "{matched} orders matched");
    }

    function breakEvenText(summary) {
      const discountTotal = Number(summary?.discount_total);
      if (!Number.isFinite(discountTotal) || discountTotal <= 0) return "";
      if (summary?.profit_before === null || summary?.profit_before === undefined) {
        return "";
      }
      const uplift = Number(summary?.break_even_uplift);
      if (!Number.isFinite(uplift)) {
        return $t(
          "BreakEvenNotReachable",
          {},
          "At the current sales volume, this discount would not pay for itself."
        );
      }
      return $t(
        "BreakEvenUplift",
        { percent: formatPercent(uplift) },
        "Needs {percent} more sales volume to break even."
      );
    }

    function parseErrorMessage(error) {
      const data = error?.response?.data;
      if (typeof data === "string" && data) return data;
      if (typeof data?.detail === "string") return data.detail;

      const nonFieldErrors = data?.non_field_errors;
      if (Array.isArray(nonFieldErrors) && nonFieldErrors.length) {
        return String(nonFieldErrors[0]);
      }
      if (Array.isArray(data) && data.length) {
        return typeof data[0] === "string"
          ? data[0]
          : $t("ForecastFailed", {}, "Unable to generate a forecast right now.");
      }
      if (data && typeof data === "object") {
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === "string" && value) return `${key}: ${value}`;
          if (Array.isArray(value) && typeof value[0] === "string") {
            return `${key}: ${value[0]}`;
          }
        }
      }
      return $t(
        "ForecastFailed",
        {},
        "Unable to generate a forecast right now."
      );
    }

    function warningLineHeight(element) {
      const computedStyle = window.getComputedStyle(element);
      const lineHeight = parseFloat(computedStyle.lineHeight);
      if (Number.isFinite(lineHeight)) return lineHeight;
      const fontSize = parseFloat(computedStyle.fontSize);
      return Number.isFinite(fontSize) ? fontSize * 1.5 : 21;
    }

    async function toggleWarnings() {
      const element = warningsSummary.value;
      if (!element) {
        warningsExpanded.value = !warningsExpanded.value;
        return;
      }

      const startHeight = element.getBoundingClientRect().height;
      warningsSummaryHeight.value = `${startHeight}px`;

      if (warningsExpanded.value) {
        warningsCollapsing.value = true;
        warningsExpanded.value = false;
        await nextTick();
        element.getBoundingClientRect();

        const targetHeight = warningLineHeight(element);
        if (Math.abs(targetHeight - startHeight) < 1) {
          warningsSummaryHeight.value = null;
          warningsCollapsing.value = false;
          return;
        }
        warningsSummaryHeight.value = `${targetHeight}px`;
        return;
      }

      warningsCollapsing.value = false;
      warningsExpanded.value = true;
      await nextTick();
      element.getBoundingClientRect();

      const targetHeight = element.scrollHeight;
      if (Math.abs(targetHeight - startHeight) < 1) {
        warningsSummaryHeight.value = null;
        return;
      }
      warningsSummaryHeight.value = `${targetHeight}px`;
    }

    function onWarningsTransitionEnd(event) {
      if (
        event.target !== warningsSummary.value ||
        event.propertyName !== "height"
      ) {
        return;
      }
      warningsSummaryHeight.value = null;
      if (!warningsExpanded.value) {
        warningsCollapsing.value = false;
      }
    }

    function fetchForecast() {
      loading.value = true;
      errorMessage.value = "";
      warningsExpanded.value = false;
      warningsCollapsing.value = false;
      warningsSummaryHeight.value = null;
      return backend
        .post("reports/discount-types/forecast/", props.forecastRequest)
        .then((response) => {
          const data = response?.data;
          if (!data || !Array.isArray(data.summaries)) {
            return Promise.reject({ response });
          }
          forecast.value = data;
          return response;
        })
        .catch((error) => {
          forecast.value = null;
          errorMessage.value = parseErrorMessage(error);
        })
        .finally(() => {
          loading.value = false;
        });
    }

    onMounted(fetchForecast);

    return {
      dialogRef,
      onDialogHide,
      onDialogOK,

      loading,
      errorMessage,
      forecast,
      warningsExpanded,
      warningsCollapsing,
      warningsSummary,
      warningsSummaryHeight,
      assumptions,
      summaries,
      products,
      hasMatches,
      warnings,
      windowText,
      productsCaption,

      formatMoney,
      formatSignedMoney,
      formatPercent,
      formatQuantity,
      profitColor,
      revenueAfter,
      profitDelta,
      productUnitPrice,
      matchedOrdersText,
      breakEvenText,
      fetchForecast,
      toggleWarnings,
      onWarningsTransitionEnd,
    };
  },
});
</script>
<style scoped>
.forecast-warnings__summary {
  height: 1.5em;
  overflow: hidden;
  line-height: 1.5;
  transition: height 0.3s ease;
}

.forecast-warnings__summary--expanded {
  height: auto;
}

.forecast-warnings__summary--collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.forecast-warnings__item::before {
  content: "•";
  margin-right: 0.4em;
}

.forecast-warnings__chevron {
  transition: transform 0.25s ease;
}

.forecast-warnings__chevron--expanded {
  transform: rotate(180deg);
}

.forecast-tile {
  height: 100%;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}

body.body--dark .forecast-tile {
  border-color: rgba(255, 255, 255, 0.12);
}
</style>
