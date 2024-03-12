<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="q-pb-sm">
        <div class="row no-wrap items-center">
          <div class="row items-center q-gutter-x-xs">
            <div class="text-h5">Edit item</div>
          </div>
          <q-space/>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form @submit="() => submit()">
          <q-field
            v-if="!formData?.customItem"
            outlined
            label="Item"
            :model-value="formData?.variant"
            bottom-slots
          >
            <template v-slot:control="ctx">
              <q-item-section
                v-if="ctx?.modelValue?.imageUrl || ctx?.modelValue?.product?.imageUrl"
                avatar top
              >
                <img
                  :src="ctx?.modelValue?.imageUrl || ctx?.modelValue?.product?.imageUrl"
                  style="max-width:50px;"
                  class="rounded-borders"
                />
              </q-item-section>
              <q-item-section top>
                <q-item-label>{{ ctx?.modelValue?.itemName }}</q-item-label>
                <q-item-label v-if="ctx?.modelValue?.price">
                  <template v-if="!marketplaceStore?.currency">Price: </template>
                  {{ ctx?.modelValue?.price }} {{ marketplaceStore?.currency }}
                </q-item-label>
              </q-item-section>
            </template>
          </q-field>
          <q-input
            v-else
            dense
            outlined
            label="Item name"
            v-model="formData.itemName"
            bottom-slots
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <q-input
            dense
            outlined
            label="Price"
            :disable="!formData?.customItem"
            :model-value="formData?.price || formData?.variant?.price"
            :suffix="marketplaceStore?.currency"
            bottom-slots
            @update:modelValue="val => formData.price = Number(val)"
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <q-input
            dense
            outlined
            label="Quantity"
            v-model.number="formData.quantity"
            :rules="[
              val => Boolean(val) || 'Required',
              val => val > 0 || 'Invalid',
            ]"
          />
          <div class="q-mt-sm">
            <q-btn
              no-caps
              label="Update"
              color="brandblue"
              class="full-width"
              type="submit"
            />
          </div>
        </q-form>
      </q-card-section>  
    </q-card>
  </q-dialog>
</template>
<script>
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent } from 'quasar'
import { Variant } from 'src/marketplace/objects'
import { defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'EditSaleItemDialog',
  emits: [
    'update:model-value',
    'submit',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    modelValue: Boolean,
    initialData: Object,
  },
  setup(props, { emit: $emit }) {
    const marketplaceStore = useMarketplaceStore()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    onMounted(() => innerVal.value ? resetFormData() : null)
    watch(innerVal, () => innerVal.value ? resetFormData() : null)
    const formData = ref({
      customItem: false,
      variant: [].map(Variant.parse)[0],
      itemName: '',
      price: 0,
      quantity: 0,
    })
    function resetFormData() {
      formData.value = {
        customItem: props.initialData?.customItem,
        variant: props.initialData?.variant,
        itemName: props.initialData?.itemName,
        price: props.initialData?.price,
        quantity: props.initialData?.quantity,
      }
    }

    function submit() {
      onDialogOK(formData.value)
      $emit('submit', formData.value)
    }

    return {
      marketplaceStore,
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      formData,
      resetFormData,

      submit,
    }
  },
})
</script>

