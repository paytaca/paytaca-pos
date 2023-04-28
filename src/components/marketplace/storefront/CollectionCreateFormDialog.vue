<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Create Collection</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form @submit="() => createCollection()">
          <div>Name</div>
          <q-input
            dense
            outlined
            :disable="loading"
            v-model="formData.name"
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <div class="q-mb-md">
            <div class="text-subtitle1">Collection type</div>
            <q-radio
              :disable="loading"
              v-model="formData.auto"
              :val="true"
            >
              <div>Automated</div>
              <div class="text-caption">Products are added by some condition/s</div>
            </q-radio>
            <q-radio
              :disable="loading"
              v-model="formData.auto"
              :val="false"
            >
              <div>Manual</div>
              <div class="text-caption">Manually select products</div>
            </q-radio>
          </div>

          <q-slide-transition>
            <div v-if="formData.auto" class="q-mb-md">
              <div class="text-subtitle1">Conditions</div>
              <div>Categories</div>
              <q-select
                dense
                outlined
                :disable="loading"
                multiple
                use-chips
                use-input
                new-value-mode="add-unique"
                behavior="menu"
                :options="categoriesOpts"
                v-model="formData.categories"
                bottom-slots
                @new-value="(inputValue, done) => done(inputValue)"
                @filter="categoriesFilter"
              >
                <template v-slot:before-options="props">
                  {{ props }}
                </template>
              </q-select>

              <div class="row no-wrap q-gutter-xs">
                <div class="q-space">
                  <div>Price greater than</div>
                  <q-input
                    dense
                    outlined
                    :disable="loading"
                    :suffix="marketplaceStore.currency"
                    type="number"
                    v-model.number="formData.priceGreaterThan"
                    bottom-slots
                  />
                </div>
                <div class="q-space">
                  <div>Price less than</div>
                  <q-input
                    dense
                    outlined
                    :disable="loading"
                    :suffix="marketplaceStore.currency"
                    type="number"
                    v-model.number="formData.priceLessThan"
                    bottom-slots
                  />
                </div>
              </div>
            </div>
          </q-slide-transition>
          <q-slide-transition>
            <div v-if="!formData.auto" class="q-mb-md">
              <div class="text-subtitle1">Products</div>
              <ProductSearchPanel v-model="formData.products" :disable="loading">
                <template v-slot:option="props">
                  <q-item clickable @click="() => props.toggleProduct(props.product)" class="q-px-none">
                    <q-item-section side>
                      <q-checkbox
                        :disable="loading"
                        :model-value="props.productIdExists(props.product?.id)"
                        @click="() => props.toggleProduct(props.product)"
                      />
                    </q-item-section>
                    <q-item-section v-if="props.product?.displayImageUrl" avatar class="q-pr-xs">
                      <img
                        :src="props.product?.displayImageUrl"
                        width="50"
                        class="rounded-borders"
                      />
                    </q-item-section>
                    <q-item-section top>
                      <q-item-label>{{ props.product?.name }}</q-item-label>
                      <q-item-label class="text-caption">#{{ props.product?.id }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </ProductSearchPanel>
            </div>
          </q-slide-transition>

          <q-btn
            no-caps
            :disable="loading"
            :loading="loading"
            label="Create Collection"
            type="submit"
            color="brandblue"
            class="full-width"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import ProductSearchPanel from '../ProductSearchPanel.vue'

export default defineComponent({
  name: 'CollectionCreateFormDialog',
  components: {
    ProductSearchPanel,
  },
  props: {
    modelValue: Boolean,
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const loading = ref(false)
    const formData = ref({
      name: '',
      auto: true,
  
      categories: [],
      priceLessThan: null,
      priceGreaterThan: null,

      products: [].map(Product.parse),
    })

    const categoriesOpts = ref([].map(String))
    function categoriesFilter(val, done) {
      const params = {
        s: val,
        storefront_id: Number(marketplaceStore.storefrontData.id),
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

    function createCollection() {
      const data = {
        storefront_id: marketplaceStore.storefrontData.id,
        name: formData.value.name,
        auto: formData.value.auto,
        categories: undefined,
        price_less_than: undefined,
        price_greater_than: undefined,
        product_ids: undefined,
      }

      if (data?.auto) {
        data.categories = formData.value.categories,
        data.price_less_than = formData.value.priceLessThan || undefined
        data.price_greater_than = formData.value.priceGreaterThan || undefined
      } else {
        data.product_ids = formData.value.products.map(product => product?.id)
      }

      loading.value = true
      return backend.post(`connecta/collections/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          onDialogOK(response?.data)
          return response
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      marketplaceStore,
      innerVal,
      loading,
      formData,

      categoriesOpts,
      categoriesFilter,

      createCollection,
    }
  },
})
</script>
