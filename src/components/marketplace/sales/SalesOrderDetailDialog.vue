<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="row no-wrap items-start q-pb-sm">
        <div class="q-space row items-center q-gutter-x-xs">
          <div class="text-h5">Sale</div>
          <div class="text-grey">#{{ salesOrder?.id }}</div>
        </div>
        <slot name="menu" v-bind="{ salesOrder }"></slot>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div v-if="salesOrder?.number" class="q-mb-sm">
          <div>SO#{{ salesOrder?.number }}</div>
          <div class="text-caption bottom text-grey">Sales Order</div>
        </div>
        <div v-if="!isNaN(salesOrder.createdAt)" class="q-mb-sm">
          <div>{{ formatTimestampToText(salesOrder.createdAt) }}</div>
          <div class="text-caption bottom text-grey">Created at</div>
        </div>
        <div v-if="salesOrder?.createdBy?.id" class="q-mb-sm">
          <div>{{ salesOrder?.createdBy?.firstName }} {{ salesOrder?.createdBy?.lastName }}</div>
          <div class="text-caption bottom text-grey">Created by</div>
        </div>
        <div v-if="salesOrder?.$state?.updating" class="row items-center justify-center">
          <q-spinner size="3em"/>
        </div>
        <div
          v-for="item in salesOrder.items" :key="item?.variant?.id"
          class="row items-center no-wrap q-gutter-x-sm q-mb-sm"
        >
          <div class="q-space row items-center no-wrap text-weight-medium">
            <template v-if="item?.variant?.id">
              <img
                v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                style="width:50px;"
                class="rounded-borders q-mr-sm"
              />
              <div>
                {{ item?.variant?.product?.name }}
                <template v-if="item?.variant?.name">
                  - {{ item?.variant?.name }}
                </template>
              </div>
            </template>
            <template v-else>
              {{ item?.itemName }}
            </template>
          </div>
          <div class="col-3 col-sm-2">
            {{ item?.price }} {{ salesOrder?.currency?.symbol }}
          </div>
          <div class="col-2 col-sm-1">
            <div class="row no-wrap items-center">
              <span>x{{ item.quantity }}</span>
            </div>
          </div>
        </div>
      </q-card-section>
      <!-- {{ salesOrder }} -->
    </q-card>
  </q-dialog>
</template>
<script>
import { SalesOrder } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import { formatTimestampToText } from 'src/marketplace/utils'

export default defineComponent({
  name: 'SalesOrderDetailDialog',

  emits: [
    'update:model-value',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    modelValue: Boolean,
    salesOrder: SalesOrder,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      // utils funcs
      formatTimestampToText,
    }
  },
})
</script>
