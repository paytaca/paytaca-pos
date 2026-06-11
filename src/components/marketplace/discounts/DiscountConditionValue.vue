<template>
  <slot name="default" v-bind="{ products, productIds, fetchProductInfos }">
    <i v-if="ruleType === 'category' && operator === 'in'">
      {{ value.join(', ') }}
    </i>
    <template v-else-if="ruleType === 'product' && ['in', ''].includes(operator)">
      <div v-for="(product, index) in products" :key="index" class="row items-center q-mb-xs">
        <template v-if="product">
          <img
            v-if="product?.displayImageUrl"
            :src="product?.displayImageUrl"
            class="rounded-borders q-mr-sm"
            style="width:35px"
          />
          <div>{{ product?.name }}</div>
        </template>
        <template v-else>
          <q-skeleton v-if="fetchingProducts" type="text" style="min-width:4rem;"/>
          <i v-else>Product #{{ productIds[index] }}</i>
        </template>
      </div>
    </template>
    <i v-else-if="ruleType === 'subtotal'">
      {{ value }} {{ customCurrency || marketplaceStore.currency }} 
    </i>
    <i v-else>
      {{ value }}
    </i>
  </slot>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace';
import { defineComponent, reactive, ref, computed, onMounted } from 'vue';

// share cache across all instances
const productInfoMap = reactive({}); // id -> Product

export default defineComponent({
  name: 'DiscountConditionValue',
  props: {
    ruleType: String,
    operator: String,
    value: {},
    customCurrency: String,
  },
  setup(props) {
    const marketplaceStore = useMarketplaceStore();

      
    const productIds = computed(() => {
      const productIds = [];
      if (Array.isArray(props.value)) productIds.push(...props.value);
      else productIds.push(props.value);
      return productIds
    })
    const products = computed(() => productIds.value.map(productId => productInfoMap[Number(productId)]))
    const fetchingProducts = ref(false);
    function fetchProductInfos() {
      if (props.ruleType !== 'product') return Promise.resolve();

      const filteredProductIds = productIds.value.filter(productId => !productInfoMap[Number(productId)]);
      if (!filteredProductIds.length) return Promise.resolve();

      const params = { ids: filteredProductIds.join(','), limit: filteredProductIds.length }
      fetchingProducts.value = true
      return backend.get('products/info/', { params })
        .then(response => {
          if (!Array.isArray(response.data?.results)) return Promise.reject({ response });
          response.data?.results.map(productData => {
            const product = Product.parse(productData);
            productInfoMap[Number(product.id)] = product;
          })
          return response;
        })
        .finally(() => {
          fetchingProducts.value = false
        })
    }

    onMounted(() => {
      fetchProductInfos();
    })

    return {
      marketplaceStore,
      productIds,
      products,
      fetchingProducts,
      fetchProductInfos,
    }
  }
})
</script>