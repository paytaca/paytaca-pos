<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" full-height>
    <q-card>
      <q-card-section class="q-pb-none">
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Purchase order history</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <div class="row items-center">
          <q-space/>
          <q-btn
            round flat
            icon="refresh"
            padding="sm"
            @click="() => fetchPurchaseOrderUpdates()"
          />
        </div>
      </q-card-section>
      <q-list style="max-height: 65vh;overflow: auto;">
        <q-item-label v-if="purchaseOrderUpdates?.length <= 0 && !fetchingPurchaseOrderUpdates" header class="text-center">
          No records
        </q-item-label>
        <q-item v-for="purchaseOrderUpdate in purchaseOrderUpdates" :key="purchaseOrderUpdate?.id">
          <q-item-section top>
            <template v-if="purchaseOrderUpdate?.updateTexts?.length">
              <q-item-label v-for="(text, index) in purchaseOrderUpdate?.updateTexts" :key="`${purchaseOrderUpdate?.id}-${index}`">
                {{ text }}
              </q-item-label>
            </template>
            <template v-else>
              <q-item-label> {{ capitalize(purchaseOrderUpdate?.updateType?.replaceAll('_', ' ')) }}</q-item-label>
              <q-item-label> Previous: {{ purchaseOrderUpdate?.prevValue }}</q-item-label>
              <q-item-label> New: {{ purchaseOrderUpdate?.newValue }}</q-item-label>
            </template>
          </q-item-section>
          <q-item-section top side>
            <q-item-label v-if="purchaseOrderUpdate?.createdBy?.fullName">{{ purchaseOrderUpdate?.createdBy?.fullName }}</q-item-label>
            <q-item-label v-if="purchaseOrderUpdate?.createdAt">
              {{ formatDateRelative(purchaseOrderUpdate?.createdAt) }}
              <q-menu class="q-pa-sm">
                {{ formatTimestampToText(purchaseOrderUpdate?.createdAt) }}
              </q-menu>
            </q-item-label>
          </q-item-section>
        </q-item>
        <div v-if="fetchingPurchaseOrderUpdates" class="row items-center justify-center">
          <q-spinner size="1.5em"/>
        </div>
        <div v-if="hasMoreRecords" class="row justify-center items-center q-mt-sm">
          <q-btn flat no-caps label="Load more" @click="fetchPurchaseOrderUpdates({ append: true })"/>
        </div>
      </q-list>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { PurchaseOrderUpdates } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { useDialogPluginComponent } from 'quasar'
import { capitalize, defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'PurchaseOrderUpdatesDialog',
  props: {
    modelValue: Boolean,
    purchaseOrderId: [Number, String],
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

    onMounted(() => fetchPurchaseOrderUpdates())
    watch(() => [props.purchaseOrderId], () => fetchPurchaseOrderUpdates())
    watch(innerVal, () => {
      if (!innerVal.value) return
      if (purchaseOrderUpdates.value.length) return
      fetchPurchaseOrderUpdates({ prepend: true }) 
    })

    const fetchingPurchaseOrderUpdates = ref(false)
    const purchaseOrderUpdates = ref([].map(PurchaseOrderUpdates.parse))
    const hasMoreRecords = ref(false)
    function fetchPurchaseOrderUpdates(opts={append: false, prepend: false}) {
      const params = {
        purchase_order_id: props?.purchaseOrderId,
        limit: 5,
      }
      if (opts?.append && purchaseOrderUpdates.value.length) {
        params.before = purchaseOrderUpdates.value.reduce((earliest, purchaseOrderUpdate) => {
          if (!earliest || purchaseOrderUpdate?.createdAt < earliest) return purchaseOrderUpdate?.createdAt
          return earliest
        }, null)
      } else if (opts?.prepend && purchaseOrderUpdates.value.length) {
        params.after = purchaseOrderUpdates.value.reduce((latest, purchaseOrderUpdate) => {
          if (!latest || purchaseOrderUpdate?.createdAt > latest) return purchaseOrderUpdate?.createdAt
          return latest
        }, null)
      }

      fetchingPurchaseOrderUpdates.value = true
      return backend.get(`purchase-order-updates/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          const parsedResults = response?.data?.results?.map(PurchaseOrderUpdates.parse)
          if (params.before) {
            purchaseOrderUpdates.value = purchaseOrderUpdates.value.concat(...parsedResults)
              .filter((e, i, s) => s.findIndex(_e => _e.id === e.id) === i)
            hasMoreRecords.value = parsedResults.length < response?.data?.count
          } else if(params.after) {
            purchaseOrderUpdates.value = parsedResults.concat(...purchaseOrderUpdates.value)
              .filter((e, i, s) => s.findIndex(_e => _e.id === e.id) === i)
          } else {
            purchaseOrderUpdates.value = parsedResults
            hasMoreRecords.value = parsedResults.length < response?.data?.count
          }
          return response
        })
        .finally(() => {
          fetchingPurchaseOrderUpdates.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      fetchingPurchaseOrderUpdates,
      purchaseOrderUpdates,
      hasMoreRecords,
      fetchPurchaseOrderUpdates,

      // utils funcs
      formatDateRelative,
      formatTimestampToText,
      capitalize,
    }
  },
})
</script>
