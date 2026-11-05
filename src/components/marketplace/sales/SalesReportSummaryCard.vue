<template>
  <q-card
    v-ripple
    class="cursor-pointer"
    style="height:100%;"
    tabindex="0"
    role="button"
    @click="showDialog = true"
    @keyup.enter="showDialog = true"
    @keyup.space.prevent="showDialog = true"
  >
    <q-card-section>
      <div class="row items-center no-wrap">
        <div class="text-subtitle1">{{ summary?.label }}</div>
        <q-spinner v-if="summary?.loading" class="q-ml-xs"/>
        <q-icon
          v-if="hasUncostedSales"
          name="help_outline"
          size="16px"
          color="warning"
          class="q-ml-xs"
        >
          <q-tooltip>
            {{ $t('UncostedSalesHint', 'Some sales have no cost data; profit excludes them.') }}
          </q-tooltip>
        </q-icon>
        <q-space/>
        <q-icon name="chevron_right" class="text-grey"/>
      </div>
      <template v-if="reports.length">
        <div
          v-for="(report, index) in reports" :key="index"
          class="row items-baseline no-wrap q-mt-xs"
        >
          <div class="text-h6">{{ formatCurrencyAmount(report?.total) }}</div>
          <div class="text-subtitle2 q-ml-xs">{{ report?.currency }}</div>
        </div>
      </template>
      <div v-else class="text-grey q-mt-xs">
        {{ $t('None') }}
      </div>
      <div class="text-caption text-grey q-mt-sm">
        {{ $t('ViewDetails', 'View details') }}
      </div>
    </q-card-section>
  </q-card>

  <q-dialog v-model="showDialog" position="bottom">
    <q-card class="rounded-borders column no-wrap" style="width:100%;max-width:560px;max-height:85vh;">
      <div class="q-pa-md row items-center no-wrap">
        <div class="text-h6 q-space">
          {{ summary?.label || $t('Sales') }}
        </div>
        <q-btn flat round icon="close" padding="sm" v-close-popup />
      </div>

      <q-separator />

      <div class="q-pa-md col overflow-auto">
        <div v-if="summary?.loading" class="text-center q-pa-md">
          <q-spinner color="brandblue" />
        </div>

        <div v-else-if="reports.length" class="q-gutter-y-md">
          <div v-for="(report, index) in reports" :key="index">
            <div class="row items-baseline no-wrap">
              <div class="text-subtitle1">
                {{ report?.currency || $t('Currency') }}
              </div>
              <q-space />
              <div class="text-h6">
                {{ formatMoney(report?.total, report?.currency) }}
              </div>
            </div>

            <q-separator spaced />

            <div class="row q-col-gutter-sm">
              <div class="col-6 col-sm-4">
                <div class="text-caption text-grey">{{ $t('Sales') }}</div>
                <div class="text-body1">
                  {{ formatMoney(report?.total, report?.currency) }}
                </div>
              </div>
              <div class="col-6 col-sm-4">
                <div class="text-caption text-grey">{{ $t('Transactions') }}</div>
                <div class="text-body1">{{ formatCount(report?.count) }}</div>
              </div>
              <div class="col-6 col-sm-4">
                <div class="text-caption text-grey">{{ $t('Profit', 'Profit') }}</div>
                <div class="text-body1" :class="profitColor(report?.total_profit)">
                  {{ formatMoney(report?.total_profit, report?.currency) }}
                </div>
              </div>
              <div class="col-6 col-sm-4">
                <div class="text-caption text-grey">
                  {{ $t('UncostedSales', 'Uncosted sales') }}
                </div>
                <div class="text-body1">
                  {{ formatMoney(report?.total_uncosted, report?.currency) }}
                </div>
              </div>
              <div v-if="uncostedSales(report) > 0" class="col-6 col-sm-4">
                <div class="text-caption text-grey">
                  {{ $t('CostedSales', 'Costed sales') }}
                </div>
                <div class="text-body1">
                  {{ formatMoney(costedSales(report), report?.currency) }}
                </div>
              </div>
              <div v-if="averageSale(report) !== null" class="col-6 col-sm-4">
                <div class="text-caption text-grey">
                  {{ $t('AverageSale', 'Average sale') }}
                </div>
                <div class="text-body1">
                  {{ formatMoney(averageSale(report), report?.currency) }}
                </div>
              </div>
              <div v-if="profitMargin(report) !== null" class="col-6 col-sm-4">
                <div class="text-caption text-grey">
                  {{ $t('ProfitMargin', 'Profit margin') }}
                </div>
                <div class="text-body1" :class="profitColor(report?.total_profit)">
                  {{ formatPercent(profitMargin(report)) }}
                </div>
              </div>
            </div>

            <div v-if="uncostedSales(report) > 0" class="text-caption text-grey q-mt-sm">
              {{ $t('UncostedSalesProfitHint', 'Profit and margin only include sales with cost data.') }}
            </div>

            <q-separator v-if="index < reports.length - 1" class="q-mt-md" />
          </div>
        </div>

        <div v-else class="text-grey">
          {{ $t('None') }}
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>
<script>
import { formatCurrencyAmount } from 'src/utils/denomination-utils'
import { computed, defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'SalesReportSummaryCard',
  props: {
    summary: Object,
  },
  setup(props) {
    const showDialog = ref(false)

    const reports = computed(() => {
      return Array.isArray(props.summary?.data) ? props.summary.data : []
    })

    const hasUncostedSales = computed(() => {
      return reports.value.some(report => uncostedSales(report) > 0)
    })

    function toNumber(value) {
      if (value === null || value === undefined || value === '') return NaN
      return Number(value)
    }

    function formatMoney(value, currency) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '—'
      const text = formatCurrencyAmount(amount)
      return currency ? `${text} ${currency}` : text
    }

    function formatCount(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '0'
      return new Intl.NumberFormat(navigator.language).format(amount)
    }

    function formatPercent(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '—'
      return `${formatCurrencyAmount(amount)}%`
    }

    function profitColor(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount) || amount === 0) return 'text-grey'
      return amount < 0 ? 'text-negative' : 'text-positive'
    }

    function uncostedSales(report) {
      const uncosted = toNumber(report?.total_uncosted)
      return Number.isFinite(uncosted) ? uncosted : 0
    }

    function costedSales(report) {
      const total = toNumber(report?.total)
      if (!Number.isFinite(total)) return null
      return total - uncostedSales(report)
    }

    function averageSale(report) {
      const total = toNumber(report?.total)
      const count = toNumber(report?.count)
      if (!Number.isFinite(total) || !Number.isFinite(count) || count <= 0) return null
      return total / count
    }

    function profitMargin(report) {
      const costed = costedSales(report)
      const profit = toNumber(report?.total_profit)
      if (!Number.isFinite(costed) || !Number.isFinite(profit) || costed <= 0) return null
      return (profit / costed) * 100
    }

    return {
      showDialog,
      reports,
      hasUncostedSales,
      formatCurrencyAmount,
      formatMoney,
      formatCount,
      formatPercent,
      profitColor,
      uncostedSales,
      costedSales,
      averageSale,
      profitMargin,
    }
  },
})
</script>
