<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" no-refocus position="bottom">
    <q-card class="q-dialog-plugin">
      <q-form @submit="checkAmount()">
        <q-card-section>
          <div class="q-mb-md">
            <div class="text-h5">{{ $t('SetAmount') }}</div>
          </div>
          <div v-if="message" class="text-subtitle1 q-mb-sm">
            {{ message }}
          </div>
          <div class="row items-center no-wrap q-gutter-x-sm">
            <q-input
              :label="$t('Amount')"
              type="number"
              :step="amount.currency === 'BCH' ? 0.00000001 : 0.01"
              v-model.number="amount.value"
              outlined
              autofocus
              clearable
              class="q-space"
            />
            <q-select
              outlined
              v-model="amount.currency"
              :options="currencyOpts"
            />
          </div>
        </q-card-section>

        <q-card-actions class="row items-center justify-around q-gutter-x-md">
          <q-btn
            no-caps
            color="brandblue"
            size="1rem"
            padding="sm md"
            :label="$t('CreatePaymentQR')"
            class="q-space"
            type="submit"
            icon="mdi-qrcode"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
<script>
import { computed, defineComponent, ref, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'


export default defineComponent({
  name: 'SetAmountFormDialog',
  props: {
    initialValue: Object,
    currencies: Array,
    title: String,
    message: String,
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const amount = ref({
      value: props?.initialValue?.amount || null,
      currency: props?.initialValue?.currency || 'BCH',
    })
    const currencyOpts = computed(() => {
      const initialCurrency = props?.initialValue?.currency
      let opts = ['BCH']
      if (Array.isArray(props.currencies)) opts = [...props.currencies]
      if (initialCurrency && opts.indexOf(initialCurrency) < 0) {
        opts.unshift(initialCurrency)
      }
      return opts
    })

    function checkAmount () {
      if (amount.value.currency !== 'BCH' && amount.value.value < 1) {
        onDialogCancel()
        return
      }
      onDialogOK({ amount: amount.value })
    }
    
    return {
      dialogRef,
      checkAmount,
      onDialogHide,
      onDialogOK,
      onDialogCancel,
      amount,
      currencyOpts,
    }
  },
})
</script>
