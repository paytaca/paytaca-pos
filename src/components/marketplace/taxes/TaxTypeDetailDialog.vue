<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-pa-md rounded-borders" style="width:100%;max-width:560px;max-height:85vh;overflow:auto;">
      <div class="row items-center no-wrap q-mb-sm">
        <div class="text-h6 q-space">
          {{ taxType?.name || $t('TaxType', 'Tax type') }}
        </div>
        <q-btn flat icon="close" padding="sm" v-close-popup />
      </div>

      <div class="q-gutter-y-sm q-mb-md">
        <div class="row items-center">
          <div class="text-grey q-space">{{ $t('Code') }}</div>
          <div>{{ getTaxCodeLabel(taxType?.code) }}</div>
        </div>
        <div class="row items-center">
          <div class="text-grey q-space">{{ $t('Rate', 'Rate') }}</div>
          <div>
            <template v-if="Number.isFinite(taxType?.value)">
              {{ Number(taxType.value.toFixed(2)) }}%
            </template>
            <span v-else class="text-grey">—</span>
          </div>
        </div>
        <div class="row items-center">
          <div class="text-grey q-space">{{ $t('Scope', 'Scope') }}</div>
          <div>
            {{ taxType?.scope === 'custom' ? $t('Custom', 'Custom') : $t('Platform', 'Platform') }}
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
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { taxCodeOptions } from 'src/composables/marketplace/taxTypesForm'
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

    const taxCodeLabelMap = computed(() => {
      const map = {}
      taxCodeOptions.forEach(opt => (map[opt.value] = opt.label))
      return map
    })
    function getTaxCodeLabel(code) {
      return taxCodeLabelMap.value[code] || code || '—'
    }

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
      products,
      fetchingProducts,
      pagination,
      fetchProducts,
    }
  },
})
</script>