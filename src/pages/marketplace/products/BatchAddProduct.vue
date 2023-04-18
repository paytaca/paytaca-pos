<template>
  <q-page class="q-pa-md q-pb-xl">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Add Products</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <div class="row items-center q-mb-md">
      <q-space/>
      <q-btn flat no-caps label="Upload Excel / CSV" @click="updloadSpreadsheet"/>
    </div>
    <q-form @submit="() => addProducts()">
      <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-sm">
        <div v-if="formErrors?.detail?.length === 1">
          {{ formErrors.detail[0] }}
        </div>
        <ul v-else class="q-pl-md">
          <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
        </ul>
      </q-banner>
      <div class="q-mb-md">
        <q-btn
          no-caps
          :disable="loading"
          label="Add product"
          :color="$q.dark.isActive ? 'dark' : 'white'"
          :text-color="$q.dark.isActive ? undefined : 'black'"
          @click="addRow"
          class="full-width"
        />
      </div>
      <TransitionGroup name="fade">
        <q-card
          v-for="(product, index) in formData.products" :key="product._index"
          class="q-mb-sm"
          @click="() => loading ? null : editProduct(product)"
        >
          <q-card-section class="q-py-sm q-px-md">
            <div class="row items-center">
              <div class="text-grey">Product {{ index+1 }}</div>
              <q-icon
                v-if="formErrors?.products?.[index]?.hasError"
                name="error" color="red" size="1.75em" class="q-ml-xs"
              />
              <q-space/>
              <q-btn :disable="loading" flat icon="close" color="red" padding="none" @click.stop="() => removeRow(product)"/>
            </div>
            <div class="row items-start">
              <img
                v-if="product?.imageUrl"
                :src="product?.imageUrl"
                class="rounded-borders q-mt-xs q-mr-sm col-3"
                style="width:50px;"
              />
              <div :class="[product?.imageUrl ? 'col-9':'col-12']">
                <div class="row items-center q-gutter-xs">
                  <div class="text-body1 ellipsis q-space">
                    <template v-if="product.name">{{ product.name  }}</template>
                    <span v-else class="text-grey">Unnamed</span>
                  </div>
                  <div v-if="product?.categories" class="ellipsis q-gutter-xs" style="min-width:5em">
                    <span
                      v-for="category in product.categories" :key="category"
                      class="rounded-borders bg-brandblue text-white q-px-xs"
                    >
                      {{ category }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="ellipsis q-my-xs">{{ product.description }}</div>
            </div>
            <div v-if="product?.variants?.length  > 1" class="text-grey">
              Variants
            </div>
            <div v-for="(variant, index2) in product?.variants" :key="`${index}-${index2}`" class="row items-start q-mb-xs">
              <img
                v-if="variant?.imageUrl"
                :src="variant?.imageUrl"
                class="rounded-borders q-mt-xs q-mr-sm col-3"
                style="width:50px;"
              />
              <div :class="[variant?.imageUrl ? 'col-9':'col-12']">
                <div v-if="product?.variants?.length > 1" class="row q-gutter-xs">
                  <!-- <div class="text-grey">Variant {{ index2 +1 }}:</div> -->
                  <div class="text-body2">{{ variant?.name }}</div>
                </div>
                <div class="row">
                  <div class="q-pr-xs" style="min-width:50%;"><span class="text-grey">Code:</span> {{ variant?.code }}</div>
                  <div class="q-pr-xs" style="min-width:50%;"><span class="text-grey">Price:</span> {{ variant?.price }} {{ marketplaceStore?.currency }}</div>
                  <div class="q-pr-xs" style="min-width:50%;"><span class="text-grey">Initial stock:</span> {{ variant?.initialStock }}</div>
                  <div class="q-pr-xs" style="min-width:50%;"><span class="text-grey">Cost Price:</span> {{ variant?.costPrice }} {{ marketplaceStore?.currency }}</div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </TransitionGroup>
      <div class="q-pa-sm fixed-bottom">
        <q-btn
          no-caps
          :disable="loading"
          :loading="loading"
          color="brandblue"
          type="submit"
          class="full-width"
        >
          Create products
          <template v-if="formData.products.length">({{ formData.products.length }})</template>
        </q-btn>
      </div>
    </q-form>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import ProductFormDialog from 'src/components/marketplace/inventory/ProductFormDialog.vue'

// const testData = [{"name":"Cap","description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vel ornare turpis. Curabitur lorem nulla, egestas ut ipsum sed, tristique auctor leo. Morbi sit amet libero massa. Etiam eget sodales ex, in accumsan diam. Etiam et sollicitudin erat, et maximus massa. Phasellus sem risus, vehicula eget rutrum at, blandit id risus. Vestibulum congue imperdiet orci ac tincidunt. Proin eget nulla lorem. Sed ut erat leo.","categories":["Clothes", "Home", "New Arrival"],"variants":[{"name":"Red","image_url":null,"code":"cap-red","price":350.0,"initial_stock":null,"cost_price":null},{"name":"Blue","image_url":null,"code":"Cap-blue","price":350.0,"initial_stock":null,"cost_price":null}]},{"name":"Shirt","description":"Some shirt","categories":[],"variants":[{"name":"Small","image_url":null,"code":"shirt-small","price":450.0,"initial_stock":100,"cost_price":425.0},{"name":"Medium","image_url":null,"code":"shirt-medium","price":475.0,"initial_stock":75,"cost_price":450.0},{"name":"Large","image_url":null,"code":"shirt-large","price":500.0,"initial_stock":50,"cost_price":475.0}]},{"name":"Necklace","description":null,"categories":[],"variants":[{"name":null,"image_url":null,"code":"necklace","price":750.0,"initial_stock":10,"cost_price":600.0}]},{"name":"Mug","description":"Just a regular mug","categories":[],"variants":[{"name":null,"image_url":null,"code":"mug","price":350.0,"initial_stock":null,"cost_price":300.0}]}]

export default defineComponent({
  name: 'BatchAddProduct',
  components: {
    MarketplaceHeader,
  },
  setup() {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    let rowGenCounter = 0
    function createEmptyRow() {
      return {
        _index: rowGenCounter++,
        imageUrl: '',
        name: '',
        description: '',
        categories: [],
        variants: [{
          imageUrl: '',
          name: '',
          code: '',
          price: null,
          initialStock: null,
          costPrice: null,
        }]
      }
    }

    const loading = ref(false)
    const formData = ref({
      products: [].map(createEmptyRow),
    })
    onMounted(() => addRow())
    function addRow(opts={ skipForm: false }) {
      const productData = createEmptyRow()
      if(opts?.skipForm) return formData.value.products.push(productData)
      editProduct(productData).onOk(() => formData.value.products.push(productData))
    }
    function removeRow(row) {
      formData.value.products = formData.value.products.filter(product => product !== row)
    }

    const formErrors = ref({
      detail: [],
      products: [].map(() => {
        return {
          hasError: false,
          detail: [],
          name: '',
          description: '',
          categories: '',
          variants: [].map(() => {
            return {
              detail: [],
              code: '',
              name: '',
              price: '',
              initialStock: '',
              costPrice: '',
            }
          })
        }
      })
    })

    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.products = []
    }

    function updloadSpreadsheet() {
      $q.dialog({
        prompt: {
          type: 'file',
          color: 'brandblue',
        },
        ok: {
          flat: true,
          color: 'brandblue',
        }
      }).onOk(files => {
        const data = new FormData()
        data.set('file', files[0])

        const dialog = $q.dialog({
          title: 'Reading file',
          progress: true,
          ok: false,
          persistent: true,
        })

        loading.value = true
        backend.post(`products/parse_file/`, data)
          .then(response => {
            if (!Array.isArray(response?.data)) return Promise.reject({ response })
            formData.value.products = response.data.map(productData => copyProductData(productData, createEmptyRow()))
            dialog.hide()
            return response
          })
          .catch(error => {
            const errorMsg = error?.response?.data?.detail ||
              error?.response?.data?.non_field_errors?.[0] || 
              error?.response?.data?.file?.[0]

            dialog.update({ title: 'Error', message: errorMsg || 'Unable to read file' })
          })
          .finally(() => {
            dialog.update({ persistent: false, ok: true, progress: false })
            loading.value = false
          })
      })
    }

    function copyProductData(source, target) {
      if (!target) target = {}
      target.name = source?.name
      target.imageUrl = source?.image_url || source?.imageUrl
      target.description = source?.description
      target.categories = Array.isArray(source?.categories) ? source?.categories : []
      if (!Array.isArray(source.variants)) target.variants = []
      else {
        target.variants = source.variants.map(variantData => {
          return {
            imageUrl: variantData?.image_url || variantData?.imageUrl,
            name: variantData?.name,
            code: variantData?.code,
            price: variantData?.price,
            initialStock: variantData?.initial_stock || variantData?.initialStock,
            costPrice: variantData?.cost_price || variantData?.costPrice,
          }
        })
      }

      return target
    }

    function editProduct(productData) {
      const index = formData.value.products.indexOf(productData)
      return $q.dialog({
        component: ProductFormDialog,
        componentProps: {
          initialData: productData,
          errors: formErrors.value.products[index],
        }
      }).onOk(data => copyProductData(data, productData))
    }

    function addProducts() {
      const data = {
        products: formData.value.products.map(productData => {
          return {
            shop_id: marketplaceStore.activeShopId,
            image_url: productData?.imageUrl || undefined,
            name: productData?.name || undefined,
            description: productData?.description || undefined,
            categories: productData?.categories || undefined,
            variants: productData?.variants?.map?.(variantData => {
              return {
                image_url: variantData?.imageUrl || undefined,
                name: variantData?.name || undefined,
                code: variantData?.code || undefined,
                price: variantData?.price || undefined,
                initial_stock: variantData?.initialStock || undefined,
                cost_price: variantData?.costPrice || undefined,
              }
            }),
          }
        }),
      }

      loading.value = true
      backend.post(`products/batch_create/`, data)
        .finally(() => clearFormErrors())
        .then(() => {
          $q.dialog({
            title: 'Products added!',
            ok: true,
          }).onOk(() => {
            $router.back()
          })
        })
        .catch(error => {
          const data = error?.response?.data
          if (!data) return

          data?.products?.map?.((productError, index) => {
            const productErrors = {
              detail: errorParser.toArray(productError?.non_field_errors),
              name: errorParser.firstElementOrValue(productError?.name),
              description: errorParser.firstElementOrValue(productError?.description),
              categories: errorParser.firstElementOrValue(productError?.categories),
              variants: productError?.variants?.map?.(variantError => {
                return {
                  detail: errorParser.toArray(variantError?.non_field_errors),
                  code: errorParser.firstElementOrValue(variantError?.code),
                  name: errorParser.firstElementOrValue(variantError?.name),
                  price: errorParser.firstElementOrValue(variantError?.price),
                  initialStock: errorParser.firstElementOrValue(variantError?.initial_stock),
                  costPrice:  errorParser.firstElementOrValue(variantError?.cost_price),
                }
              })
            }

            const hasError = productErrors.detail.length || productErrors.name ||
                              productErrors.description || productErrors.categories ||
                              productErrors.variants?.some?.(variantErrors => {
                                return variantErrors?.detail?.length || variantErrors?.name ||
                                        variantErrors?.code || variantErrors?.price ||
                                        variantErrors?.initialStock || variantErrors?.costPrice
                              })

            productErrors.hasError = Boolean(hasError)
            formErrors.value.products[index] = productErrors
          })

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]

          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered errors in adding products']
          }

          return
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      marketplaceStore,

      loading,
      formData,
      addRow,
      removeRow,
      formErrors,
      updloadSpreadsheet,
      editProduct,
      addProducts,
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
