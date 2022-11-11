<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-dialog-plugin">
      <q-form @submit="onDialogOK(amount)">
        <q-card-section>
          <div class="text-h5 q-mb-md">Set amount</div>
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
            outline
            no-caps
            size="1rem"
            padding="sm md"
            color="grey"
            label="Cancel"
            class="q-space"
            @click="onDialogCancel"
          />
          <q-btn
            no-caps
            color="brandblue"
            size="1rem"
            padding="sm md"
            label="Set amount"
            class="q-space"
            type="submit"
          />
        </q-card-actions>
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
      const opts = ['BCH', 'PHP']
      if (initialCurrency && opts.indexOf(initialCurrency) < 0) {
        opts.unshift(initialCurrency)
      }
      return opts
    })
    
    
    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      amount,
      currencyOpts,
    }
  },
})
</script>
