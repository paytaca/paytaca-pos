<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" :persistent="loading">
    <q-card>
      <q-card-section>
        <div class="text-h6">Receive Items</div>
      </q-card-section>
      <q-list>
        <q-item
          v-for="item in purchaseOrder.items"
          :key="item?.id"
          clickable
          @click="() => toggleSelected(item)"
        >
          <q-item-section side>
            <q-checkbox v-if="item?.deliveredAt" disable :model-value="true"/>
            <q-checkbox
              v-else
              v-model="selected"
              :val="item.id"
            />
          </q-item-section>
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
      <q-card-section>
        <q-btn
          :loading="loading"
          :disable="loading"
          no-caps
          label="Update"
          color="brandblue"
          class="full-width"
          @click="() => markItemsReceived()"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { useDialogPluginComponent } from 'quasar'
import { backend } from 'src/marketplace/backend'
import { PurchaseOrder, PurchaseOrderItem } from 'src/marketplace/objects'
import { defineComponent, ref, watch } from 'vue'

export default defineComponent({
  name: 'ReceivePurchaseOrderItemsFormDialog',
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
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))

    const loading = ref(false)
    const selected = ref([])
    function toggleSelected(item=PurchaseOrderItem.parse()) {
      const itemId = item?.id
      const index = selected.value.indexOf(itemId)
      if (index >= 0) selected.value.splice(index, 1)
      else selected.value.push(itemId)
    }

    function markItemsReceived() {
      const data = {
        item_ids: selected.value,
      }
      loading.value = true
      backend.post(`purchase-orders/${props.purchaseOrder.id}/receive/`, data)
        .then(response => {
          props.purchaseOrder.refetch()
          onDialogOK(response?.data)
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      loading,
      selected,
      toggleSelected,
      markItemsReceived,
    }
  },
})
</script>
