<template>
  <q-card class="q-space q-pa-md column">
      <div class="row items-center">
        <div class="text-subtitle1">{{ title }}</div>
        <q-badge :label="salesReport.count" class="q-ml-xs"/>
      </div>
      <div class="column justify-center q-space">
        <div class="text-weight-medium">{{ salesReport.total }} BCH</div>
        <div v-if="(salesReport.currency && salesReport.totalMarketValue)" class="text-caption" style="margin-top:-0.5em;">
          {{ salesReport.totalMarketValue }} {{ salesReport.currency }}
        </div>
      </div>
  </q-card>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'SalesReportCard',
  props: {
    title: String,
    salesReport: {
      type: Object,
      default: () => ({
        total: 0,
        totalMarketValue: 0,
        currency: 0,
        count: 0,
      })
    },
  },
})
</script>
