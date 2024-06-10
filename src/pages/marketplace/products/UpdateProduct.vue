<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">{{ $t('EditProduct') }}</div>
          <div class="text-grey">{{ $t('Marketplace') }}</div>
        </div>
      </template>
    </MarketplaceHeader>
    <div v-if="fetchingProduct" class="row justify-center items-center q-py-lg">
      <q-spinner size="5em"/>
    </div>
    <div v-else-if="fetchProductSuccess === false" class="text-center">
      {{ $t('UnableToFetchProduct') }}
    </div>
    <q-form v-else ref="form" @submit="() => updateProduct()" class="q-mt-lg q-gutter-y-lg">
      <div class="row items-center justify-end">
        <q-btn
          :outline="$q.dark.isActive"
          :label="$t('DeleteProduct')"
          color="red"
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
          <div class="text-subtitle1 q-mb-sm">{{ $t('ProductDescription') }}</div>
          <UploadImageField v-model="formData.imageUrl" :disable="loading" :loading="loading"/> 
          <div>{{ $t('Name') }}*</div>
          <q-input
            dense
            outlined
            :disable="loading"
            :loading="loading"
            v-model="formData.name"
            :error="Boolean(formErrors?.name)"
            :error-message="formErrors?.name"
            :rules="[
              val => Boolean(val) || $t('Required'),
            ]"
          />
          <div>{{ $t('Description') }}</div>
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
          <div>{{ $t('Categories') }}</div>
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
        </q-card-section>
      </q-card>

      <q-card class="q-mt-md">
        <q-card-section>
          <div class="row items-center">
            <div class="text-subtitle1">{{ $t('CartOptions') }}</div>
            <q-space/>
            <q-icon
              size="1.5em"
              name="help"
            >
              <q-menu class="q-pa-sm text-body2">
                {{ $t('CartOptionsMsg') }}
              </q-menu>
            </q-icon>
          </div>
          <div class="row items-center q-r-mx-sm">
            <div class="full-width q-pa-xs q-mb-sm">
              <q-btn
                no-caps 
                :label="$t('Configure')"
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
                  no-caps
                  :label="$t('Preview')"
                  icon="preview"
                  color="brandblue"
                  class="full-width"
                  @click="() => showCartOptionsPreview = !showCartOptionsPreview"
                />
              </div>
  
              <div class="col-6 q-pa-xs">
                <q-btn
                  outline
                  no-caps
                  :label="$t('Remove')"
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
                      <div class="text-h6">{{ $t('FormPreview') }}</div>
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
          <q-separator/>
          <div class="row items-center">
            <div class="text-subtitle1">{{ $t('AddonOptions') }}</div>
          </div>
          <AddonsInfoPanel
            v-if="formData.addons?.length"
            :addons="formData.addons"
            :currency="marketplaceStore.currency"
          />
          <q-btn
            :flat="!formData.addons?.length"
            :outline="Boolean(formData.addons?.length)"
            :color="(formData.addons?.length && !$q.dark.isActive) ? 'brandblue' : ''"
            no-caps :label="formData.addons?.length ? $t('Edit') : $t('SetAddons')"
            icon="edit"
            class="full-width"
            @click="() => openAddonsFormDialog()"
          />
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section>
          <q-slide-transition>
            <div v-if="formData.variants.length > 1" class="text-subtitle1 q-mb-sm">
              {{ $t('Variants') }}
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
                    <template v-if="variant.remove">({{ $t('Delete') }})</template>
                    <!--TODO:-->
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
                  <div>{{ $t('VariantName') }}*</div>
                  <q-input
                    outlined
                    dense
                    :disable="loading"
                    :loading="loading"
                    v-model.number="variant.name"
                    :error="Boolean(variantErrorAt(index)?.name)"
                    :error-message="variantErrorAt(index)?.name"
                    :rules="[
                      val => Boolean(val) || $t('Required'),
                    ]"
                  />
                </template>
              </div>
            </q-slide-transition>
            <template v-if="!variant.remove">
              <div>{{ $t('Code') }}</div>
              <q-input
                outlined
                dense
                :disable="loading"
                :loading="loading"
                v-model.number="variant.code"
                :error="Boolean(variantErrorAt(index)?.code)"
                :error-message="variantErrorAt(index)?.code"
              />

              <div>{{ $t('Price') }}*</div>
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
                  val => val > 0 || $t('InvalidPrice'),
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
                      <!--TODO:-->
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
                  <div>{{ $t('VariantName') }}*</div>
                  <q-input
                    outlined
                    dense
                    :disable="loading"
                    :loading="loading"
                    v-model.number="variant.name"
                    :error="Boolean(newVariantErrorAt(index)?.name)"
                    :error-message="newVariantErrorAt(index)?.name"
                    :rules="[
                      val => Boolean(val) || $t('Required'),
                    ]"
                  />
                </div>
              </q-slide-transition>
              <div>{{ $t('Code') }}</div>
              <q-input
                outlined
                dense
                :disable="loading"
                :loading="loading"
                v-model.number="variant.code"
                :error="Boolean(newVariantErrorAt(index)?.code)"
                :error-message="newVariantErrorAt(index)?.code"
              />

              <div>{{ $t('Price') }}*</div>
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
                  val => val > 0 || $t('InvalidPrice'),
                ]"
              />

              <div class="row">
                <div class="col-6 q-pr-sm">
                  <div>{{ $t('Initial Stock') }}</div>
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
                      val => val >= 0 || $t('Invalid'),
                    ]"
                  />
                </div>
                <div class="col-6">
                  <div>{{ $t('Cost Price') }}</div>
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
                      val => val >= 0 || $t('Invalid'),
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
              :label="$t('Add Variant')"
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
          :label="$t('UpdateProduct')"
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
import { parseProductAddon } from 'src/marketplace/product-addons'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref } from 'vue'
import UploadImageField from 'src/components/marketplace/UploadImageField.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import JSONFormDialog from 'src/components/marketplace/jsonform/JSONFormDialog.vue'
import JSONFormPreview from 'src/components/marketplace/jsonform/JSONFormPreview.vue'
import CategoriesField from 'src/components/marketplace/inventory/CategoriesField.vue'
import AddonsFormDialog from 'src/components/marketplace/cartoptions/AddonsFormDialog.vue'
import AddonsInfoPanel from 'src/components/marketplace/cartoptions/AddonsInfoPanel.vue'

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
    JSONFormPreview,
    CategoriesField,
    AddonsInfoPanel,
  },
  props: {
    productId: [Number, String]
  },
  setup(props) {
    const marketplaceStore = useMarketplaceStore()
    const $q = useQuasar()
    const { t } = useI18n()
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
      cartOptions: undefined,
      addons: [].map(parseProductAddon),
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
      formData.value.cartOptions = product.value?.cartOptions
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
      if (!Array.isArray(product.value.addons)) {
        formData.value.addons = []
      } else {
        formData.value.addons = product.value.addons.map(parseProductAddon)
      }

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

    const showCartOptionsPreview = ref(false)
    function openPropertiesSchemaOptions() {
      $q.dialog({
        component: JSONFormDialog,
        componentProps: {
          title: t('CartOptions'),
          schemaData: formData.value.cartOptions,
        }
      }).onOk(updatedSchemaData => {
        formData.value.cartOptions = updatedSchemaData
      })
    }

    function openAddonsFormDialog() {
      $q.dialog({
        component: AddonsFormDialog,
        componentProps: {
          initialValue: formData.value.addons,
          clearable: true,
          promptClear: true,
        }
      }).onOk(addonsList => {
        formData.value.addons = addonsList
      })
    }

    function addVariant() {
      formData.value.newVariants.push(createEmptyNewVariant())
    }

    function updateProduct() {
      const data = {
        name: undefinedOrUpdated(formData.value.name, product.value.name),
        description: undefinedOrUpdated(formData.value.description, product.value.description),
        categories: formData.value.categories,
        cart_options: formData.value.cartOptions?.map?.(data => Object.assign({}, data, { _index: undefined })),
        image_url: undefinedOrUpdated(formData.value.imageUrl || "", product.value.imageUrl),
        update_variants: computedFormData.value.variants.update,
        add_variants: computedFormData.value.variants.add,
        addons: formData.value.addons.map(addon => {
          return {
            label: addon.label,
            min_opts: addon.minOpts,
            max_opts: addon.maxOpts,
            options: addon.options.map(option => {
              return {
                label: option.label,
                price: option.price,
                require_input: option.requireInput,
              }
            })
          }
        })
      }
      if (!data?.cart_options?.length) data.cart_options = null

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
            title: t('ProductUpdated'),
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
            formData.value.detail = [t('UpdatingProductErrMsg')]
          }
        })
        .finally(() => {
          loading.value = false
        })
    }

    function confirmDeleteProduct() {
      $q.dialog({
        title: `Delete '${product.value?.name}'`, // TODO:
        message: `Delete product '${product.value.name}'. Are you sure?`, // TODO:
        ok: {
          noCaps: true,
          label: t('Delete'),
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
        title: t('DeletingProduct'),
        progress: true,
        persistent: true,
        ok: false,
      })
      backend.delete(`products/${product.value.id}/`)
        .then(() => {
          dialog.update({ title: t('ProductDeleted') })
            .onDismiss(() => $router.go(-1))
        })
        .catch(error => {
          dialog.update({
            title: t('Error'),
            message: error?.response?.data?.detail || t('DeletingProductErrMsg'),
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
      computedFormData,

      formErrors,
      variantErrorAt,
      newVariantErrorAt,

      showCartOptionsPreview,
      openPropertiesSchemaOptions,

      openAddonsFormDialog,

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
