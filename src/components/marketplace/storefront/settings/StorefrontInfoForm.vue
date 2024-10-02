<template>
  <div>
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
          <div>Phone number</div>
          <q-input
            dense outlined
            :disable="loading"
            v-model="formData.phoneNumber"
            :error="Boolean(formErrors?.phoneNumber)"
            :error-message="formErrors?.phoneNumber"
          />
        </div>
        <div>
          <div class="row items-center">
            <div class="q-space">Receiving address</div>
            <q-btn
              flat
              :loading="updatingReceivingAddress"
              :disable="updatingReceivingAddress"
              no-caps label="Change"
              padding="xs sm"
              class="text-underline q-r-mr-sm"
              @click="() => updateReceivingAddress()"
            />
          </div>
          <q-input
            readonly
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
  </div>
</template>
<script>
import { Product } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'
import { asyncSleep } from 'src/wallet/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useAddressesStore } from 'src/stores/addresses'
import { defineComponent, onMounted, ref } from 'vue'
import UploadImageField from 'src/components/marketplace/UploadImageField.vue'
import ProductSearchPanel from 'src/components/marketplace/ProductSearchPanel.vue'


export default defineComponent({
  name: 'StorefrontInfoForm',
  components: {
    UploadImageField,
    ProductSearchPanel,
  },
  emits: [
    'saved',
  ],
  setup(props, { emit: $emit }) {
    const addressesStore = useAddressesStore()
    const marketplaceStore = useMarketplaceStore()

    const loading = ref(false)
    const formData = ref({
      imageUrl: marketplaceStore?.storefrontData?.image_url,
      name: marketplaceStore?.storefrontData?.name,
      phoneNumber: marketplaceStore?.storefrontData?.phone_number,
      receivingAddress: marketplaceStore?.storefrontData?.receiving_address,
      autoSubscribeProducts: Boolean(marketplaceStore?.storefrontData?.auto_subscribe_products),
      subscribeProducts: [].map(Product.parse)
    })

    onMounted(() => {
      if (!marketplaceStore.storefrontData?.id && !formData.value?.receivingAddress) {
        updateReceivingAddress()
      }
    })

    const updatingReceivingAddress = ref(false)
    async function updateReceivingAddress() {
      try {
        updatingReceivingAddress.value = true
        let address = formData.value.receivingAddress
        if (!addressesStore.addressSets.length) await addressesStore.fillAddressSets().catch(console.error)
        else await asyncSleep(250).catch(console.error)

        const opts = addressesStore.addressSets
          .map(addressSet => addressSet?.receiving)
          .filter((e, i, s) => s.indexOf(e) === i)
          .filter(Boolean)
  
        if (opts?.length <= 0) return
  
        const index = opts.indexOf(address)
        // we want to change address like it's rotating around the address sets stored
        const rotatedOpts = [
          ...opts.slice(index+1),
          ...opts.slice(0, index+1),
        ]
  
        const newAddress = rotatedOpts.find(addr => addr != address)
        const noNewAddressError = 'Unable to find new address'
        if (!newAddress) {
          if (!formErrors.value.receivingAddress) {
            formErrors.value.receivingAddress = noNewAddressError
          }
          return
        }
        formData.value.receivingAddress = newAddress
        if (noNewAddressError == formErrors.value.receivingAddress) {
          formErrors.value.receivingAddress = ''
        }
      } finally {
        updatingReceivingAddress.value = false
      }
    }

    const formErrors = ref({
      detail: [],
      name: '',
      phoneNumber: '',
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
        phone_number: formData.value.phoneNumber,
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
          $emit('saved')
          return response
        })
        .catch(error => {
          console.error(error)
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.name = errorParser.firstElementOrValue(data?.name)
          formErrors.value.phoneNumber = errorParser.firstElementOrValue(data?.phone_number)
          formErrors.value.receivingAddress = errorParser.firstElementOrValue(data?.receiving_address)
          formErrors.value.subscribeProductIds = errorParser.firstElementOrValue(data?.subscribe_product_ids)
          if (data?.detail) formErrors.value.detail.unshift(data?.detail)
          if (Array.isArray(data) && !formErrors.value.detail?.length) formErrors.value.detail = data

          if (!formErrors.value.detail?.length &&
              !formErrors.value.name &&
              !formErrors.value.receivingAddress && 
              !formErrors.value.subscribeProductIds
          ) formErrors.value.detail = [
            marketplaceStore?.storefrontData?.id
              ? 'Failed to update storefront'
              : 'Failed to setup storefront',
          ]

        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      marketplaceStore,

      loading,
      formData,
      updatingReceivingAddress,
      updateReceivingAddress,

      formErrors,
      clearFormErrors,

      createStorefront,
    }
  },
})
</script>
