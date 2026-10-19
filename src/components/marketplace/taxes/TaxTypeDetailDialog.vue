<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="rounded-borders column no-wrap" style="width:100%;max-width:560px;max-height:85vh;">
      <div class="q-pa-md row items-center no-wrap">
        <div class="text-h6 q-space">
          {{ taxType?.name || $t('TaxType', 'Tax type') }}
        </div>
        <q-btn flat icon="close" padding="sm" v-close-popup />
      </div>

      <q-separator />

      <div class="q-pa-md col overflow-auto">
        <div class="q-gutter-y-sm q-mb-md">
          <div class="row items-center">
            <div class="text-grey q-space">{{ $t('Code') }}</div>
            <div>{{ getTaxCodeLabel(taxType?.code) }}</div>
          </div>
          <div class="row items-center">
            <div class="text-grey q-space">{{ $t('Rate', 'Rate') }}</div>
            <div>
              <template v-if="taxRateLabel(taxType)">
                {{ taxRateLabel(taxType) }}
              </template>
              <span v-else class="text-grey">—</span>
            </div>
          </div>
          <div v-if="taxType?.source" class="row items-center">
            <div class="text-grey q-space">{{ $t('Source') }}</div>
            <div>
              {{ taxType?.source === 'custom' ? $t('Custom') : $t('Platform') }}
            </div>
          </div>
          <div v-if="isDefault" class="row items-center">
            <div class="text-grey q-space">{{ $t('Default', 'Default') }}</div>
            <q-chip dense size="sm" color="amber-1" text-color="dark" icon="star">
              {{ $t('DefaultTaxType', 'Default tax type') }}
            </q-chip>
          </div>
        </div>

        <q-separator />

        <div class="text-subtitle1 q-mt-md q-mb-sm">{{ $t('Products') }}</div>

        <div v-if="fetchingProducts" class="text-center q-pa-md">
          <q-spinner color="brandblue" />
        </div>
        <div v-else-if="!products.length" class="text-grey text-center q-pa-md">
          {{ $t('NoProductsUnderTaxType', 'No products are using this tax type.') }}
        </div>
        <q-list v-else separator>
          <q-item v-for="product in products" :key="product.id">
            <q-item-section v-if="product.displayImageUrl" avatar>
              <img :src="product.displayImageUrl" width="40" class="rounded-borders" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ product.name }}</q-item-label>
              <q-item-label caption>#{{ product.id }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label v-if="product.markupPriceRangeText">
                {{ product.markupPriceRangeText }}
                {{ marketplaceStore.currency }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <div class="row items-center q-mt-sm">
          <div class="text-caption text-grey">
            {{ products.length }} / {{ pagination.count }}
          </div>
          <q-space />
          <LimitOffsetPagination
            :pagination-props="{
              maxPages: 5,
              rounded: true,
              padding: 'sm',
              flat: true,
              boundaryNumbers: true,
            }"
            :hide-below-pages="2"
            :modelValue="pagination"
            @update:modelValue="fetchProducts"
          />
        </div>
      </div>

      <template v-if="$slots.actions">
        <q-separator />
        <div class="q-pa-md actions-footer">
          <slot name="actions" :tax-type="taxType" />
        </div>
      </template>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { useTaxTypeHelpers } from 'src/composables/marketplace/taxTypesForm'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'

export default defineComponent({
  name: 'TaxTypeDetailDialog',
  components: {
    LimitOffsetPagination,
  },
  props: {
    modelValue: Boolean,
    taxType: Object,
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { t: $t } = useI18n()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const { getTaxCodeLabel, taxRateLabel } = useTaxTypeHelpers()

    const isDefault = computed(() => {
      const defaultTaxTypeId = marketplaceStore.shopSettings?.defaultTaxType?.id
      return Boolean(props.taxType?.id && defaultTaxTypeId && props.taxType.id == defaultTaxTypeId)
    })

    const products = ref([].map(Product.parse))
    const fetchingProducts = ref(false)
    const pagination = ref({ offset: 0, limit: 10, count: 0 })
    function fetchProducts(opts = { limit: 0, offset: 0 }) {
      if (!props.taxType?.id) return Promise.resolve()
      const params = {
        shop_id: marketplaceStore.activeShopId,
        tax_type_ids: props.taxType.id,
        limit: opts?.limit || pagination.value.limit || 10,
        offset: opts?.offset || 0,
      }

      fetchingProducts.value = true
      return backend.get(`products/info/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          products.value = response.data.results.map(Product.parse)
          pagination.value.limit = response?.data?.limit || pagination.value.limit
          pagination.value.offset = response?.data?.offset || 0
          pagination.value.count = response?.data?.count || 0
          return response
        })
        .finally(() => {
          fetchingProducts.value = false
        })
    }

    onMounted(() => fetchProducts())
    watch(() => [props.taxType?.id], () => fetchProducts())

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,
      marketplaceStore,
      isDefault,
      getTaxCodeLabel,
      taxRateLabel,
      products,
      fetchingProducts,
      pagination,
      fetchProducts,
    }
  },
})
</script>
<style scoped>
.actions-footer {
  width: 100%;
  max-width: 350px;
  margin-left: auto;
  margin-right: auto;
}
.actions-footer :deep(.q-btn-dropdown--split) {
  width: 100%;
}
.actions-footer :deep(.q-btn-dropdown--split > .q-btn-item) {
  flex: 1 1 auto;
  min-width: 0;
}
.actions-footer :deep(.q-btn-dropdown--split > .q-btn-dropdown__arrow-container) {
  flex: 0 0 auto;
}
</style>
