<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="row no-wrap items-start q-pb-sm">
        <div class="q-space row items-center q-gutter-x-xs">
          <div class="text-h5">Purchase Order</div>
          <div v-if="purchaseOrder?.id" class="text-grey">#{{ purchaseOrder?.id }}</div>
        </div>
        <slot name="menu" v-bind="{ purchaseOrder }"></slot>
      </q-card-section>
      <q-card-section v-if="purchaseOrder?.$state?.loading" class="row items-center justify-center">
        <q-spinner size="2.5em"/>
      </q-card-section>
      <template v-else>
        <q-card-section class="q-pb-none row">
          <div class="col-6 col-sm-4 q-pa-sm">
            <div class="text-caption top text-grey">Purchase Order #</div>
            <div>PO#{{ purchaseOrder?.number }}</div>
          </div>
          <div class="col-6 col-sm-4 q-pa-sm">
            <div class="text-caption top text-grey">Status</div>
            <div>{{ formatPurchaseOrderStatus(purchaseOrder?.status) }}</div>
          </div>
          <div class="q-space q-pa-sm">
            <div class="text-caption top text-grey">Vendor</div>
            <div>{{ purchaseOrder.vendor.name }}</div>
            <div v-if="purchaseOrder.vendor?.location?.formatted" class="text-caption bottom">
              {{ purchaseOrder.vendor?.location?.formatted }}
            </div>
          </div>
          <div v-if="purchaseOrder.reviewedAt" class="q-space q-pa-sm">
            <div class="text-caption top text-grey">Reviewed</div>
            <div>
              {{ purchaseOrder?.reviewedBy?.firstName }}
              {{ purchaseOrder?.reviewedBy?.lastName }}
            </div>
            <div v-if="purchaseOrder.reviewedAt">
              {{ formatTimestampToText(purchaseOrder.reviewedAt) }}
            </div>
          </div>
          <div v-if="purchaseOrder.createdAt || purchaseOrder?.createdBy?.id" class="q-space q-pa-sm">
            <div class="text-caption top text-grey">Created</div>
            <div>
              {{ purchaseOrder?.createdBy?.firstName }}
              {{ purchaseOrder?.createdBy?.lastName }}
            </div>
            <div v-if="purchaseOrder.createdAt">
              {{ formatTimestampToText(purchaseOrder.createdAt) }}
            </div>
          </div>
        </q-card-section>
        <q-card-section class="q-pb-none">
          <div class="text-h6">Items</div>
        </q-card-section>
        <q-list>
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
