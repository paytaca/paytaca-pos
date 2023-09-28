<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" no-refocus position="bottom">
    <q-card class="q-dialog-plugin">
      <q-form @submit="onDialogOK({
        amount,
        voucher
      })">
        <q-card-section>
          <div class="text-h5 q-mb-md">{{ finalTitle }}</div>
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
        <q-card-actions class="row items-center justify-around q-gutter-x-md">
          <q-btn
            no-caps
            color="brandblue"
            size="1rem"
            padding="sm md"
            label="Receive Payment"
            class="q-space"
            type="submit"
          />
        </q-card-actions>

        <div v-if="supportsVoucher">
          <div class="flex row q-ma-sm">
            <q-btn
              no-caps
              color="brandblue"
              size="1rem"
              padding="sm md"
              label="Claim Voucher"
              class="q-space"
              type="submit"
              @click="voucher = true"
            />
          </div>
        </div>
      </q-form>
    </q-card>
  </q-dialog>
</template>
<script>
import { computed, defineComponent, ref } from 'vue'
import { useDialogPluginComponent } from 'quasar'


export default defineComponent({
  name: 'SetAmountFormDialog',
  props: {
    initialValue: Object,
    currencies: Array,
    title: String,
    message: String,
    supportsVoucher: Boolean,
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
    const voucher = ref(false)
    const currencyOpts = computed(() => {
      const initialCurrency = props?.initialValue?.currency
      let opts = ['BCH', 'PHP']
      if (Array.isArray(props.currencies)) opts = [...props.currencies]
      if (initialCurrency && opts.indexOf(initialCurrency) < 0) {
        opts.unshift(initialCurrency)
      }
      return opts
    })

    const finalTitle = computed(() => {
      if (props?.supportsVoucher) return 'Pay or Claim Voucher'
      return props?.title || 'Set Amount'
    })
    
    
    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      amount,
      currencyOpts,
      finalTitle,
      voucher,
    }
  },
})
</script>
