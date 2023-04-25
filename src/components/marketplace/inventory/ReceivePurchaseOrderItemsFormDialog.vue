<template>
  <q-dialog
    ref="dialogRef" 
    full-width
    position="bottom" 
    :persistent="loading"
    v-model="innerVal"
    @hide="onDialogHide"
    @before-show="() => syncInitialSelected()"
  >
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
import { computed, defineComponent, onMounted, ref, watch } from 'vue'

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
    initialSelectedIds: Array,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))

    const loading = ref(false)
    const selected = ref([])
    function syncInitialSelected() {
      selected.value = props.initialSelectedIds
    }
    function toggleSelected(item=PurchaseOrderItem.parse()) {
      const itemId = item?.id
      const index = selected.value.indexOf(itemId)
      if (index >= 0) selected.value.splice(index, 1)
      else selected.value.push(itemId)
    }
    const selectedItems = computed(() => {
      return props.purchaseOrder.items.filter(item => selected.value.indexOf(item.id) >= 0)
    })

    function markItemsReceived() {
      const now = new Date()
      const data = {
        update_items: selectedItems.value.filter(item => !item.deliveredAt).map(item => {
          return {
            purchase_order_item_id: item.id,
            delivered_at: now,
          }
        })
      }
      loading.value = true
      backend.patch(`purchase-orders/${props.purchaseOrder.id}/items/`, data)
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
      syncInitialSelected,
      toggleSelected,
      markItemsReceived,
    }
  },
})
</script>
