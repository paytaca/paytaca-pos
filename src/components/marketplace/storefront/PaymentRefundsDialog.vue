<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div>
            <div class="text-h5">Refunds</div>
            <div class="text-caption bottom text-grey">Payment #{{ payment?.id }}</div>
          </div>
          <q-space/>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-linear-progress v-if="fetchingRefunds" :color="$q.dark.isActive ? 'white' : 'brandblue'" query/>
        <q-list dense separator>
          <q-item v-for="refund in payment?.refunds" :key="refund?.id">
            <q-item-section>
              <q-item-label>
                <div class="row items-center">
                  <div>{{ refund?.totalAmount }} {{ payment?.currency?.symbol }}</div>
                  <q-icon name="info_outline" class="q-ml-xs"/>
                </div>
                <q-menu class="q-pa-sm">
                  <div class="row items-center">
                    <div class="q-mr-xs">Amount</div>
                    <q-space/>
                    <div>{{ refund?.amount }} {{ payment?.currency?.symbol }}</div>
                  </div>

                  <div class="row items-center">
                    <div class="q-mr-xs">Delivery fee</div>
                    <q-space/>
                    <div>{{ refund?.deliveryFee }} {{ payment?.currency?.symbol }}</div>
                  </div>

                  <div class="row items-center">
                    <div class="q-mr-xs">Markup amount</div>
                    <q-space/>
                    <div>{{ refund?.markupAmount }} {{ payment?.currency?.symbol }}</div>
                  </div>
                </q-menu>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label>
                {{ formatDateRelative(refund?.createdAt) }}
                <q-menu class="q-pa-sm text-caption">
                  {{ formatTimestampToText(refund?.createdAt) }}
                </q-menu>
              </q-item-label>
            </q-item-section>
            <q-item-section side class="q-r-mr-md q-pa-xs">
              <q-icon name="more_vert"/>
              <q-menu>
                <q-item clickable v-close-popup @click="() => deleteRefund(refund)">
                  <q-item-section>
                    <q-item-label>
                      Remove refund
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-menu>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { Payment, Refund } from 'src/marketplace/objects'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import { formatTimestampToText, formatDateRelative, errorParser } from 'src/marketplace/utils'
import { backend } from 'src/marketplace/backend'


export default defineComponent({
  name: 'PaymentRefundsDialog',
  props: {
    modelValue: Boolean,
    payment: Payment,
  },
  emits: [
    'update:modelValue',
    'updated',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const $q = useQuasar()

    const fetchingRefunds = ref(false)
    watch(innerVal, () => {
      if(!innerVal.value) return

      fetchingRefunds.value = true
      props.payment.fetchRefunds()
        .finally(() => {
          fetchingRefunds.value = false
        })
    })

    function deleteRefund(refund=Refund.parse()) {
      if (!refund?.id) return

      fetchingRefunds.value = true
      return backend.delete(`connecta/refunds/${refund?.id}/`)
        .then(() => {
          $emit('updated')
          return Promise.all([
            props.payment.refetch(),
            props.payment.fetchRefunds(),
          ])
        })
        .catch(error => {
          $q.notify({
            type: 'negative',
            message: 'Unable to remove refund',
            caption: errorParser?.firstElementOrValue(error?.response?.data?.detail) || '',
          })
        })
        .finally(() => {
          fetchingRefunds.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      fetchingRefunds,

      deleteRefund,

      // utils funcs
      formatTimestampToText, formatDateRelative,
    }
  },
})
</script>
