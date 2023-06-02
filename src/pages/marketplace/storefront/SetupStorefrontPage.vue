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
        <div>
          <div>Receiving address</div>
          <q-input
            dense outlined
            :disable="loading"
            autogrow
            v-model="formData.receivingAddress"
            :error="Boolean(formErrors?.receivingAddress)"
            :error-message="formErrors?.receivingAddress"
          >
          </q-input>
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
        <q-card-section>
          <div class="text-h6">
            Select products
            <template v-if="formData.subscribeProducts?.length">
              ({{ formData.subscribeProducts?.length }})
            </template>
          </div>
          <q-banner v-if="formErrors?.subscribeProductIds" class="bg-red text-white rounded-borders q-mb-sm">
            {{ formErrors?.subscribeProductIds }}
          </q-banner>
          <ProductSearchPanel v-model="formData.subscribeProducts"/>
        </q-card-section>
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
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { defineComponent, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import UploadImageField from 'src/components/marketplace/UploadImageField.vue'
import ProductSearchPanel from 'src/components/marketplace/ProductSearchPanel.vue'

export default defineComponent({
  name: 'SetupStorefronPage.vue',
  components: {
    MarketplaceHeader,
    UploadImageField,
    ProductSearchPanel,
  },
  setup() {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    const loading = ref(false)
    const formData = ref({
      imageUrl: marketplaceStore?.storefrontData?.image_url,
      name: marketplaceStore?.storefrontData?.name,
      receivingAddress: marketplaceStore?.storefrontData?.receiving_address,
      autoSubscribeProducts: Boolean(marketplaceStore?.storefrontData?.auto_subscribe_products),
      subscribeProducts: [].map(Product.parse)
    })

    const formErrors = ref({
      detail: [],
      name: '',
      receivingAddress: '',
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
        receiving_address: formData.value.receivingAddress,
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
          formErrors.value.receivingAddress = errorParser.firstElementOrValue(data?.receiving_address)
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

      formErrors,
      clearFormErrors,

      createStorefront,
    }
  },
})
</script>
