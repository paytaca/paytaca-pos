<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="row no-wrap items-start q-pb-sm">
        <div class="q-space">
          <div class="text-h5">{{ product?.name }}</div>
          <!--TODO:-->
          <div class="text-caption text-grey" style="margin-top:-0.5em;">product#{{ product?.id }}</div>
        </div>
        <slot name="menu" v-bind="{ product }"></slot>
      </q-card-section>
      <q-card-section v-if="product?.categories?.length" class="q-pt-none q-pb-sm">
        <div class="text-grey">{{ $t('Categories') }}</div>
        <q-badge v-for="category in product?.categories" :key="category" class="q-mr-sm">
          {{ category }}
        </q-badge>
      </q-card-section>
      <q-card-section v-if="product?.code" class="q-pt-none q-pb-sm">
        <div class="text-grey">{{ $t('Code') }}</div>
        {{ product?.code }}
      </q-card-section>
      <q-card-section v-if="product?.imageUrl" class="row items-center justify-center q-pt-none">
        <img
          :src="product?.imageUrl"
          class="rounded-borders"
          style="max-height:200px; max-width:max(80vw, 300px)"
        />
      </q-card-section>
      <q-card-section v-if="product?.description" class="q-pt-none">
        <div class="text-grey">{{ $t('Description') }}</div>
        {{ product?.description }}
      </q-card-section>
      <q-card-section v-if="product?.totalStocks" class="q-pt-none q-pb-sm">
        <div class="text-grey">{{ $t('Stocks') }}</div>
        {{ product?.totalStocks }}
      </q-card-section>
      <div v-if="fetchingVariants" class="row items-center justify-center q-my-md">
        <q-spinner size="2.5em"/>
      </div>
      <table v-else class="full-width" style="border-spacing:8px;">
        <tr>
          <th v-if="hasVariantImage" class="image-col"></th>
          <th v-if="product.hasVariants">{{ $t('Variant') }}</th>
          <th>{{ $t('Price') }}</th>
          <th>{{ $t('Quantity') }}</th>
          <th></th>
        </tr>
        <template v-for="variant in product?.variants" :key="variant.id">
          <tr>
            <td v-if="hasVariantImage" class="text-center image-col">
              <div class="row items-center justify-center">
                <img
                  v-if="variant.imageUrl"
                  :src="variant.imageUrl"
                  class="rounded-borders"
                  style="width:50px;"
                />
              </div>
            </td>
            <td v-if="product.hasVariants" class="text-left text-subtitle1">
              <div>{{ variant.name }}</div>
              <div v-if="variant?.code" class="text-caption ellipsis">{{  variant.code  }}</div>
            </td>
            <td class="text-center">{{ variant.price }} {{ marketplaceStore?.currency }}</td>
            <td class="text-center">
              <span v-if="variant.totalStocks == 0" class="text-grey">{{ $t('NoStocks') }}</span>
              <span v-else-if="!variant.totalStocks" class="text-grey">{{ $t('NoInventory') }}</span>
              <span v-else>{{ variant.totalStocks }}</span>
            </td>
            <td style="width:3.5em;">
              <slot name="variant-menu" v-bind="{ variant, product }">
                <q-btn flat icon="more_vert" padding="sm">
                  <q-menu anchor="bottom right" self="top right">
                    <q-list separator>
                      <q-item
                        clickable
                        :to="{ name: 'marketplace-stocks', query: { productId: product?.id, variantId: variant?.id } }"
                        v-close-popup
                      >
                        <q-item-section>
                          <q-item-label>{{ $t('GoToInventory') }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </slot>
            </td>
          </tr>
          <tr>
            <td colspan="10"><q-separator/></td>
          </tr>
        </template>
      </table>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { defineComponent, ref, onMounted, computed, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useMarketplaceStore } from 'src/stores/marketplace'


export default defineComponent({
  name: 'ProductInventoryDialog',
  props: {
    modelValue: Boolean,
    productId: Number,
    productObj: {
      type: Product,
      default: () => Product.parse(null),
    },
  },
  emits: [
    'update:model-value',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()
    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))

    const fetchingVariants = ref(false)
    const product = ref(props.productObj)
    onMounted(() => {
      fetchProduct().finally(() => fetchVariants())
    })
    watch(() => [props.productObj?.id], () => {
      product.value = props.productObj
      fetchVariants()
    })
    watch(() => [props.productId], () => fetchProduct())

    function fetchVariants(opts={force: false}) {
      if (product.value?.variants?.length && !opts?.force) return

      fetchingVariants.value = true
      product.value?.fetchVariants()
        .finally(() => {
          fetchingVariants.value = false
        })
    }

    const hasVariantImage = computed(() => {
      return product.value?.variants?.some?.(variant => variant.imageUrl)
    })

    function fetchProduct() {
      if (!props.productId) return Promise.reject()
      return backend.get(`products/${props.productId}/`)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          product.value = Product.parse(response?.data)
          return Promise.resolve(response)
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,
      marketplaceStore,
      fetchingVariants,
      product,
      hasVariantImage,
      fetchProduct,
    }
  },
})
</script>
<style scoped>
th.image-col ,td.image-col {
  width: 10px;
}
</style>
