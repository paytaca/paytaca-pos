<template>
  <q-dialog v-model="innerValue" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="text-h6">
          Stocks
        </div>
      </q-card-section>
      <q-virtual-scroll
        :items="stocks"
        class="q-px-sm q-mb-md"
        style="max-height:65vh; overflow:auto;"
        v-slot="{ item: stock }"
      >
        <q-item>
          <q-item-section class="q-gutter-y-sm">
            <q-item-label class="text-subtitle1">{{ stock?.itemName }}</q-item-label>
            <div class="row items-start q-mt-xs q-gutter-x-md q-gutter-y-sm">
              <div>
                <q-item-label class="text-caption" style="margin-bottom:-0.5em;">Quantity</q-item-label>
                <q-item-label>{{ stock.quantity || 0 }}</q-item-label>
              </div>
              <div v-if="stock.costPrice">
                <q-item-label class="text-caption" style="margin-bottom:-0.5em;">Cost Price</q-item-label>
                <q-item-label>{{ stock.costPrice }} {{ marketplaceStore?.currency  }}</q-item-label>
              </div>
              <div v-if="stock.shop?.name">
                <q-item-label class="text-caption" style="margin-bottom:-0.5em;">Shop</q-item-label>
                <q-item-label>{{ stock.shop?.name }}</q-item-label>
              </div>
            </div>
            <div class="row items-start q-mt-xs q-gutter-x-md q-gutter-y-sm">
              <div v-if="stock?.createdAt">
                <q-item-label class="text-caption" style="margin-bottom:-0.5em;">Created</q-item-label>
                <q-item-label>{{ formatDateRelative(stock?.createdAt) }}</q-item-label>
                <q-menu class="q-py-sm q-px-md">
                  {{ formatTimestampToText(stock.createdAt) }}
                </q-menu>
              </div>
              <div v-if="stock?.updatedAt">
                <q-item-label class="text-caption" style="margin-bottom:-0.5em;">Updated</q-item-label>
                <q-item-label>{{ formatDateRelative(stock?.updatedAt) }}</q-item-label>
                <q-menu class="q-py-sm q-px-md">
                  {{ formatTimestampToText(stock.updatedAt) }}
                </q-menu>
              </div>
            </div>
          </q-item-section>
        </q-item>
        <q-separator inset/>
      </q-virtual-scroll>
    </q-card>
  </q-dialog>
</template>
<script>
import { formatDateRelative, formatTimestampToText } from "src/marketplace/utils";
import { Stock } from 'src/marketplace/objects'
import { defineComponent, ref, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useMarketplaceStore } from "src/stores/marketplace";

export default defineComponent({
  name: 'StocksListViewDialog',
  emits: [
    'update:model-value',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    stocks: { default: () => [].map(Stock.parse)},
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()

    const innerValue = ref(props.modelValue)
    watch(innerValue, () => $emit('update:model-value', innerValue.value))
    watch(() => props.modelValue, () => innerValue.value = props.modelValue)

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      marketplaceStore,
      innerValue,
      // utils funcs
      formatDateRelative, formatTimestampToText,
    }
  }
})
</script>
