<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Sales') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="row items-center justify-end q-mb-sm">
        <q-btn-dropdown
          :disable-dropdown="salesGraph.loading"
          padding="xs sm"
          outline
          no-caps
          icon="filter_list"
          :label="productVariantFilterLabel"
        >
          <q-list>
            <q-item clickable v-close-popup @click="selectProduct()">
              <q-item-section>
                <q-item-label>{{ $t('SelectProduct', 'Select Product') }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="selectVariant()">
              <q-item-section>
                <q-item-label>{{ $t('SelectVariant', 'Select Variant') }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              v-if="selectedProduct || selectedVariant"
              clickable
              v-close-popup
              @click="clearProductVariantFilter()"
            >
              <q-item-section>
                <q-item-label>{{ $t('ClearFilter', 'Clear filter') }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>
      <div class="row">
        <div
          v-for="(summary, key) in summaries" :key="key"
          class="col-6 col-sm-4 q-pa-sm"
        >
          <SalesReportSummaryCard :summary="summary" />
        </div>
      </div>

      <div class="q-mt-md row items-center">
        <q-option-group
          :disable="salesGraph.loading"
          inline
          :options="[
            { label: $t('Monthly'), value: 'month'},
            { label: $t('Daily'), value: 'day'},
          ]"
          v-model="salesGraphParams.interval"
        />
        <q-space/>
        <q-btn-dropdown
          :disable-dropdown="salesGraph.loading"
          :loading="salesGraph.loading"
          padding="xs sm"
          outline
          no-caps
          :label="salesGraphParams.range.label"
        >
          <q-list>
            <q-item
              v-for="(rangeOpt, index) in predefinedRangeOpts" :key="index"
              :active="rangeOpt?.label == salesGraphParams.range?.label"
              :loading="salesGraph.loading"
              clickable
              v-ripple
              v-close-popup
              @click="() => salesGraphParams.range = rangeOpt"
            >
              <q-item-section>
                <q-item-label>{{ rangeOpt.label }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>
      <div class="row items-center q-mt-xs">
        <div class="text-caption text-grey q-mr-sm">{{ $t('Show', 'Show') }}:</div>
        <q-option-group
          :disable="salesGraph.loading"
          inline
          :options="salesGraphMetricOptions"
          v-model="salesGraphMetric"
        />
      </div>
      <div class="column items-center" style="overflow-x:auto;overflow-y:clip;">
        <VueApexCharts
          v-if="salesGraphChart.series.length"
          class="chart"
          type="bar"
          :options="salesGraphChart.options"
          :series="salesGraphChart.series"
        />
        <div v-else-if="!salesGraph.loading" class="text-grey q-py-md">
          {{ $t('None') }}
        </div>
      </div>
      <q-table
        class="q-mt-md full-width"
        :loading="salesGraph.loading"
        :loading-label="$t('Loading')"
        :columns="salesReportTableColumns"
        :rows="salesReportRows"
        :no-data-label="$t('None')"
        row-key="key"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        binary-state-sort
      >
        <template v-slot:body-cell-timestamp="props">
          <q-td :props="props">
            {{ formatDate(props.row?.timestamp, salesGraph.interval) || props.row?.timestamp }}
          </q-td>
        </template>
        <template v-slot:body-cell-total="props">
          <q-td :props="props">
            {{ formatMoney(props.row?.total, props.row?.currency) }}
          </q-td>
        </template>
        <template v-slot:body-cell-count="props">
          <q-td :props="props">
            {{ formatCount(props.row?.count) }}
          </q-td>
        </template>
        <template v-slot:body-cell-total_profit="props">
          <q-td :props="props" :class="profitColor(props.row?.total_profit)">
            {{ formatMoney(props.row?.total_profit, props.row?.currency) }}
          </q-td>
        </template>
        <template v-slot:body-cell-total_uncosted="props">
          <q-td :props="props" :class="props.row?.total_uncosted > 0 ? 'text-warning' : ''">
            {{ formatMoney(props.row?.total_uncosted, props.row?.currency) }}
          </q-td>
        </template>
      </q-table>
      <VariantSearchDialog
        v-model="showVariantSearchDialog"
        hide-scanner
        @ok="onVariantSelected"
      />
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { formatCurrencyAmount } from 'src/utils/denomination-utils';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import ProductSearchDialog from 'src/components/marketplace/ProductSearchDialog.vue'
import SalesReportSummaryCard from 'src/components/marketplace/sales/SalesReportSummaryCard.vue'
import VariantSearchDialog from 'src/components/marketplace/sales/VariantSearchDialog.vue'
import VueApexCharts from "vue3-apexcharts";

export default defineComponent({
  name: 'SalesReportPage',
  components: {
    VueApexCharts,
    MarketplaceHeader,
    SalesReportSummaryCard,
    VariantSearchDialog,
  },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()

    const selectedProduct = ref(null)
    const selectedVariant = ref(null)
    const showVariantSearchDialog = ref(false)

    const productVariantFilterLabel = computed(() => {
      if (selectedVariant.value) {
        const variantName = selectedVariant.value?.itemName
          || [selectedVariant.value?.product?.name, selectedVariant.value?.name].filter(Boolean).join(' - ')
        return `${t('Variant')}: ${variantName || `#${selectedVariant.value?.id}`}`
      }
      if (selectedProduct.value) {
        return `${t('Product')}: ${selectedProduct.value?.name || `#${selectedProduct.value?.id}`}`
      }
      return t('AllProducts', 'All Products')
    })

    const productVariantFilterParams = computed(() => {
      if (selectedVariant.value?.id) return { variant_id: selectedVariant.value.id }
      if (selectedProduct.value?.id) return { product_id: selectedProduct.value.id }
      return {}
    })

    function onProductSelected(product) {
      selectedProduct.value = product || null
      if (product) selectedVariant.value = null
    }

    function onVariantSelected(variant) {
      selectedVariant.value = variant || null
      if (variant) selectedProduct.value = null
    }

    function clearProductVariantFilter() {
      selectedProduct.value = null
      selectedVariant.value = null
    }

    function selectProduct() {
      $q.dialog({
        component: ProductSearchDialog,
        componentProps: {
          selected: selectedProduct.value || undefined,
          ok: { label: t('Done'), color: 'brandblue' },
          cancel: true,
        },
      }).onOk(product => onProductSelected(product))
    }

    function selectVariant() {
      showVariantSearchDialog.value = true
    }

    const summaries = ref({
      today:     { data: [].map(() => Object({ total: 0, count: 0, currency: '' })), loading: false, label: t('Today')},
      yesterday: { data: [].map(() => Object({ total: 0, count: 0, currency: '' })), loading: false, label: t('Yesterday')},
      thisWeek:  { data: [].map(() => Object({ total: 0, count: 0, currency: '' })), loading: false, label: t('ThisWeek')},
      thisMonth: { data: [].map(() => Object({ total: 0, count: 0, currency: '' })), loading: false, label: t('ThisMonth')},
    })
    onMounted(() => updateSummary())

    function updateSummary() {
      const now = Date.now()
      const rangeTs = {
        today:     { from: new Date(now), to: new Date(now) },
        yesterday: { from: new Date(now), to: new Date(now) },
        thisWeek:  { from: new Date(now), to: new Date(now) },
        thisMonth: { from: new Date(now), to: new Date(now) },
      }
      rangeTs.today.from.setHours(0, 0, 0, 0)
      rangeTs.today.to.setHours(24, 0, 0, -1)

      rangeTs.yesterday.from.setHours(-24, 0, 0, 0)
      rangeTs.yesterday.to.setHours(0, 0, 0, -1)

      rangeTs.thisWeek.from.setHours(-24 * rangeTs.thisWeek.from.getDay(), 0, 0, 0)
      rangeTs.thisWeek.to.setHours(24 * (7-rangeTs.thisWeek.to.getDay()), 0, 0, -1)

      rangeTs.thisMonth.from.setDate(1)
      rangeTs.thisMonth.from.setHours(0,0,0,0)

      rangeTs.thisMonth.to.setFullYear(
        rangeTs.thisMonth.to.getFullYear(),
        rangeTs.thisMonth.to.getMonth() + 1,
        -1,
      )
      rangeTs.thisMonth.to.setHours(24, 0, 0, -1)

      const requests = Object.getOwnPropertyNames(rangeTs)
        .map(async range => {
          const data = {
            ...productVariantFilterParams.value,
            shop_id: marketplaceStore.activeShopId,
            timestamp_from: rangeTs[range].from.toISOString(),
            timestamp_to: rangeTs[range].to.toISOString(),
          }
          if (!summaries.value[range]) summaries.value[range] = { label: range, loading: false, data: [] }
          summaries.value[range].loading = true
          try {
            const response = await backend.post(`sales-orders/report/`, data, { params: { range }})
            if (!Array.isArray(response?.data?.data)) return Promise.reject({ response })
            summaries.value[range].data = response?.data?.data
          } finally {
            summaries.value[range].loading = false
          }
        })
      return Promise.all(requests)
    }

    const predefinedRangeOpts = computed(() => {
      const today =      { from: new Date(), to: new Date(), label: t('Today') }
      const yesterday =  { from: new Date(), to: new Date(), label: t('Yesterday') }
      const last7Days =  { from: new Date(), to: new Date(), label: t('Last7Days') }
      const last30Days = { from: new Date(), to: new Date(), label: t('Last30Days') }

      today.from.setHours(0,0,0,0)
      today.to.setHours(24,0,0,-1)

      yesterday.from.setHours(-24,0,0, 0)
      yesterday.to.setHours(0,0,0,-1)

      last7Days.from.setHours(-24 * 7, 0, 0, 0)
      last7Days.to.setHours(24, 0, 0, -1)

      last30Days.from.setHours(-24 * 30, 0, 0, 0)
      last30Days.to.setHours(24, 0, 0, -1)

      return [today, yesterday, last7Days, last30Days]
    })

    /**
     * @param {{ from:Date, to:Date, label:String? }} range1 
     * @param {{ from:Date, to:Date, label:String? }} range2 
     */
    function isRangeEqual(range1, range2) {
      if (range1?.from?.getTime() != range2?.from?.getTime()) return false
      if (range1?.to?.getTime() != range2?.to?.getTime()) return false
      return true
    }

    const salesGraphParams = ref({
      range: predefinedRangeOpts.value.at(-1),
      interval: 'day',
      currency: null,
    })

    const salesGraph = ref({
      loading: false,
      range: { label: '', from: new Date('invalid'), to: new Date('invalid') },
      interval: 'day',
      currency: null,
      data: [].map(() => {
        return {
          timestamp: '',
          count: 0,
          total: 0,
          total_profit: 0,
          total_uncosted: 0,
          currency: '',
        }
      })
    })

    const salesGraphMetric = ref('total')
    const salesGraphMetricOptions = computed(() => [
      { label: t('Sales'), value: 'total' },
      { label: t('Profit', 'Profit'), value: 'total_profit' },
      { label: t('Uncosted', 'Uncosted'), value: 'total_uncosted' },
      { label: t('Transactions'), value: 'count' },
    ])

    watch(salesGraphParams, () => updateSalesGraph(), { deep: true })
    watch(
      () => [selectedProduct.value?.id, selectedVariant.value?.id],
      () => {
        updateSummary()
        updateSalesGraph()
      },
    )
    onMounted(() => updateSalesGraph())
    function updateSalesGraph() {
      const data = {
        ...productVariantFilterParams.value,
        timestamp_from: salesGraphParams.value?.range?.from?.toISOString(),
        timestamp_to: salesGraphParams.value?.range?.to?.toISOString(),
        interval: salesGraphParams.value?.interval,
        currency: salesGraphParams.value?.currency || null,
        shop_id: marketplaceStore.activeShopId,
      }

      salesGraph.value.loading = true
      backend.post(`sales-orders/report/`, data)
        .then(response => {
          salesGraph.value.range.from = new Date(response?.data?.timestamp_from)
          salesGraph.value.range.to = new Date(response?.data?.timestamp_to)
          salesGraph.value.range.label = predefinedRangeOpts.value
            .find(range => isRangeEqual(range, salesGraph.value.range))?.label || t('Custom')

          salesGraph.value.interval = response?.data?.interval
          salesGraph.value.currency = response?.data?.currency
          salesGraph.value.data = response?.data?.data
        })
        .finally(() => {
          salesGraph.value.loading = false
        })
    }

    const groupedSalesGraphData = computed(() => {
      const groupedData = []
      const graphData = Array.isArray(salesGraph.value.data) ? salesGraph.value.data : []
      graphData.forEach(data => {
        const group = groupedData.find(g => g?.timestamp == data?.timestamp) || { timestamp: data?.timestamp, summaries: []}
        group.summaries.push({
          currency: data?.currency,
          total: data?.total,
          count: data?.count,
          total_profit: data?.total_profit,
          total_uncosted: data?.total_uncosted,
        })
        if (groupedData.indexOf(group) < 0) groupedData.push(group)
      })

      groupedData.sort((group1, group2) => {
        const date1 = new Date(group1?.timestamp)
        const date2 = new Date(group2?.timestamp)
        if (isNaN(date1 * 1) || isNaN(date2 * 1)) return 0
        return date1 - date2
      })
      return groupedData
    })

    const salesReportRows = computed(() => {
      const graphData = Array.isArray(salesGraph.value.data) ? salesGraph.value.data : []
      return graphData.map((report, index) => {
        return {
          key: `${report?.timestamp}-${report?.currency}-${index}`,
          timestamp: report?.timestamp,
          currency: report?.currency,
          total: report?.total,
          count: report?.count,
          total_profit: report?.total_profit,
          total_uncosted: report?.total_uncosted,
        }
      }).sort((row1, row2) => {
        const date1 = new Date(row1?.timestamp)
        const date2 = new Date(row2?.timestamp)
        if (isNaN(date1 * 1) || isNaN(date2 * 1)) return 0
        if (date1 - date2 !== 0) return date2 - date1
        return String(row1?.currency || '').localeCompare(String(row2?.currency || ''))
      })
    })

    const salesReportTableColumns = computed(() => [
      { name: 'timestamp', label: t('Date'), field: 'timestamp', align: 'left', sortable: true },
      { name: 'currency', label: t('Currency'), field: 'currency', align: 'left', sortable: true },
      { name: 'total', label: t('Sales'), field: 'total', align: 'right', sortable: true },
      { name: 'count', label: t('Transactions'), field: 'count', align: 'right', sortable: true },
      { name: 'total_profit', label: t('Profit', 'Profit'), field: 'total_profit', align: 'right', sortable: true },
      { name: 'total_uncosted', label: t('UncostedSales', 'Uncosted sales'), field: 'total_uncosted', align: 'right', sortable: true },
    ])

    const salesGraphChart = computed(() => {
      const metric = salesGraphMetric.value
      const isCount = metric === 'count'
      const data = {
        options: {
          theme: { mode: $q.dark.isActive ? 'dark' : 'light' },
          xaxis: { categories: [] },
          chart: { width: '100%', height: '100%', toolbar: { show: false } },
          plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
          dataLabels: { enabled: false },
          legend: { position: 'bottom' },
          yaxis: {
            labels: {
              formatter: value => isCount ? formatCount(value) : formatCurrencyAmount(value),
            },
          },
          tooltip: {
            y: {
              formatter: value => isCount ? formatCount(value) : formatCurrencyAmount(value),
            },
          },
        },
        series: [],
      }

      const currencies = []
      groupedSalesGraphData.value.forEach(group => {
        group.summaries.forEach(summary => {
          if (!summary?.currency) return
          if (currencies.indexOf(summary?.currency) >= 0) return
          currencies.push(summary?.currency)
        })
      })

      data.options.xaxis.categories = groupedSalesGraphData.value
        .map(group => group.timestamp)
        .map(timestamp => formatDate(timestamp, salesGraph.value.interval) || timestamp)

      data.series = currencies.map(currency => {
        return {
          name: currency,
          data: groupedSalesGraphData.value.map(group => {
            const summary = group.summaries.find(summary => summary?.currency === currency)
            return Number(summary?.[metric] || 0)
          }),
        }
      })

      if (data.options.xaxis.categories.length > 5) {
        data.options.chart.width = (50 * data.options.xaxis.categories.length) + 'px'
      }

      return data
    })

    async function refreshPage(done) {
      try {
        await Promise.all([
          updateSummary(),
          updateSalesGraph(),
        ])
      } finally {
        done()
      }
    }

    function toNumber(value) {
      if (value === null || value === undefined || value === '') return NaN
      return Number(value)
    }

    /**
     * @param {Number | String} value
     * @param {String} currency
     */
    function formatMoney(value, currency) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '—'
      const text = formatCurrencyAmount(amount)
      return currency ? `${text} ${currency}` : text
    }

    /**
     * @param {Number | String} value
     */
    function formatCount(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount)) return '0'
      return new Intl.NumberFormat(navigator.language).format(amount)
    }

    /**
     * @param {Number | String} value
     */
    function profitColor(value) {
      const amount = toNumber(value)
      if (!Number.isFinite(amount) || amount === 0) return 'text-grey'
      return amount < 0 ? 'text-negative' : 'text-positive'
    }

    /**
     * 
     * @param {String | Date} value 
     * @param {'day' | 'month'} interval 
     */
    function formatDate(value='', interval='day') {
      if (!value) return
      const date = new Date(value)
      if (isNaN(date*1)) return

      const opts = { month: 'short', day: '2-digit', year: 'numeric'}
      if (interval !== 'day') delete opts.day
      const formatter = new Intl.DateTimeFormat(navigator.language, opts)
      return formatter.format(date)
    }

    return {
      summaries,

      selectedProduct,
      selectedVariant,
      showVariantSearchDialog,
      productVariantFilterLabel,
      onProductSelected,
      onVariantSelected,
      clearProductVariantFilter,
      selectProduct,
      selectVariant,

      predefinedRangeOpts,
      salesGraphParams,
      salesGraph,
      salesGraphChart,
      salesGraphMetric,
      salesGraphMetricOptions,
      salesReportRows,
      salesReportTableColumns,
      refreshPage,

      // utils funcs
      formatDate,
      formatCurrencyAmount,
      formatMoney,
      formatCount,
      profitColor,
    }
  },
})
</script>
<style scoped>
::v-deep svg.apexcharts-svg {
  background: inherit !important;
}
</style>
