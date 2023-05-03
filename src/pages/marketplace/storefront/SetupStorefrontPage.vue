<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">
            <template v-if="marketplaceStore?.storefrontData?.id">
              Storefront settings
            </template>
            <template v-else>
              Storefront Setup
            </template>
          </div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-md">
      <div v-if="formErrors?.detail?.length === 1">
        {{ formErrors.detail[0] }}
      </div>
      <ul v-else class="q-pl-md">
        <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
      </ul>
    </q-banner>
    <q-card class="q-mb-md">
      <q-card-section class="q-gutter-y-sm">
        <UploadImageField v-model="formData.imageUrl" :loading="loading" :disable="loading"/>
        <div>
          <div>Name</div>
          <q-input
            dense outlined
            :disable="loading"
            :placeholder="marketplaceStore.shop.name"
            v-model="formData.name"
            :error="Boolean(formErrors?.name)"
            :error-message="formErrors?.name"
          />
        </div>

        <q-checkbox
          dense
          :disable="loading"
          label="Auto add products"
          v-model="formData.autoSubscribeProducts"
        />
      </q-card-section>
    </q-card>
    <q-slide-transition>
      <q-card v-if="!formData.autoSubscribeProducts" class="q-mb-md">
        <q-card-section class="q-pb-sm">
          <div class="text-h6">
            Select products
            <template v-if="formData.subscribeProducts?.length">
              ({{ formData.subscribeProducts?.length }})
            </template>
          </div>
          <q-banner v-if="formErrors?.subscribeProductIds" class="bg-red text-white rounded-borders q-mb-sm">
            {{ formErrors?.subscribeProductIds }}
          </q-banner>
          <q-input
            dense outlined
            :disable="loading"
            :loading="productSearch.loading"
            v-model="productSearch.searchVal"
            debounce="500"
            @update:model-value="() => updateProductOpts()"
          >
            <template v-slot:append>
              <q-icon name="search"/>
            </template>
          </q-input>
        </q-card-section>
        <q-list class="q-pb-md">
          <q-virtual-scroll
            :items="productSearch.opts" style="max-height: 50vh;"
            v-slot="{ item: product }"
          >
            <q-item clickable @click="() => toggleSubscribeProduct(product)">
              <q-item-section side>
                <q-checkbox
                  :disable="loading"
                  :model-value="formData.subscribeProducts.some(p => p?.id == product.id)"
                  @update:model-value="() => toggleSubscribeProduct(product)"
                />
              </q-item-section>
              <q-item-section v-if="product?.displayImageUrl" avatar class="q-pr-xs"> 
                <img
                  :src="product?.displayImageUrl"
                  width="50"
                  class="rounded-borders"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ product.name }}</q-item-label>
                <q-item-label class="text-caption">
                  <template v-if="product.hasVariants">
                    {{ product.variants.length || product.variantsCount }} variants
                  </template>
                  <template v-else>{{ product?.code }}</template>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-virtual-scroll>
        </q-list>
      </q-card>
    </q-slide-transition>
    <div>
      <q-btn
        no-caps
        :label="marketplaceStore?.storefrontData?.id ? 'Update storefront' : 'Create storefront'"
        color="brandblue"
        class="full-width"
        @click="() => createStorefront()"
      />
    </div>
  </q-page>
</template>
<script>
import { Product } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { debounce, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import UploadImageField from 'src/components/marketplace/UploadImageField.vue'

export default defineComponent({
  name: 'SetupStorefronPage.vue',
  components: {
    MarketplaceHeader,
    UploadImageField,
  },
  setup() {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    const loading = ref(false)
    const formData = ref({
      imageUrl: marketplaceStore?.storefrontData?.image_url,
      name: marketplaceStore?.storefrontData?.name,
      autoSubscribeProducts: Boolean(marketplaceStore?.storefrontData?.auto_subscribe_products),
      subscribeProducts: [].map(Product.parse)
    })

    function toggleSubscribeProduct(product=Product.parse()) {
      const exists = formData.value.subscribeProducts.some(_product => _product?.id === product?.id)
      if (exists) {
        formData.value.subscribeProducts = formData.value.subscribeProducts
          .filter(_product => _product.id !== product.id)
      } else {
        formData.value.subscribeProducts.push(product)
      }
    }

    const productSearch = ref({
      searchVal: '',
      opts: [].map(Product.parse),
      loading: false,
    })

    watch(
      () => [formData.value.autoSubscribeProducts],
      () => !formData.value.autoSubscribeProducts ? updateProductOpts() : null,
    )
    onMounted(() => !formData.value.autoSubscribeProducts ? updateProductOpts() : null)
    const updateProductOpts = debounce(function () {
      const params = {
        shop_id: marketplaceStore.activeShopId,
        s: productSearch.value.searchVal,
        limit: 15,
        exclude_ids: formData.value.subscribeProducts.map(product => product?.id).join(',') || undefined,
      }

      productSearch.value.loading = true
      return backend.get(`products/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject(response)
          productSearch.value.opts = response?.data?.results.map(Product.parse)
          formData.value.subscribeProducts.forEach(product => {
            if (productSearch.value.opts.find(_product => _product?.id == product?.id)) return
            productSearch.value.opts.push(product)
          })
          return response
        })
        .finally(() => {
          productSearch.value.loading = false
        })
    }, 500, false)

    const formErrors = ref({
      detail: [],
      name: '',
      subscribeProductIds: '',
    })
    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.name = ''
      formErrors.value.subscribeProductIds = ''
    }

    function createStorefront() {
      const data = {
        shop_id: marketplaceStore.activeShopId,
        image_url: formData.value.imageUrl,
        name: formData.value.name || undefined,
        auto_subscribe_products: formData.value.autoSubscribeProducts,
        subscribe_product_ids: formData.value.subscribeProducts.map(product => product?.id),
      }
      if (data.auto_subscribe_products) data.subscribe_product_ids = undefined

      loading.value = true
      return backend.post(`connecta/storefronts/`, data)
        .finally(() => clearFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })

          marketplaceStore.setStorefrontData(response?.data)
          $q.dialog({
            title: marketplaceStore?.storefrontData?.id ? 'Storefront updated' : 'Storefront created',
            ok: { color: 'brandblue' },
          }).onDismiss(() => $router.go(-1))

          return response
        })
        .catch(error => {
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.name = errorParser.firstElementOrValue(data?.name)
          formErrors.value.subscribeProductIds = errorParser.firstElementOrValue(data?.subscribe_product_ids)
          if (data?.detail) formErrors.value.detail.shift(data?.detail)
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      marketplaceStore,
      loading,
      formData,
      toggleSubscribeProduct,

      productSearch,
      updateProductOpts,

      formErrors,
      clearFormErrors,

      createStorefront,
    }
  },
})
</script>
