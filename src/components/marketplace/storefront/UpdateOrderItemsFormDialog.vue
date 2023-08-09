<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Update Items</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form @submit="() => submit()">

          <q-btn
            flat padding="none md"
            no-caps label="Reset"
            class="text-underline q-r-ml-lg q-mb-sm"
            @click="() => resetFormData()"
          />
          <div
            v-for="orderItem in formData?.items" :key="orderItem?.variant?.id"
            class="q-mb-md"
          >
            <div class="row items-start no-wrap q-r-mx-sm">
              <div class="q-space row items-center justify-left no-wrap q-pa-xs">
                <q-img
                  v-if="orderItem?.variant?.itemImage"
                  :src="orderItem?.variant?.itemImage"
                  width="35px"
                  ratio="1"
                  class="rounded-borders q-mr-xs"
                />
                <div>{{ orderItem?.variant?.itemName }}</div>
              </div>
              <q-btn
                flat
                :disable="loading"
                icon="delete"
                color="red"
                padding="xs"
                @click="() => formData.items = formData.items.filter(item => item !== orderItem)"
              />
            </div>
            <div class="q-pa-xs q-r-mx-sm">
              <q-input
                dense outlined
                :disable="loading"
                label="Quantity"
                type="number"
                v-model.number="orderItem.quantity"
                hide-bottom-space
                :rules="[
                  val => val > 0 || 'Invalid',
                ]"
              />
            </div>
            <div class="row items-center no-wrap q-r-mx-sm">
              <div class="q-pa-xs">
                <q-input
                  dense outlined
                  :disable="loading"
                  label="Price"
                  :placeholder="orderItem?.variant?.price"
                  :suffix="orderCurrency"
                  type="number"
                  v-model.number="orderItem.price"
                />
              </div>
              <div class="q-pa-xs">
                <q-input
                  dense outlined
                  :disable="loading"
                  label="Markup price"
                  :placeholder="orderItem?.variant?.markupPrice"
                  :suffix="orderCurrency"
                  type="number"
                  v-model.number="orderItem.markupPrice"
                />
              </div>
            </div>
          </div>
          <q-btn
            no-caps
            :disable="loading"
            label="Add Item"
            class="full-width"
            @click="() => showVariantSearchDialog = true"
          />
  
          <q-separator spaced/>
  
          <q-btn
            no-caps
            :disable="loading"
            label="Update"
            color="brandblue"
            class="full-width"
            type="submit"
          />
        </q-form>
      </q-card-section>
    </q-card>

    <VariantSearchDialog
      v-model="showVariantSearchDialog"
      @ok="onVariantSelected"
      :excludeVariantIds="formData.items.map(item => item?.variant?.id).filter(Boolean)"
      hide-scanner
      :extra-filter-args="{ storefront_id: order?.storefrontId }"
    />
  </q-dialog>
</template>
<script>
import { Order, Variant } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import VariantSearchDialog from '../sales/VariantSearchDialog.vue'
import { backend } from 'src/marketplace/backend'

export default defineComponent({
  name: 'UpdateOrderItemsFormDialog',
  components: {
    VariantSearchDialog,
  },
  props: {
    modelValue: Boolean,
    order: Order,
  },
  emits: [
    'update:modelValue',
    'updated-items',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    onMounted(() => resetFormData())
    watch(innerVal, () => innerVal.value ? resetFormData() : null)

    const orderCurrency = computed(() => props?.order?.currency?.symbol)

    const loading = ref(false)
    const formData = ref({
      items: [].map(() => {
        return {
          variant: Variant.parse(),
          quantity: 0,
          price: 0,
          markupPrice: 0,
        }
      })
    })

    function resetFormData() {
      formData.value.items = props.order?.items?.map?.(item => {
        return {
          variant: item.variant,
          quantity: item.quantity,
          price: item.price,
          markupPrice: item.markupPrice,
        }
      }) || []
    }

    const showVariantSearchDialog = ref(false)
    function onVariantSelected(variant=Variant.parse()) {
      if (!variant?.id) return

      const index = formData.value.items.findIndex(item => item?.variant?.id == variant?.id)
      if (index >= 0) return

      formData.value.items.push({
        variant: variant,
        quantity: 1,
        price: variant?.price,
        markupPrice: variant?.markupPrice,
      })
    }

    function submit() {
      const orderId = props.order?.id
      const data = {
        items: formData.value.items.map(item => {
          return {
            variant_id: item?.variant?.id,
            quantity: item?.quantity,
            price: item?.price || undefined,
            markup_price: item?.markupPrice || undefined,
          }
        })
      }

      loading.value = true
      return backend.patch(`connecta/orders/${orderId}/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $emit('updated-items', response?.data)
          return response
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      orderCurrency,
      loading,
      formData,
      resetFormData,

      showVariantSearchDialog,
      onVariantSelected,

      submit,
    }
  },
})
</script>
