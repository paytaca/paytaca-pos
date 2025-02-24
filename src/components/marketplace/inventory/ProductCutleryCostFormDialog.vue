<template>
  <q-dialog
    v-model="innerVal"
    ref="dialogRef"
    @hide="onDialogHide"
    position="bottom"
  >
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="q-space">
            <div class="text-h5">{{ $t("CutleryCost") }}</div>
            <div class="text-caption bottom">{{ product?.name }}</div>
          </div>
          <q-btn flat icon="close" padding="sm" v-close-popup />
        </div>

        <div v-if="fetchingVariants" class="text-center">
          <q-spinner size="3em"/>
          <div>{{ $t('Loading') }}</div>
        </div>
        <q-form v-else-if="formData?.variants?.length" @submit="onSubmit">
          <div v-for="(variantForm, index) in formData?.variants" :key="index">
            <div class="row items-start q-mb-sm">
              <img
                v-if="getVariant(variantForm?.id)?.imageUrl"
                :src="getVariant(variantForm?.id)?.imageUrl"
                height="35"
                style="border-radius: 4px;"
                class="q-mr-sm"
              />
              <div v-if="formData?.variants?.length !== 1">
                <div class="text-grey text-caption top">{{ $t('Variant') }} {{ index+1 }}</div>
                <div>{{ getVariant(variantForm?.id)?.name }}</div>
              </div>
            </div>
            <q-input
              dense
              outlined
              :suffix="marketplaceStore?.currency"
              placeholder="Set cutlery cost"
              v-model.number="variantForm.cutleryCost"
              :rules="[
                val => val >= 0 || 'Invalid amount',
              ]"
              :error="Boolean(formErrors?.update_variants?.[index]?.cutleryCost)"
              :error-message="formErrors?.update_variants?.[index]?.cutleryCost"
            />
          </div>

          <div class="q-mt-sm">
            <q-btn
              no-caps :label="$t('Save')"
              color="brandblue" type="submit" class="full-width"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend';
import { Product } from 'src/marketplace/objects';
import { errorParser } from 'src/marketplace/utils';
import { useMarketplaceStore } from 'src/stores/marketplace';
import { useDialogPluginComponent } from 'quasar';
import { defineComponent, ref, watch, onMounted } from 'vue';

export default defineComponent({
  name: 'ProductCutleryCostFormDialog',
  emits: [
    'update:modelValue',
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    product: Product,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    watch(() => props.modelValue, () => innerVal.value = props.modelValue)

    onMounted(() => innerVal.value ? resetFormData() : null)
    watch(innerVal, () => {
      if (!innerVal.value) return
      resetFormData()
    })
    
    const marketplaceStore = useMarketplaceStore()

    const fetchingVariants = ref(false)
    async function checkAndLoadVariants() {
      if (!Array.isArray(props.product?.variants) || !props.product?.variants?.length) {
        try{
          fetchingVariants.value = true
          await props.product.fetchVariants()
        } finally {
          fetchingVariants.value = false
        }
      }
    }

    const loading = ref(false)
    const formData = ref({
      variants: [].map(() => {
        return {
          id: 0,
          cutleryCost: 0,
        }
      }),
    })
    
    const emptyFormErrors = () => ({
      update_variants: [].map(() => {
        return { cutlery_cost: '' }
      }),
    })

    const formErrors = ref(emptyFormErrors())
    function clearFormErrors() {
      formErrors.value = emptyFormErrors()
    }

    function getVariant(id) {
      return props.product?.variants?.find?.(variant => variant?.id == id)
    }

    async function resetFormData() {
      await checkAndLoadVariants()

      formData.value.variants = props.product?.variants?.map?.(variant => {
        return {
          id: variant?.id, cutleryCost: variant?.cutleryCost
        }
      })
    }

    function onSubmit() {
      const data = {
        update_variants: formData.value.variants.map(variantData => {
          return {
            variant_id: variantData?.id,
            cutlery_cost : parseFloat(variantData?.cutleryCost) || 0,
          }
        })
      }
      loading.value = true
      return backend.patch(`products/${props.product?.id}/`, data)
        .finally(() => clearFormErrors())
        .then(response => {
          if (response?.data?.id !== props.product.id) return Promise.reject({ response })
          onDialogOK(response?.data)
          return Promise.resolve()
        })
        .catch(error => {
          const data = error?.response?.data
          formErrors.value.update_variants = data?.update_variants?.map?.(errorData => {
            return {
              cutleryCost: errorParser.firstElementOrValue(errorData?.cutlery_cost),
            }
          })
        })
    }

    return {
      dialogRef, onDialogCancel, onDialogHide, onDialogOK,
      innerVal,
      marketplaceStore,
      fetchingVariants,
      formData,
      formErrors,
      getVariant,
      onSubmit,
    }
  }
})
</script>