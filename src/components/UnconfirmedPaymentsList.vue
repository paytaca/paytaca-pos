<template>
  <div>
    <div
      v-for="(payment, index) in unconfirmedPayments" :key="index"
      class="q-pt-sm q-mt-sm q-pb-xs q-mb-xs q-px-sm"
    >
      <div
        class="row items-center" 
        style="position:relative" v-ripple
        @click="copyToClipboard(payment.address, 'Address copied to clipboard')"
      >
        <div class="q-space">
          <div class="text-weight-medium">{{ ellipsisText(payment.address, { start: 15, end: 5 }) }}</div>
          <div v-if="payment?.amount" class="text-body2 text-weight-medium">
            {{ payment?.amount }} {{ payment?.parameters?.currency || 'BCH' }}
          </div>
          <div v-if="Number.isFinite(Number(payment?.parameters?.ts))" class="text-caption text-grey" style="margin-top:-0.25em;">
            {{ formatDate(payment.parameters.ts * 1000) }}
          </div>
        </div>
        <div>
          <q-btn
            flat
            round
            icon="delete"
            color="red"
            padding="sm"
            @click.stop
          />
        </div>
      </div>
      <q-separator/>
    </div>
  </div>
</template>
<script>
import ago from 's-ago'
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'UnconfirmedPaymentsList',
  props: {
    unconfirmedPayments: Array,
  },
  methods: {
    ellipsisText (value, config) {
      const _config = Object.assign({
        start: 15,
        end: 10,
      }, config)
      _config.breakLength = _config.start + _config.end - 5
      if (typeof value !== 'string') return ''
      if (value.length <= _config.breakLength) return value
      return value.substr(0, _config.start) + '...' + value.substr(value.length - _config.end, value.length)
    },
    formatDate (date) {
      return ago(new Date(date))
    },
    formatTimestampToText(timestamp) {
      const dateObj = new Date(timestamp)
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(dateObj)
    },
    copyToClipboard(value, message='') {
      this.$copyText(value)
        .then(() => {
          this.$q.notify({
            message: message || 'Copied to clipboard',
            timeout: 800,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        })
        .catch(() => {})
    }
  },
})
</script>
