<template>
  <div class="q-gutter-y-md">
    <div v-if="windowText" class="text-caption text-grey">
      {{ windowText }}
    </div>

    <q-banner
      v-if="warnings.length && hasMatches"
      class="discount-report-warnings rounded-borders cursor-pointer"
      :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-amber-1'"
      role="button"
      tabindex="0"
      :aria-expanded="warningsExpanded ? 'true' : 'false'"
      @click="toggleWarnings"
      @keydown.enter.prevent="toggleWarnings"
      @keydown.space.prevent="toggleWarnings"
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
              class="discount-report-warnings__chevron"
              :class="{
                'discount-report-warnings__chevron--expanded': warningsExpanded,
              }"
              :color="$q.dark.isActive ? 'amber-4' : 'amber-8'"
            />
          </div>
          <div
            ref="warningsSummary"
            class="discount-report-warnings__summary"
            :class="{
              'discount-report-warnings__summary--expanded': warningsExpanded,
              'discount-report-warnings__summary--collapsed':
                !warningsExpanded && !warningsCollapsing,
            }"
            :style="{ height: warningsSummaryHeight }"
            @transitionend="onWarningsTransitionEnd"
          >
            <span
              v-for="(warning, index) in warnings"
              :key="index"
              class="discount-report-warnings__item"
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
          {{ $t('MatchedSales', {}, 'Matched sales') }}
          <span v-if="summary.currency" class="text-grey">
            · {{ summary.currency }}
          </span>
        </div>

        <div class="row q-col-gutter-sm">
          <div class="col-6">
            <div class="discount-report-tile">
              <div class="text-caption text-grey">
                {{ $t('DiscountCost', {}, 'Discount cost') }}
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
            <div class="discount-report-tile">
              <div class="text-caption text-grey">
                {{ $t('RevenueAfter', {}, 'Revenue after') }}
              </div>
              <div class="text-h6">
                {{ formatMoney(revenueAfter(summary), summary.currency) }}
              </div>
              <div class="text-caption text-grey">
                {{
                  $t(
                    'WasAmount',
                    {
                      amount: formatMoney(
                        summary.revenue_before,
                        summary.currency,
                      ),
                    },
                    'was {amount}',
                  )
                }}
              </div>
            </div>
          </div>
          <div class="col-6">
            <div class="discount-report-tile">
              <div class="text-caption text-grey">
                {{ $t('ProfitAfter', {}, 'Profit after') }}
              </div>
              <div class="text-h6" :class="profitColor(summary.profit_after)">
                {{ formatMoney(summary.profit_after, summary.currency) }}
              </div>
              <div
                v-if="summary.profit_before === null"
                class="text-caption text-grey"
              >
                {{
                  $t(
                    'CostDataUnavailable',
                    {},
                    'Cost data is unavailable for some items',
                  )
                }}
              </div>
              <div v-else class="text-caption text-grey">
                {{
                  $t(
                    'WasAmount',
                    {
                      amount: formatMoney(
                        summary.profit_before,
                        summary.currency,
                      ),
                    },
                    'was {amount}',
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
            <div class="discount-report-tile">
              <div class="text-caption text-grey">
                {{ $t('MarginAfter', {}, 'Margin after') }}
              </div>
              <div class="text-h6">
                {{ formatPercent(summary.margin_after) }}
              </div>
              <div class="text-caption text-grey">
                {{
                  $t(
                    'WasPercent',
                    { value: formatPercent(summary.margin_before) },
                    'was {value}',
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
          $t('NoReportMatches', 'No orders in this window match the discount conditions.')
        }}
      </div>
      <div v-if="isBasketMode" class="text-caption">
        {{
          $t('NoReportMatchesHint', 'Try a wider condition or a smaller discount to see an impact.')
        }}
      </div>
      <div v-else class="text-caption">
        {{
          $t('NoHistoryReportMatchesHint', 'The discount may not have been used during this period.')
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
              {{ $t('Units', 'units') }}
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
  </div>
</template>

<script>
import { formatDateToText } from 'src/marketplace/utils'
import { formatNumberAutoDecimals } from 'src/utils/number-format'
import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'DiscountReport',
  props: {
    report: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const { t: $t } = useI18n()

    const warningsExpanded = ref(false)
    const warningsCollapsing = ref(false)
    const warningsSummary = ref(null)
    const warningsSummaryHeight = ref(null)

    const assumptions = computed(() => props.report?.assumptions)
    const summaries = computed(() =>
      Array.isArray(props.report?.summaries) ? props.report.summaries : [],
    )
    const products = computed(() =>
      Array.isArray(props.report?.products) ? props.report.products : [],
    )
    const hasMatches = computed(() =>
      summaries.value.some((summary) => Number(summary?.orders) > 0),
    )
    const warnings = computed(() => {
      const list = Array.isArray(props.report?.warnings)
        ? props.report.warnings
        : []
      // Drop API-internal suggestions that do not mean anything to a user.
      return list.filter(
        (warning) => !String(warning).startsWith('Set cost_fallback'),
      )
    })
    const isBasketMode = computed(() => props.report?.mode === 'basket')
    const windowText = computed(() => {
      const from = props.report?.window?.timestamp_from
      const to = props.report?.window?.timestamp_to
      if (!from || !to) return ''
      return $t(
        'ReportBasedOnWindow',
        { from: formatDateToText(from), to: formatDateToText(to) },
        'Based on sales from {from} to {to}.',
      )
    })
    const productsCaption = computed(() => {
      const count = products.value.length
      const productLabel = count === 1 ? $t('Product') : $t('Products')
      return `${count} ${productLabel}`
    })

    function resetWarnings() {
      warningsExpanded.value = false
      warningsCollapsing.value = false
      warningsSummaryHeight.value = null
    }

    watch(() => props.report, resetWarnings)

    function toNumber(value) {
      if (value === null || value === undefined || value === '') return NaN
      return Number(value)
    }

    function formatMoney(value, currency) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '—'
      const text = formatNumberAutoDecimals(amount, 2)
      return currency ? `${text} ${currency}` : text
    }

    function formatSignedMoney(value, currency) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '—'
      const sign = amount > 0 ? '+' : ''
      return `${sign}${formatMoney(amount, currency)}`
    }

    function formatPercent(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '—'
      return `${formatNumberAutoDecimals(amount * 100, 1)}%`
    }

    function formatQuantity(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '—'
      return formatNumberAutoDecimals(amount, 2)
    }

    function profitColor(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount) || amount === 0) return 'text-grey'
      return amount < 0 ? 'text-negative' : 'text-positive'
    }

    function revenueAfter(summary) {
      const revenueBefore = toNumber(summary?.revenue_before)
      const discountTotal = toNumber(summary?.discount_total)
      const deliveryDiscount =
        toNumber(summary?.delivery_fee_discount_total) || 0
      if (!Number.isFinite(revenueBefore) || !Number.isFinite(discountTotal)) {
        return null
      }
      return revenueBefore - (discountTotal - deliveryDiscount)
    }

    function profitDelta(summary) {
      const profitBefore = toNumber(summary?.profit_before)
      const profitAfter = toNumber(summary?.profit_after)
      if (!Number.isFinite(profitBefore) || !Number.isFinite(profitAfter)) {
        return null
      }
      return profitAfter - profitBefore
    }

    function productUnitPrice(product) {
      const revenueBefore = toNumber(product?.revenue_before)
      const quantity = toNumber(product?.quantity)
      if (
        !Number.isFinite(revenueBefore) ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        return null
      }
      return revenueBefore / quantity
    }

    function matchedOrdersText(summary) {
      const matched = Number(summary?.orders) || 0
      const total = Number(assumptions.value?.orders_evaluated)
      if (Number.isFinite(total) && total > 0) {
        return $t(
          'MatchedOrders',
          { matched, total },
          '{matched} of {total} orders matched',
        )
      }
      return $t('MatchedOrdersOnly', { matched }, '{matched} orders matched')
    }

    function breakEvenText(summary) {
      const discountTotal = Number(summary?.discount_total)
      if (!Number.isFinite(discountTotal) || discountTotal <= 0) return ''
      if (
        summary?.profit_before === null ||
        summary?.profit_before === undefined
      ) {
        return ''
      }
      const rawUplift = summary?.break_even_uplift
      const uplift = Number(rawUplift)
      if (
        rawUplift === null ||
        rawUplift === undefined ||
        !Number.isFinite(uplift)
      ) {
        return $t(
          'BreakEvenNotReachable',
          {},
          'At the current sales volume, this discount would not pay for itself.',
        )
      }
      return $t(
        'BreakEvenUplift',
        { percent: formatPercent(uplift) },
        'Needs {percent} more sales volume to break even.',
      )
    }

    function warningLineHeight(element) {
      const computedStyle = window.getComputedStyle(element)
      const lineHeight = parseFloat(computedStyle.lineHeight)
      if (Number.isFinite(lineHeight)) return lineHeight
      const fontSize = parseFloat(computedStyle.fontSize)
      return Number.isFinite(fontSize) ? fontSize * 1.5 : 21
    }

    async function toggleWarnings() {
      const element = warningsSummary.value
      if (!element) {
        warningsExpanded.value = !warningsExpanded.value
        return
      }

      const startHeight = element.getBoundingClientRect().height
      warningsSummaryHeight.value = `${startHeight}px`

      if (warningsExpanded.value) {
        warningsCollapsing.value = true
        warningsExpanded.value = false
        await nextTick()
        element.getBoundingClientRect()

        const targetHeight = warningLineHeight(element)
        if (Math.abs(targetHeight - startHeight) < 1) {
          warningsSummaryHeight.value = null
          warningsCollapsing.value = false
          return
        }
        warningsSummaryHeight.value = `${targetHeight}px`
        return
      }

      warningsCollapsing.value = false
      warningsExpanded.value = true
      await nextTick()
      element.getBoundingClientRect()

      const targetHeight = element.scrollHeight
      if (Math.abs(targetHeight - startHeight) < 1) {
        warningsSummaryHeight.value = null
        return
      }
      warningsSummaryHeight.value = `${targetHeight}px`
    }

    function onWarningsTransitionEnd(event) {
      if (
        event.target !== warningsSummary.value ||
        event.propertyName !== 'height'
      ) {
        return
      }
      warningsSummaryHeight.value = null
      if (!warningsExpanded.value) {
        warningsCollapsing.value = false
      }
    }

    return {
      summaries,
      products,
      hasMatches,
      warnings,
      isBasketMode,
      windowText,
      productsCaption,

      warningsExpanded,
      warningsCollapsing,
      warningsSummary,
      warningsSummaryHeight,

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
      toggleWarnings,
      onWarningsTransitionEnd,
    }
  },
})
</script>

<style scoped>
.discount-report-warnings__summary {
  height: 1.5em;
  overflow: hidden;
  line-height: 1.5;
  transition: height 0.3s ease;
}

.discount-report-warnings__summary--expanded {
  height: auto;
}

.discount-report-warnings__summary--collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.discount-report-warnings__item::before {
  content: "•";
  margin-right: 0.4em;
}

.discount-report-warnings__chevron {
  transition: transform 0.25s ease;
}

.discount-report-warnings__chevron--expanded {
  transform: rotate(180deg);
}

.discount-report-tile {
  height: 100%;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}

body.body--dark .discount-report-tile {
  border-color: rgba(255, 255, 255, 0.12);
}
</style>
