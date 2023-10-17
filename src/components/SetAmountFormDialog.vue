<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" no-refocus position="bottom">
    <q-card class="q-dialog-plugin">
      <q-form @submit="onDialogOK({
        amount,
        isVoucher,
        isPaytaca,
      })">
        <q-card-section class="q-pb-none">
          <div class="text-h5 q-mb-md">Set Amount</div>
          <div v-if="message" class="text-subtitle1 q-mb-sm">
            {{ message }}
          </div>
          <div class="row items-center no-wrap q-gutter-x-sm">
            <q-input
              label="Amount"
              type="number"
              step="0.00000001"
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

        <q-card-section class="q-pa-none">
          <div class="flex justify-center">
            <div class="q-pa-md" v-if="!isVoucher">
              <q-checkbox
                v-model="isPaytaca"
                label="Pay using Paytaca"
                dense
              />
            </div>

            <div class="q-pa-md">
              <q-checkbox
                v-model="isVoucher"
                label="Claim Voucher"
                dense
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions class="row items-center justify-around q-gutter-x-md">
          <q-btn
            no-caps
            color="brandblue"
            size="1rem"
            padding="sm md"
            label="Show Payment QR"
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

    const isVoucher = ref(false)
    const isPaytaca = ref(false)

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

    watch(isVoucher, (newVal) => {
      if (newVal) isPaytaca.value = !newVal
    })
    
    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      amount,
      currencyOpts,
      isVoucher,
      isPaytaca,
    }
  },
})
</script>
