<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">

    <q-card>
      <q-card-section class="q-pb-none">
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Payments</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <div v-if="payments?.length" class="q-r-mx-md">
          <q-item v-for="payment in payments" :key="payment?.id">
            <q-item-section top>
              <q-item-label>
                {{ capitalize(payment?.status).replaceAll('_', ' ') }}
              </q-item-label>
              <q-item-label caption>
                {{ formatDateRelative(payment?.createdAt) }}
              </q-item-label>
            </q-item-section>
            <q-item-section avatar top>
              <q-item-label>
                {{ payment?.amount }} {{ payment?.currency?.symbol }}
              </q-item-label>
              <q-item-label caption>
                ~ {{ payment?.bchAmount }} BCH
              </q-item-label>
            </q-item-section>
          </q-item>
        </div>
        <div v-else class="text-center text-grey q-my-md">
          No payments
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { Payment } from 'src/marketplace/objects'
import { formatDateRelative } from 'src/marketplace/utils'
import { useDialogPluginComponent } from 'quasar'
import { capitalize, defineComponent, ref, watch } from 'vue'

export default defineComponent({
  name: 'OrderPaymentsDialog',
  props: {
    modelValue: Boolean,
    payments: Array,
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

    
    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      // utils funcs
      formatDateRelative, capitalize,
    }
  },
})
</script>
<style lang="scss" scoped>
.q-r-mx-md {
  margin-left: -(map-get($space-md, 'x'))/2;
  margin-right: -(map-get($space-md, 'x'))/2;
}
</style>
