<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Edit Product</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <div v-if="fetchingProduct" class="row justify-center items-center q-py-lg">
      <q-spinner size="5em"/>
    </div>
    <div v-else-if="fetchProductSuccess === false" class="text-center">
      Unable to fetch product
    </div>
    <q-form v-else ref="form" @submit="() => updateProduct()" class="q-mt-lg q-gutter-y-lg">
      <div class="row items-center justify-end">
        <q-btn
          :outline="$q.dark.isActive"
          label="Delete product" color="red"
          @click="() => confirmDeleteProduct()"
        />
      </div>
      <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders">
        <div v-if="formErrors?.detail?.length === 1">
          {{ formErrors.detail[0] }}
        </div>
        <ul v-else class="q-pl-md">
          <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
        </ul>
      </q-banner>
      <q-card>
        <q-card-section class="q-gutter-y-xs">
          <div class="text-subtitle1 q-mb-sm">Product description</div>
          <UploadImageField v-model="formData.imageUrl" :disable="loading" :loading="loading"/> 
          <div>Name*</div>
          <q-input
            dense
            outlined
            :disable="loading"
            :loading="loading"
            v-model="formData.name"
            :error="Boolean(formErrors?.name)"
            :error-message="formErrors?.name"
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <div>Description</div>
          <q-input
            dense
            outlined
            :disable="loading"
            :loading="loading"
            type="textarea"
            v-model="formData.description"
            :error="Boolean(formErrors?.name)"
            :error-message="formErrors?.name"
          />
          <div>Categories</div>
          <q-select
            dense
            outlined
            multiple
            use-chips
            use-input
            new-value-mode="add-unique"
            behavior="menu"
            :options="categoriesOpts"
            v-model="formData.categories"
            :error="Boolean(formErrors?.categories)"
            :error-message="formErrors?.categories"
            @new-value="(inputValue, done) => done(inputValue)"
            @filter="categoriesFilter"
          >
            <template v-slot:before-options="props">
              {{ props }}
            </template>
          </q-select>
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section>
          <q-slide-transition>
            <div v-if="formData.variants.length > 1" class="text-subtitle1 q-mb-sm">
              Variants
              <span class="text-grey">[{{ computedFormData.variants.count }}]</span>
            </div>
          </q-slide-transition>
          <div v-for="(variant, index) in formData.variants" :key="index">
            <q-banner v-if="variantErrorAt(index)?.detail?.length" class="bg-red text-white rounded-borders">
              <div v-if="variantErrorAt(index)?.detail?.length === 1">
                {{ variantErrorAt(index)?.detail[0] }}
              </div>
              <ul v-else class="q-pl-md">
                <li v-for="(err, index) in variantErrorAt(index)?.detail" :key="index">{{err}}</li>
              </ul>
            </q-banner>
            <q-slide-transition>
              <div v-if="(formData.variants.length > 1 || computedFormData.variants.add.length > 0)">
                <div class="row items-center">
                  <div class="text-grey q-space" :class="{ 'text-strike': variant.remove }">
                    <template v-if="variant.remove">(Delete)</template>
                    Variant {{ index + 1 }}
                    <template v-if="variant.obj.name">
                      - {{ variant.obj.name }}
                    </template>
                  </div>
                  <q-btn
                    :disable="(!variant.remove && computedFormData.variants.count <= 1) || loading"
                    flat
                    :icon="variant.remove ? 'restore_from_trash' : 'delete'"
                    @click="() => variant.remove = !variant.remove"
                  />
                </div>
                <template v-if="!variant.remove">
                  <UploadImageField v-model="variant.imageUrl" :loading="loading" :disable="loading"/> 
                  <div>Variant Name*</div>
                  <q-input
                    outlined
                    dense
                    :disable="loading"
                    :loading="loading"
                    v-model.number="variant.name"
                    :error="Boolean(variantErrorAt(index)?.name)"
                    :error-message="variantErrorAt(index)?.name"
                    :rules="[
                      val => Boolean(val) || 'Required',
                    ]"
                  />
                </template>
              </div>
            </q-slide-transition>
            <template v-if="!variant.remove">
              <div>Code</div>
              <q-input
                outlined
                dense
                :disable="loading"
                :loading="loading"
                v-model.number="variant.code"
                :error="Boolean(variantErrorAt(index)?.code)"
                :error-message="variantErrorAt(index)?.code"
              />

              <div>Price*</div>
              <q-input
                outlined
                dense
                :disable="loading"
                :loading="loading"
                type="number"
                :suffix="marketplaceStore?.currency"
                v-model.number="variant.price"
                :error="Boolean(variantErrorAt(index)?.price)"
                :error-message="variantErrorAt(index)?.price"
                :rules="[
                  val => val > 0 || 'Invalid price',
                ]"
              />
            </template>
            <q-separator spaced/>
          </div>
          <TransitionGroup name="fade">
            <div v-for="(variant, index) in formData.newVariants" :key="variant._index">
              <q-slide-transition>
                <div v-if="computedFormData.variants.count > 1">
                  <div class="row items-center">
                    <div class="text-grey q-space">
                      New Variant {{ index + 1 }}
                    </div>
                    <q-btn
                      flat icon="delete"
                      :disable="loading"
                      :loading="loading"
                      @click="() => formData.newVariants.splice(index, 1)"
                    />
                  </div>
                  <UploadImageField v-model="variant.imageUrl" :loading="loading" :disable="loading"/> 
                  <div>Variant Name*</div>
                  <q-input
                    outlined
                    dense
                    :disable="loading"
                    :loading="loading"
                    v-model.number="variant.name"
                    :error="Boolean(newVariantErrorAt(index)?.name)"
                    :error-message="newVariantErrorAt(index)?.name"
                    :rules="[
                      val => Boolean(val) || 'Required',
                    ]"
                  />
                </div>
              </q-slide-transition>
              <div>Code</div>
              <q-input
                outlined
                dense
                :disable="loading"
                :loading="loading"
                v-model.number="variant.code"
                :error="Boolean(newVariantErrorAt(index)?.code)"
                :error-message="newVariantErrorAt(index)?.code"
              />

              <div>Price*</div>
              <q-input
                outlined
                dense
                :disable="loading"
                :loading="loading"
                type="number"
                :suffix="marketplaceStore?.currency"
                v-model.number="variant.price"
                :error="Boolean(newVariantErrorAt(index)?.price)"
                :error-message="newVariantErrorAt(index)?.price"
                :rules="[
                  val => val > 0 || 'Invalid price',
                ]"
              />

              <div class="row">
                <div class="col-6 q-pr-sm">
                  <div>Initial Stock</div>
                  <q-input
                    outlined
                    dense
                    :disable="loading"
                    :loading="loading"
                    type="number"
                    v-model.number="variant.initialStock"
                    :error="Boolean(newVariantErrorAt(index)?.initialStock)"
                    :error-message="newVariantErrorAt(index)?.initialStock"
                    :rules="[
                      val => val >= 0 || 'Invalid',
                    ]"
                  />
                </div>
                <div class="col-6">
                  <div>Cost Price</div>
                  <q-input
                    outlined
                    dense
                    :loading="loading"
                    :disable="variant.initialStock <= 0 || loading"
                    type="number"
                    :suffix="marketplaceStore?.currency"
                    v-model.number="variant.costPrice"
                    :error="Boolean(newVariantErrorAt(index)?.costPrice)"
                    :error-message="newVariantErrorAt(index)?.costPrice"
                    :rules="[
                      val => val >= 0 || 'Invalid',
                    ]"
                  />
                </div>
              </div>
              <q-separator spaced/>
            </div>
          </TransitionGroup>

          <div v-if="!loading" class="q-mt-md">
            <q-btn
              no-caps
              color="brandblue"
              label="Add Variant"
              class="full-width"
              @click="() => addVariant()"
            />
          </div>
        </q-card-section>
      </q-card>

      <div>
        <q-btn
          :loading="loading"
          :disable="loading"
          color="brandblue"
          no-caps
          label="Update Product"
          type="submit"
          class="full-width"
        />
      </div>
    </q-form>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product, Variant } from 'src/marketplace/objects'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { computed, defineComponent, onMounted, ref } from 'vue'
import UploadImageField from 'src/components/marketplace/UploadImageField.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

/**
 * For constructing update payload.
 * unchanged values are set to undefined since it doesnt need to be included in update payload
*/
function undefinedOrUpdated(newVal, oldVal) {
  return newVal != oldVal ? newVal : undefined
}

export default defineComponent({
  components: {
    MarketplaceHeader,
    UploadImageField,
  },
  props: {
    productId: [Number, String]
  },
  setup(props) {
    const marketplaceStore = useMarketplaceStore()
    const $q = useQuasar()
    const $router = useRouter()

    const product = ref(Product.parse())
    const fetchingProduct = ref(false)
    const fetchProductSuccess = ref(null) // null | false | true
    onMounted(() => {
      fetchProduct().then(() => resetFormData())
    })
    function fetchProduct() {
      fetchingProduct.value = true
      return backend.get(`products/${props.productId}/`)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          product.value.raw = response.data
          fetchProductSuccess.value = true
          return response
        })
        .catch(() => {
          fetchProductSuccess.value = false
        })
        .finally(() => {
          fetchingProduct.value = false
        })
    }

    let newVariantRowGenCounter = 0
    function createEmptyNewVariant() {
      return {
        _index: newVariantRowGenCounter++,
        imageUrl: null,
        code: '',
        name: '',
        price: null,
        initialStock: null,
        costPrice: null,
      }
    }

    const loading = ref(false)
    const formData = ref({
      imageUrl: '',
      name: '',
      description: '',
      categories: [],
      variants: [{
        obj: Variant.parse(null),
        remove: false,
        id: 0,
        imageUrl: '',
        code: '',
        name: '',
        price: 0,
      }],
      newVariants: [createEmptyNewVariant()],
    })
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

    const computedFormData = computed(() => {
      const data = {
        variants: {
          update: formData.value.variants,
          add: [],
          count: 0,
        },
      }

      data.variants.update = data.variants.update.map((variantData, formDataIndex) => {
        const baseUpdateData = {variant_id: variantData.obj.id, formDataIndex }
        if (variantData.remove) return { remove: true, ...baseUpdateData }
        return {
          ...baseUpdateData,
          code: undefinedOrUpdated(variantData.code, variantData.obj.code),
          name: undefinedOrUpdated(variantData.name, variantData.obj.name),
          price: undefinedOrUpdated(variantData.price, variantData.obj.price),
          image_url: undefinedOrUpdated(variantData.imageUrl || "", variantData.obj.imageUrl),
        }
      }).filter(updateData => {
        return updateData.code !== undefined ||
               updateData.name !== undefined ||
               updateData.price !== undefined ||
               updateData.image_url !== undefined || 
               updateData.remove !== undefined
      })

      data.variants.add = formData.value.newVariants.map(variantData => {
        return {
          image_url: variantData.imageUrl || "",
          code: variantData.code,
          name: variantData.name,
          price: variantData.price,
          initial_stock: variantData.initialStock || undefined,
          cost_price: variantData.costPrice || undefined,
        }
      })

      const variantsCount = formData.value.variants.length
      const toRemoveCount = data.variants.update.filter(updateData => updateData?.remove).length
      const newVariantsCount = formData.value.newVariants.length
      data.variants.count = (variantsCount - toRemoveCount) + newVariantsCount
      return data
    })

    function resetFormData() {
      formData.value.imageUrl = product.value.imageUrl
      formData.value.name = product.value.name
      formData.value.description = product.value.description
      if (!Array.isArray(product.value.categories)) formData.value.categories = []
      else formData.value.categories = [...product.value.categories]
      formData.value.variants = product.value.variants.map(variant => {
        return {
          obj: variant,
          remove: false,
          id: variant.id,
          code: variant.code,
          imageUrl: variant.imageUrl,
          name: variant.name,
          price: variant.price,
        }
      })

      formData.value.newVariants = []
      resetFormErrors()
    }

    const formErrors = ref({
      detail: [],
      name: '',
      description: '',
      categories: '',
      variants: [{
        detail: [],
        code: '',
        name: '',
        price: '',
      }],
      newVariants: [{
        detail: [],
        code: '',
        name: '',
        price: '',
        initialStock: '',
        costPrice: '',
      }]
    })
    function variantErrorAt(index) {
      return formErrors.value?.variants?.[index]
    }
    
    function newVariantErrorAt(index) {
      return formErrors.value?.newVariants?.[index]
    }

    function resetFormErrors() {
      formErrors.value.name = ''
      formErrors.value.description = ''
      formErrors.value.variants = []
      formErrors.value.newVariants = []
    }

    function addVariant() {
      formData.value.newVariants.push(createEmptyNewVariant())
    }

    function updateProduct() {
      const data = {
        name: undefinedOrUpdated(formData.value.name, product.value.name),
        description: undefinedOrUpdated(formData.value.description, product.value.description),
        categories: formData.value.categories,
        image_url: undefinedOrUpdated(formData.value.imageUrl || "", product.value.imageUrl),
        update_variants: computedFormData.value.variants.update,
        add_variants: computedFormData.value.variants.add,
      }

      const updateVariantIndexMap = {}
      data.update_variants.map((updateData, index) => {
        updateVariantIndexMap[index] = updateData.formDataIndex
        delete updateData.formDataIndex
      })

      loading.value = true
      backend.patch(`products/${product.value.id}/`, data)
        .finally(() => resetFormErrors())
        .then(() => {
          $q.dialog({
            title: 'Product updated!',
            ok: true,
          }).onOk(() => {
            $router.back()
          })
        })
        .catch(error => {
          if (error?.response?.data) {
            const data = error?.response?.data
            formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
            formErrors.value.name = errorParser.firstElementOrValue(data?.name)
            formErrors.value.description = errorParser.firstElementOrValue(data?.description)
            formErrors.value.categories = errorParser.firstElementOrValue(data?.categories)

            if (Array.isArray(data?.update_variants)) {
              data?.update_variants.forEach((variantError, index) => {
                const formDataIndex = updateVariantIndexMap[index]
                formErrors.value.variants[formDataIndex] = {
                  detail: errorParser.toArray(variantError?.non_field_errors),
                  code: errorParser.firstElementOrValue(variantError?.code),
                  name: errorParser.firstElementOrValue(variantError?.name),
                  price: errorParser.firstElementOrValue(variantError?.price),
                }
              })
            }

            if (Array.isArray(data?.add_variants)) {
              data?.add_variants.forEach((variantError, index) => {
                formErrors.value.newVariants[index] = {
                  detail: errorParser.toArray(variantError?.non_field_errors),
                  code: errorParser.firstElementOrValue(variantError?.code),
                  name: errorParser.firstElementOrValue(variantError?.name),
                  price: errorParser.firstElementOrValue(variantError?.price),
                  initialStock: errorParser.firstElementOrValue(variantError?.initial_stock),
                  costPrice:  errorParser.firstElementOrValue(variantError?.cost_price),
                }
              })
            }

            if (Array.isArray(data)) formErrors.value.detail = data
            if (data?.detail) formErrors.value.detail = [data?.detail]
          }

          if (!formData.value.detail?.length) {
            formData.value.detail = ['Encountered errors in updating product']
          }
        })
        .finally(() => {
          loading.value = false
        })
    }

    function confirmDeleteProduct() {
      $q.dialog({
        title: `Delete '${product.value?.name}'`,
        message: `Delete product '${product.value.name}'. Are you sure?`,
        ok: {
          noCaps: true,
          label: 'Delete',
          color: 'red',
          padding: 'xs lg',
        },
        cancel: {
          noCaps: true,
          flat: true,
          color: 'grey',
          padding: 'xs lg',
        },
      })
        .onOk(() => deleteProduct())
    }

    function deleteProduct() {
      const dialog = $q.dialog({
        title: 'Deleting product',
        progress: true,
        persistent: true,
        ok: false,
      })
      backend.delete(`products/${product.value.id}/`)
        .then(() => {
          dialog.update({ title: 'Product deleted' })
            .onDismiss(() => $router.go(-1))
        })
        .catch(error => {
          dialog.update({
            title: 'Error',
            message: error?.response?.data?.detail || 'Encountered error in deleting product',
          })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: true })
        })
    }

    return {
      marketplaceStore,
      product,
      fetchingProduct,
      fetchProductSuccess,

      loading,
      formData,
      categoriesOpts,
      categoriesFilter,
      computedFormData,

      formErrors,
      variantErrorAt,
      newVariantErrorAt,

      addVariant,
      updateProduct,

      confirmDeleteProduct,
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