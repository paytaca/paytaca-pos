<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-subtitle1 text-grey q-space">Product</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-separator class="q-mb-sm"/>
        <q-form @submit="submit" style="max-height:70vh;overflow:auto;">
          <q-banner v-if="errors?.detail?.length" class="bg-red text-white rounded-borders">
            <div v-if="errors?.detail?.length === 1">
              {{ errors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in errors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>
          <UploadImageField v-model="formData.imageUrl" :loading="loading" :disable="loading"/>
          <q-input
            dense
            outlined
            :disable="loading"
            label="Name"
            v-model="formData.name"
            :error="Boolean(errors?.name)"
            :error-message="errors?.name"
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            label="Description"
            type="textarea"
            v-model="formData.description"
            :error="Boolean(errors?.description)"
            :error-message="errors?.description"
            bottom-slots
          />
          <q-select
            dense
            outlined
            :disable="loading"
            label="Categories"
            multiple
            use-chips
            use-input
            new-value-mode="add-unique"
            behavior="menu"
            :options="categoriesOpts"
            v-model="formData.categories"
            @new-value="(inputValue, done) => done(inputValue)"
            @filter="categoriesFilter"
            :error="Boolean(errors?.categories)"
            :error-message="errors?.categories"
            bottom-slots
          />
          <div class="row items-center q-mb-md">
            <div class="text-subtitle1 text-grey q-space">Variants</div>
            <q-btn flat no-caps label="Add variant" @click="addVariant"/>
          </div>
          <TransitionGroup name="fade">
            <div v-for="(variant, index) in formData.variants" :key="variant._index">
              <template v-if="formData.variants?.length > 1">
                <div class="row">
                  <div class="text-grey q-space">Variant {{ index + 1 }}</div>
                  <q-btn flat icon="delete" padding="xs" color="red" @click="() => removeVariant(variant)"/>
                </div>
                <UploadImageField v-model="variant.imageUrl" :loading="loading" :disable="loading"/>
                <q-input
                  dense
                  outlined
                  :disable="loading"
                  label="Name"
                  v-model="variant.name"
                  :error="Boolean(errors?.variants?.[index]?.name)"
                  :error-message="errors?.variants?.[index]?.name"
                  :rules="[
                    val => Boolean(val) || 'Required',
                  ]"
                />
              </template>
              <q-input
                dense
                outlined
                :disable="loading"
                label="Code"
                v-model="variant.code"
                :error="Boolean(errors?.variants?.[index]?.code)"
                :error-message="errors?.variants?.[index]?.code"
                :rules="[
                  val => Boolean(val) || 'Required',
                ]"
              />
              <q-input
                outlined
                dense
                :disable="loading"
                label="Price"
                type="number"
                step="0.001"
                :suffix="marketplaceStore?.currency"
                v-model.number="variant.price"
                :error="Boolean(errors?.variants?.[index]?.price)"
                :error-message="errors?.variants?.[index]?.price"
                :rules="[
                  val => val && val >= 0 || 'Invalid',
                ]"
              />
              <div class="row">
                <div class="col-6 q-pr-sm">
                  <q-input
                    outlined
                    dense
                    :loading="loading"
                    label="Initial Stock"
                    type="number"
                    v-model.number="variant.initialStock"
                    :error="Boolean(errors?.variants?.[index]?.initialStock)"
                    :error-message="errors?.variants?.[index]?.initialStock"
                    :rules="[
                      val => !val || val >= 0 || 'Invalid',
                    ]"
                  />
                </div>
                <div class="col-6">
                  <q-input
                    outlined
                    dense
                    :loading="loading"
                    :disable="!variant.initialStock || variant.initialStock <= 0"
                    label="Cost price"
                    type="number"
                    step="0.001"
                    :suffix="marketplaceStore?.currency"
                    v-model.number="variant.costPrice"
                    :error="Boolean(errors?.variants?.[index]?.costPrice)"
                    :error-message="errors?.variants?.[index]?.costPrice"
                    :rules="[
                      val => val >= 0 || 'Invalid',
                    ]"
                  />
                </div>
              </div>
            </div>
          </TransitionGroup>
          <q-btn
            no-caps
            label="Save"
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

export default defineComponent({
  name: 'ProductFormDialog',
  components: {
    UploadImageField,
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
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const categoriesOpts = ref([].map(String))
    function categoriesFilter(val, done) {
      const params = {
        s: val,
        shop_id: marketplaceStore.activeShopId,
        limit: 5,
      }

      backend.get(`product-categories/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          done(() => {
            categoriesOpts.value = response?.data?.results.map(category => category?.name).filter(Boolean)
          })
          return response
        })
        .catch(() => {
          done(() => {
            categoriesOpts.value = []
          })
        })
    }

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
      variants: props.initialData.variants?.map?.(variant => Object.assign(
        createEmptyVariantRow(),
        {
          imageUrl: variant?.image_url || variant?.imageUrl,
          code: variant?.code,
          name: variant?.name,
          price: variant?.price,
          initialStock: variant?.initialStock,
          costPrice: variant?.costPrice,
        }
      )) || []
    })

    function addVariant() {
      formData.value.variants.push(createEmptyVariantRow())
    }

    function removeVariant(variant) {
      formData.value.variants = formData.value.variants.filter(_variant => variant !== _variant)
    }

    function submit() {
      onDialogOK(formData.value)
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,

      marketplaceStore,
      innerVal,
      categoriesOpts,
      categoriesFilter,
      formData,
      loading,

      addVariant,
      removeVariant,

      submit,
    }
  },
})
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
