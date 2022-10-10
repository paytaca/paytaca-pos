<template>
  <div>
    <div
      v-for="(tx, index) in transactions.history" :key="index"
      class="q-pt-sm q-mt-sm q-pb-xs q-mb-xs q-px-sm"
      style="position:relative" v-ripple
    >
      <div class="row items-center">
        <div class="q-space">
          <div class="text-weight-medium">{{ recordTypeMap[tx.record_type] }}</div>
          <div class="text-subtitle text-grey">{{ formatDate(tx.date_created) }}</div>
        </div>
        <div class="text-body2 text-weight-medium">
          {{ tx.amount }} BCH
        </div>
      </div>
      <q-separator/>
    </div>
  </div>
</template>
<script>
import ago from 's-ago'
import { defineComponent, ref } from 'vue'

export default defineComponent({
  props: {
    transactions: Object,
  },
  data() {
    return {
      recordTypeMap: {
        incoming: 'RECEIVED',
        outgoing: 'SENT'
      },
    }
  },
  methods: {
    formatDate (date) {
      return ago(new Date(date))
    },
  },
})
</script>
