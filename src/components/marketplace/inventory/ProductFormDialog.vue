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
          <div class="text-subtitle1 text-grey q-space">
            {{ $t("Product") }}
          </div>
          <q-btn flat icon="close" padding="sm" v-close-popup />
        </div>
        <q-separator class="q-mb-sm" />
        <q-form @submit="submit" style="max-height: 70vh; overflow: auto">
          <q-banner
            v-if="errors?.detail?.length"
            class="bg-red text-white rounded-borders"
          >
            <div v-if="errors?.detail?.length === 1">
              {{ errors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in errors?.detail" :key="index">
                {{ err }}
              </li>
            </ul>
          </q-banner>
          <UploadImageField
            v-model="formData.imageUrl"
            :loading="loading"
            :disable="loading"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('Name')"
            v-model="formData.name"
            :error="Boolean(errors?.name)"
            :error-message="errors?.name"
            :rules="[(val) => Boolean(val) || $t('Required')]"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('Description')"
            type="textarea"
            v-model="formData.description"
            :error="Boolean(errors?.description)"
            :error-message="errors?.description"
            bottom-slots
          />
          <CategoriesField
            v-model="formData.categories"
            :filterOpts="{
              shop_id: marketplaceStore.activeShopId,
            }"
            :fieldProps="{
              label: $t('Categories'),
              outlined: true,
              dense: true,
              error: Boolean(errors?.categories),
              errorMessage: errors?.categories,
            }"
          />
          <div class="row items-center q-mb-md">
            <div class="text-subtitle1 text-grey q-space">
              {{ $t("Variants") }}
            </div>
            <q-btn flat no-caps :label="$t('AddVariant')" @click="addVariant" />
          </div>
          <TransitionGroup name="fade">
            <div
              v-for="(variant, index) in formData.variants"
              :key="variant._index"
            >
              <template v-if="formData.variants?.length > 1">
                <div class="row">
                  <div class="text-grey q-space">
                    {{
                      $t(
                        'VariantIndex',
                        { index: index + 1 },
                        `Variant ${index + 1}`
                      )
                    }}
                  </div>
                  <q-btn
                    flat
                    icon="delete"
                    padding="xs"
                    color="red"
                    @click="() => removeVariant(variant)"
                  />
                </div>
                <UploadImageField
                  v-model="variant.imageUrl"
                  :loading="loading"
                  :disable="loading"
                />
                <q-input
                  dense
                  outlined
                  :disable="loading"
                  :label="$t('Name')"
                  v-model="variant.name"
                  :error="Boolean(errors?.variants?.[index]?.name)"
                  :error-message="errors?.variants?.[index]?.name"
                  :rules="[(val) => Boolean(val) || $t('Required')]"
                />
              </template>
              <q-input
                dense
                outlined
                :disable="loading"
                :label="$t('Code')"
                v-model="variant.code"
                :error="Boolean(errors?.variants?.[index]?.code)"
                :error-message="errors?.variants?.[index]?.code"
                :rules="[(val) => Boolean(val) || $t('Required')]"
              />
              <q-input
                outlined
                dense
                :disable="loading"
                :label="$t('Price')"
                type="number"
                step="0.001"
                :suffix="marketplaceStore?.currency"
                v-model.number="variant.price"
                :error="Boolean(errors?.variants?.[index]?.price)"
                :error-message="errors?.variants?.[index]?.price"
                :rules="[(val) => (val && val >= 0) || $t('Invalid')]"
              />
              <div class="row">
                <div class="col-6 q-pr-sm">
                  <q-input
                    outlined
                    dense
                    :loading="loading"
                    :label="$t('InitialStock')"
                    type="number"
                    v-model.number="variant.initialStock"
                    :error="Boolean(errors?.variants?.[index]?.initialStock)"
                    :error-message="errors?.variants?.[index]?.initialStock"
                    :rules="[(val) => !val || val >= 0 || $t('Invalid')]"
                  />
                </div>
                <div class="col-6">
                  <q-input
                    outlined
                    dense
                    :loading="loading"
                    :disable="
                      !variant.initialStock || variant.initialStock <= 0
                    "
                    :label="$t('CostPrice')"
                    type="number"
                    step="0.001"
                    :suffix="marketplaceStore?.currency"
                    v-model.number="variant.costPrice"
                    :error="Boolean(errors?.variants?.[index]?.costPrice)"
                    :error-message="errors?.variants?.[index]?.costPrice"
                    :rules="[(val) => val >= 0 || $t('Invalid')]"
                  />
                </div>
              </div>
            </div>
          </TransitionGroup>
          <q-btn
            no-caps
            :label="$t('Save')"
            color="brandblue"
            class="full-width"
            type="submit"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { defineComponent, ref, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useMarketplaceStore } from 'src/stores/marketplace'
import UploadImageField from '../UploadImageField.vue'
import CategoriesField from './CategoriesField.vue'

export default defineComponent({
  name: 'ProductFormDialog',
  components: {
    UploadImageField,
    CategoriesField,
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    initialData: [Product, Object],
    errors: Object,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()

    const innerVal = ref(props.modelValue)
    watch(
      () => [props.modelValue],
      () => (innerVal.value = props.modelValue)
    )
    watch(innerVal, () => $emit("update:modelValue", innerVal.value))

    let variantsRowGenCounter = 0
    function createEmptyVariantRow() {
      return {
        _index: variantsRowGenCounter++,
        imageUrl: '',
        code: '',
        name: '',
        price: null,
        initialStock: null,
        costPrice: null,
      }
    }

    const loading = ref(false)
    const formData = ref({
      name: props.initialData?.name,
      imageUrl: props.initialData?.imageUrl,
      description: props.initialData?.description,
      categories: props.initialData?.categories || [],
      variants:
        props.initialData.variants?.map?.((variant) =>
          Object.assign(createEmptyVariantRow(), {
            imageUrl: variant?.image_url || variant?.imageUrl,
            code: variant?.code,
            name: variant?.name,
            price: variant?.price,
            initialStock: variant?.initialStock,
            costPrice: variant?.costPrice,
          })
        ) || [],
    })

    function addVariant() {
      formData.value.variants.push(createEmptyVariantRow())
    }

    function removeVariant(variant) {
      formData.value.variants = formData.value.variants.filter(
        (_variant) => variant !== _variant
      )
    }

    function submit() {
      onDialogOK(formData.value)
    }

    return {
      dialogRef,
      onDialogHide,
      onDialogOK,
      onDialogCancel,

      marketplaceStore,
      innerVal,
      formData,
      loading,

      addVariant,
      removeVariant,

      submit,
    }
  },
});
</script>
<style scoped>
/* 1. declare transition */
.fade-move,
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}

/* 2. declare enter from and leave to state */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(30px, 0);
}

/* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
/* .fade-leave-active {
  position: absolute;
} */
</style>
