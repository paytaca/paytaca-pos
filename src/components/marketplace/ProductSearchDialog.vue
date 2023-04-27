<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <q-input
          dense
          outlined
          :loading="loading"
          placeholder="Product name / code"
          v-model="searchVal"
          debounce="500"
          @update:model-value="() => updateProductSearchList()"
        >
          <template v-slot:append>
            <q-icon name="search"/>
          </template>
        </q-input>
      </q-card-section>
      <q-list separator style="max-height:70vh;overflow:auto;">
        <q-virtual-scroll v-if="products?.length" :items="products" v-slot="{ item: product }">
          <q-item clickable @click="() => toggleProduct(product)">
            <q-item-section side>
              <q-checkbox
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
        </q-virtual-scroll>
        <div v-else-if="!searchVal" class="q-pa-md text-grey text-center">
          Search products
        </div>
        <div v-else class="q-pa-md text-grey text-center">
          No data
        </div>

        <q-item
          v-if="pagination?.count > products?.length"
          clickable
          v-ripple
          :disable="loading"
          @click="() => updateStockSearchList({append: true })"
        >
          <q-item-section class="text-center">
            <q-item-label :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'">
              Show more
              <q-spinner v-if="loading"/>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <q-card-actions>
        <q-btn
          v-if="cancel"
          flat
          label="Cancel"
          v-bind="cancel"
          @click="onDialogCancel"
        />
        <q-btn
          v-if="ok"
          color="brandblue"
          label="OK"
          v-bind="ok"
          @click="submit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
<script>
import { Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import { backend } from 'src/marketplace/backend'


export default defineComponent({
  name: 'ProductSearchDialog',
  emits: [
    'update:modelValue',
    'update:selected',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    selected: [Array, Product],
    searchFilterKwargs: Object,
    ok: [Object, Boolean],
    cancel: [Object, Boolean],
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()
    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    const innerSelected = ref(props.selected)
    watch(innerSelected, () => $emit('update:selected', innerSelected.value), { deep: true })
    watch(() =>  [props.selected], () => innerSelected.value = props.selected, { deep: true })
    const multiple = computed(() => Array.isArray(innerSelected.value))

    const loading = ref(false)
    const searchVal = ref('')
    const products = ref([].map(Product.parse))
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
          
          if (opts?.append) products.value.push(..._products)
          else products.value = _products
          pagination.value.count = response?.data?.count || 0
          pagination.value.limit = response?.data?.limit || 0
          pagination.value.offset = response?.data?.offset || 0
        })
        .then(() => {
          innerSelected.value.forEach(product => {
            if (products.value.find(_product => _product?.id == product?.id)) return
            products.value.push(product)
          })
        })
        .finally(() => {
          loading.value = false
        })
    }

    function toggleProduct(product=Product.parse()) {
      if (productIdExists(product?.id)) removeProductFromList(product)
      else addProductToList(product)
    }

    function productIdExists(productId) {
      if (multiple.value) return innerSelected.value.some(product => product?.id === productId)
      return innerSelected.value?.id === productId
    }

    function addProductToList(product=Product.parse()) {
      if (multiple.value) innerSelected.value.push(product)
      else innerSelected.value = product
    }

    function removeProductFromList(product=Product.parse()) {
      if (multiple.value) {
        innerSelected.value = innerSelected.value.filter(_product => {
          return _product?.id !== product?.id
        })
      } else {
        innerSelected.value = null
      }
    }


    function submit() {
      onDialogOK(innerSelected.value)
    }

  
    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      marketplaceStore,
      innerVal,

      loading,
      searchVal,
      products,
      pagination,
      updateProductSearchList,

      toggleProduct,
      productIdExists,

      submit,
    }
  },
})
</script>
