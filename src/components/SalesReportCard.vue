<template>
  <q-card class="q-space q-pa-md column">
      <div class="row items-center">
        <div class="text-subtitle1">{{ title }}</div>
        <q-badge :label="salesReport.count" class="q-ml-xs"/>
        <q-space/>
      </div>
      <div class="column justify-center q-space">
        <div class="text-weight-medium">{{ formatNumberAutoDecimals(salesReport.total) }} BCH</div>
        <div v-if="salesReport?.tokenAmounts?.length" class="text-caption q-r-mt-sm q-mb-xs">
          + {{ salesReport?.tokenAmounts?.length }}
          {{ salesReport?.tokenAmounts?.length === 1 ? $t('Token') : $t('Tokens') }}
        </div>
        <div v-if="(salesReport.currency && salesReport.totalMarketValue)" class="text-caption" style="margin-top:-0.5em;">
          {{ formatNumberAutoDecimals(salesReport.totalMarketValue) }} {{ salesReport.currency }}
        </div>
      </div>
      <q-menu v-if="salesReport?.tokenAmounts?.length" class="q-pa-md">
        <div
          v-for="amountData in salesReport?.tokenAmounts" :key="amountData?.category"
          class="row items-center justify-between no-wrap q-gutter-sm"
        >
          <div>{{ formatTokenAmount(amountData) }}</div>
          <div>
            <q-btn
              flat icon="content_copy"
              padding="sm" size="sm"
              @click="() => copyToClipboard(amountData?.category)"
            />
          </div>
        </div>
      </q-menu>
  </q-card>
</template>
<script>
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useQuasar } from 'quasar'
import { defineComponent, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatNumberAutoDecimals } from 'src/utils/number-format'

export default defineComponent({
  name: 'SalesReportCard',
  props: {
    title: String,
    salesReport: {
      type: Object,
      default: () => ({
        total: 0,
        tokenAmounts: [].map(() => {
          return { category: '', amount: 0 }
        }),
        totalMarketValue: 0,
        currency: 0,
        count: 0,
      })
    },
  },
  setup() {
    const $q = useQuasar();
    const { t: $t } = useI18n();
    const cashtokenStore = useCashtokenStore();

    /**
     * @param { {category: String, amount: Number} } amountData
     */
    function formatTokenAmount(amountData) {
      const tokenMetadata = cashtokenStore.getTokenMetadata(amountData?.category)
      if (!tokenMetadata) return `${amountData.amount} ${$t('Token')}`

      const decimals = parseInt(tokenMetadata?.decimals) || 0;
      const symbol = tokenMetadata?.symbol;
      const amount = amountData.amount / 10 ** decimals;
      return `${formatNumberAutoDecimals(amount)} ${symbol}`;
    }

    const $copyText = inject('$copyText');
    function copyToClipboard(value, message='') {
      $copyText(value).then(() => {
        $q.notify({
          message: message || $t('CopiedToClipboard'),
          timeout: 800,
          icon: 'mdi-clipboard-check',
          color: 'blue-9'
        })
      })
      .catch(() => {})
    }


    return {
      formatTokenAmount,
      copyToClipboard,
      formatNumberAutoDecimals,
    }
  }
})
</script>
