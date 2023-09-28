<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="q-pb-sm">
        <div class="row no-wrap items-start">
          <div class="q-space row items-center q-gutter-x-xs">
            <div class="text-h5">
              Purchase Order
              <template v-if="purchaseOrder?.number">#{{ purchaseOrder?.number }}</template>
            </div>
          </div>
          <slot name="menu" v-bind="{ purchaseOrder }"></slot>
        </div>
        <div class="row items-center">
          <div v-if="purchaseOrder?.createdAt" class="text-caption bottom text-grey">
            {{ formatTimestampToText(purchaseOrder?.createdAt) }}
            <q-menu class="q-pa-sm">
              Created at {{ formatTimestampToText(purchaseOrder?.createdAt) }}
            </q-menu>
          </div>
          <q-space/>
          <div v-if="purchaseOrder?.createdBy?.id" class="text-caption bottom text-grey">
            {{ purchaseOrder?.createdBy?.fullName }}
            <q-menu class="q-pa-sm">
              Created by {{ purchaseOrder?.createdBy?.fullName }}
            </q-menu>
          </div>
        </div>
      </q-card-section>
      <q-card-section v-if="purchaseOrder?.$state?.loading" class="row items-center justify-center">
        <q-spinner size="2.5em"/>
      </q-card-section>
      <template v-else>
        <q-card-section class="q-py-none row q-px-sm">
          <div class="col-6 col-sm-4 q-px-sm q-pb-xs">
            <div class="text-caption top text-grey">Status</div>
            <div>{{ formatPurchaseOrderStatus(purchaseOrder?.status) }}</div>
          </div>
          <div class="q-space q-px-sm q-pb-xs">
            <div class="text-caption top text-grey">Vendor</div>
            <div>{{ purchaseOrder.vendor.name }}</div>
            <div v-if="purchaseOrder.vendor?.location?.formatted" class="text-caption bottom" style="line-height:1.5em;">
              {{ purchaseOrder.vendor?.location?.formatted }}
            </div>
          </div>
          <div v-if="purchaseOrder.reviewedAt" class="q-space q-px-sm q-pb-xs">
            <div class="text-caption top text-grey">Reviewed</div>
            <div>{{ purchaseOrder?.reviewedBy?.fullName }}</div>
            <div v-if="purchaseOrder.reviewedAt" class="text-caption bottom">
              {{ formatTimestampToText(purchaseOrder.reviewedAt) }}
            </div>
          </div>
        </q-card-section>
        <q-card-section class="q-pb-none">
          <div class="text-h6">Items</div>
        </q-card-section>
        <q-list class="q-mb-md">
          <q-item
            v-for="item in purchaseOrder.items"
            :key="item?.id"
          >
            <q-item-section v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl" side>
              <img
                :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                style="width:50px;"
                class="rounded-borders"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ item?.variant?.product?.name }}
                <template v-if="item?.variant?.name">
                  - {{ item?.variant?.name }}
                </template>
              </q-item-label>
              <q-item-label class="text-caption">
                {{ item?.quantity }} x
                {{ item?.costPrice }} {{ purchaseOrder?.currency?.symbol }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <slot name="bottom"></slot>
      </template>
    </q-card>
  </q-dialog>
</template>
<script>
import { PurchaseOrder } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import { formatPurchaseOrderStatus, formatTimestampToText } from 'src/marketplace/utils'

export default defineComponent({
  name: 'PurchaseOrderDetailDialog',

  emits: [
    'update:model-value',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    modelValue: Boolean,
    purchaseOrder: PurchaseOrder,
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
      formatPurchaseOrderStatus,
    }
  },
})
</script>
