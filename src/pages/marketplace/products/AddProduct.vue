<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Add Product</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-form ref="form" @submit="() => addProduct()" class="q-mt-lg q-gutter-y-lg">
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

          <UploadImageField v-model="formData.imageUrl" :loading="loading" :disable="loading"/>
          <div>Name*</div>
          <q-input
            dense
            outlined
            :loading="loading"
            :disable="loading"
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
            :loading="loading"
            :disable="loading"
            type="textarea"
            v-model="formData.description"
            :error="Boolean(formErrors?.description)"
            :error-message="formErrors?.description"
          />
          <div>Categories</div>
          <CategoriesField
            v-model="formData.categories"
            :filterOpts="{
              shop_id: marketplaceStore.activeShopId,
            }"
            :fieldProps="{
              outlined: true,
              dense: true,
              error: Boolean(formErrors?.categories),
              errorMessage: formErrors?.categories,
            }"
          />
          <div class="row items-center">
            <div class="text-subtitle1">Cart options</div>
            <q-space/>
            <q-icon
              size="1.5em"
              name="help"
            >
              <q-menu class="q-pa-sm text-body2">
                Additional details customers must provide when adding to cart
              </q-menu>
            </q-icon>
          </div>
          <div class="row items-center q-r-mx-sm">
            <div class="full-width q-pa-xs q-mb-sm">
              <q-btn
                no-caps label="Configure"
                icon="edit"
                color="brandblue"
                class="full-width"
                @click="() => openPropertiesSchemaOptions()"
              />
            </div>
            <template v-if="Boolean(formData.cartOptions)">
              <div class="col-6 q-pa-xs">
                <q-btn
                  outline
                  no-caps label="Preview"
                  icon="preview"
                  color="brandblue"
                  class="full-width"
                  @click="() => showCartOptionsPreview = !showCartOptionsPreview"
                />
              </div>
  
              <div class="col-6 q-pa-xs">
                <q-btn
                  outline
                  no-caps label="Remove"
                  icon="delete"
                  color="red"
                  class="full-width"
                  @click="() => formData.cartOptions = undefined"
                />
              </div>
              <q-dialog v-model="showCartOptionsPreview" position="bottom">
                <q-card>
                  <q-card-section>
                    <div class="row items-center">
                      <div class="text-h6">Form Preview</div>
                      <q-space/>
                      <q-btn v-close-popup flat icon="close" padding="sm"/>
                    </div>
                    <JSONFormPreview :schemaData="formData.cartOptions"/>
                    <q-btn label="OK" color="brandblue" v-close-popup/>
                  </q-card-section>
                </q-card>
              </q-dialog>
            </template>
          </div>
        </q-card-section>
      </q-card>
      <q-card>
        <q-card-section v-if="formData.variants?.length">
          <q-slide-transition>
            <div v-if="formData.variants?.length > 1" class="text-subtitle1 q-mb-sm">
              Variants
              <span class="text-grey">[{{ formData.variants?.length }}]</span>
            </div>
          </q-slide-transition>
          <TransitionGroup name="fade">
            <div v-for="(variant, index) in formData.variants" :key="variant._index">
              <q-banner
                v-if="variantErrorAt(index)?.detail?.length"
                class="bg-red text-white rounded-borders"
              >
                <div v-if="variantErrorAt(index)?.detail?.length === 1">
                  {{ variantErrorAt(index)?.detail[0] }}
                </div>
                <ul v-else class="q-pl-md">
                  <li v-for="(err, index) in variantErrorAt(index)?.detail" :key="index">{{err}}</li>
                </ul>
              </q-banner>
              <q-slide-transition>
                <div v-if="formData.variants.length > 1">
                  <div class="row items-center">
                    <div class="text-grey q-space">
                      Variant {{ index + 1 }}
                    </div>
                    <q-btn flat icon="delete" @click="() => formData.variants.splice(index, 1)"/>
                  </div>
                  <UploadImageField v-model="variant.imageUrl" :loading="loading" :disable="loading"/>
                  <div>Variant Name*</div>
                  <q-input
                    outlined
                    dense
                    :loading="loading"
                    :disable="loading"
                    placeholder="Large / Red / etc."
                    v-model.number="variant.name"
                    :error="Boolean(variantErrorAt(index)?.name)"
                    :error-message="variantErrorAt(index)?.name"
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
                :loading="loading"
                :disable="loading"
                v-model.number="variant.code"
                :error="Boolean(variantErrorAt(index)?.code)"
                :error-message="variantErrorAt(index)?.code"
              />

              <div>Price*</div>
              <q-input
                outlined
                dense
                :loading="loading"
                :disable="loading"
                type="number"
                step="0.001"
                :suffix="marketplaceStore?.currency"
                v-model.number="variant.price"
                :error="Boolean(variantErrorAt(index)?.price)"
                :error-message="variantErrorAt(index)?.price"
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
                    :loading="loading"
                    :disable="loading"
                    type="number"
                    v-model.number="variant.initialStock"
                    :error="Boolean(variantErrorAt(index)?.initialStock)"
                    :error-message="variantErrorAt(index)?.initialStock"
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
                    step="0.001"
                    :suffix="marketplaceStore?.currency"
                    v-model.number="variant.costPrice"
                    :error="Boolean(variantErrorAt(index)?.costPrice)"
                    :error-message="variantErrorAt(index)?.costPrice"
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
          label="Add Product"
          type="submit"
          class="full-width"
        />
      </div>
    </q-form>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'
import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useMarketplaceStore } from 'src/stores/marketplace'
import UploadImageField from 'src/components/marketplace/UploadImageField.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import JSONFormDialog from 'src/components/marketplace/jsonform/JSONFormDialog.vue'
import JSONFormPreview from 'src/components/marketplace/jsonform/JSONFormPreview.vue'
import CategoriesField from 'src/components/marketplace/inventory/CategoriesField.vue'


export default defineComponent({
  name: 'AddProduct',
  components: {
    UploadImageField,
    MarketplaceHeader,
    JSONFormPreview,
    CategoriesField,
  },
  setup() {
    const marketplaceStore = useMarketplaceStore()
    const $q = useQuasar()
    const $router = useRouter()

    let variantRowGenCounter = 0
    function createEmptyVariant() {
      return {
        _index: variantRowGenCounter++,
        imageUrl: null,
        code: '',
        name: '',
        price: null,
        initialStock: null,
        costPrice: null,
      }
    }
    const form = ref()
    const loading = ref(false)
    const formData = ref({
      imageUrl: '',
      name: '',
      description: '',
      categories: [],
      cartOptions: undefined,
      variants: [createEmptyVariant()],
    })

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
        initialStock: '',
        costPrice: '',
      }]
    })
    function variantErrorAt(index) {
      return formErrors.value?.variants?.[index]
    }

    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.name = ''
      formErrors.value.description = ''
      formErrors.value.imageUrl = ''
      formErrors.value.variants = []
    }

    const showCartOptionsPreview = ref(false)
    function openPropertiesSchemaOptions() {
      $q.dialog({
        component: JSONFormDialog,
        componentProps: {
          title: 'Cart options',
          schemaData: formData.value.cartOptions,
        }
      }).onOk(updatedSchemaData => {
        formData.value.cartOptions = updatedSchemaData
      })
    }

    function addVariant() {
      if (!Array.isArray(formData.value.variants)) formData.value.variants = []
      formData.value.variants.push(createEmptyVariant())
    }

    function addProduct() {
      const data = {
        shop_id: marketplaceStore.activeShopId,
        image_url: formData.value?.imageUrl || undefined,
        name: formData.value.name,
        description: formData.value.description,
        categories: [],
        cart_options: formData.value.cartOptions?.map?.(data => Object.assign({}, data, { _index: undefined })),
        variants: [],
      }
      if (!data?.cart_options?.length) data.cart_options = null

      if (Array.isArray(formData.value.categories)) data.categories = formData.value.categories

      if (Array.isArray(formData.value.variants)) {
        data.variants = formData.value.variants
          .filter(variant => !variant.remove)
          .map(variant => {
            return {
              image_url: variant.imageUrl || '',
              code: variant.code || undefined,
              name: variant.name || '',
              price: variant.price,
              initial_stock: variant.initialStock || undefined,
              cost_price: variant.costPrice || undefined,
            }
          })
      }

      loading.value = true
      return backend.post('products/', data)
        .finally(() => clearFormErrors())
        .then(() => {
          $q.dialog({
            title: 'Product added!',
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
            if (Array.isArray(data?.variants)) {
              data?.variants.forEach((variantError, index) => {
                if (!Array.isArray(formErrors.value.variants)) formErrors.value.variants = []
                formErrors.value.variants[index] = {
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

            if (!formErrors.value.detail?.length) {
              formErrors.value.detail = ['Encountered errors in adding product']
            }
          }
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      marketplaceStore,
      form,
      loading,
      formData,
      formErrors,
      variantErrorAt,

      showCartOptionsPreview,
      openPropertiesSchemaOptions,

      addVariant,
      addProduct,
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
