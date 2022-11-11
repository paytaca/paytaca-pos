<template>
  <div
    v-if="txCacheStore.unconfirmedPayments.length"
    class="row items-center q-px-md q-py-sm no-wrap shadow-4 rounded-borders"
    style="position:relative;"
    v-ripple
    @click="showList = true"
  >
    <div class="q-space">
      <div class="text-subtitle2">Unconfirmed Payment</div>
      <div v-if="txCacheStore.lastUnconfirmedPayment">
        <div class="row items-center no-wrap">
          <div class="q-space q-mr-xs">
            {{ ellipsisText(txCacheStore.lastUnconfirmedPayment.address, { start: 15, end: 10 }) }}
          </div>
          <div v-if="txCacheStore.lastUnconfirmedPayment?.amount" class="text-body2 text-weight-medium">
            {{ txCacheStore.lastUnconfirmedPayment?.amount }} {{ txCacheStore.lastUnconfirmedPayment?.parameters?.currency || 'BCH' }}
          </div>
        </div>
        <div class="row items-center">
          <div
            v-if="Number.isFinite(Number(txCacheStore.lastUnconfirmedPayment?.parameters?.ts))"
            class="text-grey q-space"
          >
            {{ formatDate(Number(txCacheStore.lastUnconfirmedPayment.parameters.ts) * 1000) }}
          </div>
          <div v-if="txCacheStore.unconfirmedPayments.length > 1" class="text-grey text-right">
            {{ txCacheStore.unconfirmedPayments.length-1 }} more
          </div>
        </div>
      </div>
      <div v-else>
        {{ txCacheStore.unconfirmedPayments.length }} unconfirmed {{ txCacheStore.unconfirmedPayments.length>1 ? 'payments' : 'payment' }}
      </div>
    </div>
    <!-- <div>
      <q-btn
        flat
        :label="'View ' + (txCacheStore.unconfirmedPayments.length-1) + ' more'"
        class="full-width"
        padding=""
      />
    </div> -->
    <q-dialog v-model="showList">
      <q-card class="full-width">
        <q-card-section>
          <UnconfirmedPaymentsList
            :unconfirmed-payments="txCacheStore.unconfirmedPayments"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import ago from 's-ago'
import { defineComponent, ref } from 'vue'
import { useTxCacheStore } from 'src/stores/tx-cache'
import UnconfirmedPaymentsList from 'src/components/UnconfirmedPaymentsList.vue'

export default defineComponent({
  name: 'UnconfirmedPaymentsPanel',
  components: {
    UnconfirmedPaymentsList,
  },
  setup() {
    const txCacheStore = useTxCacheStore()
    const showList = ref(false)

    function ellipsisText (value, config) {
      const _config = Object.assign({
        start: 15,
        end: 10,
      }, config)
      _config.breakLength = _config.start + _config.end - 5
      if (typeof value !== 'string') return ''
      if (value.length <= _config.breakLength) return value
      return value.substr(0, _config.start) + '...' + value.substr(value.length - _config.end, value.length)
    }

    function formatDate (date) {
      return ago(new Date(date))
    }
    return {
      txCacheStore,
      showList,
      ellipsisText,
      formatDate,
    }
  },
})
</script>
