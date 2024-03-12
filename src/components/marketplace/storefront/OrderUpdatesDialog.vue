<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" full-height>
    <q-card>
      <q-card-section class="q-pb-none">
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Order updates</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <div class="row items-center">
          <q-space/>
          <q-btn
            round flat
            icon="refresh"
            padding="sm"
            @click="() => fetchOrderUpdates()"
          />
        </div>
      </q-card-section>
      <q-list style="max-height: 65vh;overflow: auto;">
        <q-item-label v-if="orderUpdates?.length <= 0 && !fetchingOrderUpdates" header class="text-center">
          No records
        </q-item-label>
        <q-item v-for="orderUpdate in orderUpdates" :key="orderUpdate?.id">
          <q-item-section top>
            <template v-if="orderUpdate?.updateTexts?.length">
              <q-item-label v-for="(text, index) in orderUpdate?.updateTexts" :key="`${orderUpdate?.id}-${index}`">
                {{ text }}
              </q-item-label>
            </template>
            <template v-else>
              <q-item-label> {{ capitalize(orderUpdate?.updateType?.replaceAll('_', ' ')) }}</q-item-label>
              <q-item-label> Previous: {{ orderUpdate?.prevValue }}</q-item-label>
              <q-item-label> New: {{ orderUpdate?.newValue }}</q-item-label>
            </template>
          </q-item-section>
          <q-item-section top side>
            <q-item-label v-if="orderUpdate?.createdBy?.fullName">{{ orderUpdate?.createdBy?.fullName }}</q-item-label>
            <q-item-label v-if="orderUpdate?.createdAt">
              {{ formatDateRelative(orderUpdate?.createdAt) }}
              <q-menu class="q-pa-sm">
                {{ formatTimestampToText(orderUpdate?.createdAt) }}
              </q-menu>
            </q-item-label>
          </q-item-section>
        </q-item>
        <div v-if="fetchingOrderUpdates" class="row items-center justify-center">
          <q-spinner size="1.5em"/>
        </div>
        <div v-if="hasMoreRecords" class="row justify-center items-center q-mt-sm">
          <q-btn flat no-caps label="Load more" @click="fetchOrderUpdates({ append: true })"/>
        </div>
      </q-list>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { OrderUpdates } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { useDialogPluginComponent } from 'quasar'
import { capitalize, defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'OrderUpdatesDialog',
  props: {
    modelValue: Boolean,
    orderId: [Number, String],
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    onMounted(() => fetchOrderUpdates())
    watch(() => [props.orderId], () => fetchOrderUpdates())
    watch(innerVal, () => {
      if (!innerVal.value) return
      if (orderUpdates.value.length) return
      fetchOrderUpdates({ prepend: true }) 
    })

    const fetchingOrderUpdates = ref(false)
    const orderUpdates = ref([].map(OrderUpdates.parse))
    const hasMoreRecords = ref(false)
    function fetchOrderUpdates(opts={append: false, prepend: false}) {
      const params = {
        order_id: props?.orderId,
        limit: 5,
      }
      if (opts?.append && orderUpdates.value.length) {
        params.before = orderUpdates.value.reduce((earliest, orderUpdate) => {
          if (!earliest || orderUpdate?.createdAt < earliest) return orderUpdate?.createdAt
          return earliest
        }, null)
      } else if (opts?.prepend && orderUpdates.value.length) {
        params.after = orderUpdates.value.reduce((latest, orderUpdate) => {
          if (!latest || orderUpdate?.createdAt > latest) return orderUpdate?.createdAt
          return latest
        }, null)
      }

      fetchingOrderUpdates.value = true
      return backend.get(`connecta/order-updates/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          const parsedResults = response?.data?.results?.map(OrderUpdates.parse)
          if (params.before) {
            orderUpdates.value = orderUpdates.value.concat(...parsedResults)
              .filter((e, i, s) => s.findIndex(_e => _e.id === e.id) === i)
            hasMoreRecords.value = parsedResults.length < response?.data?.count
          } else if(params.after) {
            orderUpdates.value = parsedResults.concat(...orderUpdates.value)
              .filter((e, i, s) => s.findIndex(_e => _e.id === e.id) === i)
          } else {
            orderUpdates.value = parsedResults
            hasMoreRecords.value = parsedResults.length < response?.data?.count
          }
          return response
        })
        .finally(() => {
          fetchingOrderUpdates.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      fetchingOrderUpdates,
      orderUpdates,
      hasMoreRecords,
      fetchOrderUpdates,

      // utils funcs
      formatDateRelative,
      formatTimestampToText,
      capitalize,
    }
  },
})
</script>
