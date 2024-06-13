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
      <div class="row">
        <div
          v-for="(summary, key) in summaries" :key="key"
          class="col-6 col-sm-4 q-pa-sm"
        >
          <q-card style="height:100%;">
            <q-card-section>
              <div class="row items-center">
                <div class="text-subtitle1">{{ summary?.label }}</div>
                <q-spinner v-if="summary?.loading" class="q-ml-xs"/> 
              </div>
              <template v-if="summary.data?.length">
                <div v-for="(report, index) in summary.data" :key="index">
                  {{ report?.total }} {{ report?.currency }}
                </div>
              </template>
              <div v-else class="text-grey">
                {{ $t('None') }}
              </div>
            </q-card-section>
          </q-card>
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
      <div class="column items-center" style="overflow-x:auto;overflow-y:clip;">
        <VueApexCharts
          class="chart"
          :type="salesGraphChart?.options?.xaxis?.categories?.length > 5 ? 'bar' : 'bar'"
          :options="salesGraphChart.options"
          :series="salesGraphChart.series"
        />
        <!-- <div class="q-px-sm">
          <div v-for="(data, index) in salesGraph?.data" :key="index" class="row">
            <div v-if="salesGraph?.data?.[index-1]?.timestamp != data?.timestamp">
              {{ formatDate(data?.timestamp, salesGraph?.interval) || data?.timestamp }}
            </div>
            <q-space/>
            <div>{{ data?.total }} {{ data?.currency }}</div>
          </div>
        </div> -->
      </div>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import VueApexCharts from "vue3-apexcharts";

export default defineComponent({
  name: 'SalesReportPage',
  components: {
    VueApexCharts,
    MarketplaceHeader,
  },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()

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
      const last7Days =  { from: new Date(), to: new Date(), label: t('Last7days') }
      const last30Days = { from: new Date(), to: new Date(), label: t('Last30days') }

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
          currency: '',
        }
      })
    })

    watch(salesGraphParams, () => updateSalesGraph(), { deep: true })
    onMounted(() => updateSalesGraph())
    function updateSalesGraph() {
      const data = {
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
      const groupedData = [].map(() => {
        return {
          timestamp: '', summaries: [{ currency: '', total: 0, count: 0 }],
        }
      })
      salesGraph.value.data.forEach(data => {
        const group = groupedData.find(g => g?.timestamp == data?.timestamp) || { timestamp: data?.timestamp, summaries: []}
        group.summaries.push({
          currency: data?.currency,
          total: data?.total,
          count: data?.count,
        })
        if (groupedData.indexOf(group) < 0) groupedData.push(group)
      })

      groupedData.reverse()
      return groupedData
    })

    const salesGraphChart = computed(() => {
      const data = {
        options: {
          theme: { mode: $q.dark.isActive ? 'dark' : 'light' },
          xaxis: {
            categories: [1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998],
          },
          chart: { width: '100%', height: '100%' },
        },
        series: [
          {
            name: "series-1",
            data: [30, 40, 45, 50, 49, 60, 70, 81],
          },
          {
            name: "series-2",
            data: [32, 30, 15, 80, 29, 80, 30, 51],
          },
        ],
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
        .map(timestamp => formatDate(timestamp, salesGraph.value.interval))
      
      data.series = currencies.map(currency => {
        return {
          name: currency,
          data: groupedSalesGraphData.value.map(group =>  group.summaries.find(summary => summary?.currency === currency)?.total || null)
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

      predefinedRangeOpts,
      salesGraphParams,
      salesGraph,
      salesGraphChart,
      refreshPage,

      // utils funcs
      formatDate,
    }
  },
})
</script>
<style scoped>
::v-deep svg.apexcharts-svg {
  background: inherit !important;
}
</style>
