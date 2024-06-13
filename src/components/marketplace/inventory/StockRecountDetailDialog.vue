<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="row no-wrap items-start q-pb-sm">
        <div class="q-space row items-center q-gutter-x-xs">
          <div class="text-h5">{{ $t('StockRecount') }}</div>
          <div v-if="stockRecount?.id" class="text-grey">#{{ stockRecount?.id }}</div>
        </div>
        <slot name="menu" v-bind="{ stockRecount }"></slot>
      </q-card-section>
      <q-card-section v-if="stockRecount?.$state?.loading" class="row items-center justify-center">
        <q-spinner size="2.5em"/>
      </q-card-section>
      <template v-else>
        <q-card-section class="q-pb-none row">
          <div v-if="stockRecount.remarks" class="col-12">
            <div class="text-caption top text-grey">{{ $t('Remarks') }}</div>
            <div>{{ stockRecount.remarks }}</div>
          </div>
          <div v-if="stockRecount.createdAt || stockRecount?.createdBy?.id">
            <div class="text-caption top text-grey">{{ $t('Created') }}</div>
            <div>{{ stockRecount?.createdBy?.fullName }}</div>
            <div v-if="stockRecount.createdAt">
              {{ formatTimestampToText(stockRecount.createdAt) }}
            </div>
          </div>
        </q-card-section>
        <q-card-section class="q-pb-none row">
          <div class="text-subtitle1">{{ $t('UpdatedStocks') }}</div>
        </q-card-section>
        <q-list>
          <q-item v-for="item in stockRecount.items" :key="item?.id">
            <q-item-section top>
              <q-item-label>
                {{
                  $t(
                    'StockId',
                    { id: item?.stockId }
                    `Stock#${item?.stockId}`
                  )
                }}
              </q-item-label>
              <q-item-label class="text-caption">
                {{ item?.remarks }}
              </q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-item-label>
                {{
                  $t(
                    'ExpectedQty',
                    { quantity: item?.expectedQuantity },
                    `Expected: ${item?.expectedQuantity}`
                  )
                }}
              </q-item-label>
              <q-item-label>
                {{
                  $t(
                    'ActualQty',
                    { quantity: item?.actualQuantity },
                    `Actual: ${item?.actualQuantity}`
                  )
                }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </template>
    </q-card>
  </q-dialog>
</template>
<script>
import { StockRecount } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import { formatTimestampToText } from 'src/marketplace/utils'

export default defineComponent({
  name: 'StockRecountDetailDialog',
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    modelValue: Boolean,
    stockRecount: StockRecount,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      // utils funcs
      formatTimestampToText,
    }
  },
})
</script>
