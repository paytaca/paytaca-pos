<template>
  <div>
    <q-input
      dense
      outlined
      :disable="disable"
      :loading="loading"
      :placeholder="$t('ProductNameOrCode')"
      v-model="searchVal"
      debounce="500"
      @update:model-value="() => updateProductSearchList()"
      class="q-mb-md"
    >
      <template v-slot:append>
        <q-icon name="search"/>
      </template>
    </q-input>
    <q-list separator style="max-height:70vh;overflow:auto;">
      <slot name="options" v-bind="{ products, searchVal, toggleProduct, productIdExists }">
        <div v-if="products?.length">
          <TransitionGroup name="fade">
            <div v-for="product in products" :key="product?.id">
            <!-- <q-virtual-scroll :items="products" v-slot="{ item: product }"> -->
              <slot name="option" v-bind="{ product, toggleProduct, productIdExists }">
                <q-item clickable @click="() => toggleProduct(product)" :key="product?.id">
                  <q-item-section side>
                    <q-checkbox
                      :disable="disable"
                      :model-value="Boolean(productIdExists(product?.id))"
                      @click="() => toggleProduct(product)"
                    />
                  </q-item-section>
                  <q-item-section v-if="product?.displayImageUrl" avatar class="q-pr-xs">
                    <img
                      :src="product?.displayImageUrl"
                      width="50"
                      class="rounded-borders"
                    />
                  </q-item-section>
                  <q-item-section top>
                    <q-item-label>{{ product?.name }}</q-item-label>
                    <q-item-label class="text-caption">#{{ product?.id }}</q-item-label>
                  </q-item-section>
                </q-item>
              </slot>
            </div>
            <!-- </q-virtual-scroll> -->
          </TransitionGroup>
        </div>
        <div v-else-if="!searchVal" class="q-pa-md text-grey text-center">
          {{ $t('SearchProducts') }}
        </div>
        <div v-else class="q-pa-md text-grey text-center">
          {{ $t('NoData') }}
        </div>

        <q-item
          v-if="pagination?.count > productOpts?.length"
          clickable
          v-ripple
          :disable="loading"
          @click="() => updateProductSearchList({append: true })"
        >
          <q-item-section class="text-center">
            <q-item-label :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'">
              {{ $t('ShowMore') }}
              <q-spinner v-if="loading"/>
            </q-item-label>
          </q-item-section>
        </q-item>
      </slot>
    </q-list>
  </div>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'ProductSearchPanel',
  emits: [
    'update:modelValue',
  ],
  props: {
    modelValue: [Array, Product],
    searchFilterKwargs: Object,
    disable: Boolean,
  },
  setup(props, { emit: $emit }) {
    const marketplaceStore = useMarketplaceStore()

    const innerValue = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerValue.value = props.modelValue, { deep: true })
    watch(innerValue, () => $emit('update:modelValue', innerValue.value, { deep: true }))

    const multiple = computed(() => Array.isArray(innerValue.value))

    const loading = ref(false)
    const searchVal = ref('')
    const productOpts = ref([].map(Product.parse))
    const pagination = ref({ offset: 0, limit: 0, count: 0})
    onMounted(() => updateProductSearchList())
    function updateProductSearchList(opts={append: false}) {
      const params = Object.assign({}, {
        limit: 5,
        offset: undefined,
        s: searchVal.value,
        shop_id: marketplaceStore.activeShopId || null,
      }, props.searchFilterKwargs)

      if (opts?.append) {
        params.offset = pagination.value.limit + pagination.value.offset
      }

      loading.value = true
      backend.get(`products/info/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return
          const _products = response?.data?.results.map(Product.parse)
          
          if (opts?.append) productOpts.value.push(..._products)
          else productOpts.value = _products
          pagination.value.count = response?.data?.count || 0
          pagination.value.limit = response?.data?.limit || 0
          pagination.value.offset = response?.data?.offset || 0
        })
        .finally(() => {
          loading.value = false
        })
    }

    const filteredProductOpts = computed(() => {
      return productOpts.value.filter(product => {
        if (!multiple.value) return product?.id !== innerValue.value?.id
        return !innerValue.value.some(_product => _product?.id === product?.id )
      })
    })

    const products = computed(() => {
      const data = []
      if (multiple.value) innerValue.value.forEach(product => data.push(product))
      else data.push(innerValue.value)

      data.push(...filteredProductOpts.value)
      return data
    })

    function toggleProduct(product=Product.parse()) {
      if (productIdExists(product?.id)) removeProductFromList(product)
      else addProductToList(product)
    }

    function productIdExists(productId) {
      if (multiple.value) return innerValue.value.some(product => product?.id === productId)
      return innerValue.value?.id === productId
    }

    function addProductToList(product=Product.parse()) {
      if (multiple.value) innerValue.value.push(product)
      else innerValue.value = product
    }

    function removeProductFromList(product=Product.parse()) {
      if (multiple.value) {
        innerValue.value = innerValue.value.filter(_product => {
          return _product?.id !== product?.id
        })
      } else {
        innerValue.value = null
      }
    }


    return {
      innerValue,

      loading,
      searchVal,
      productOpts,
      pagination,
      updateProductSearchList,

      toggleProduct,
      productIdExists,

      filteredProductOpts,
      products,
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
