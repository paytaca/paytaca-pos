<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <q-input
          dense
          outlined
          :loading="loading"
          :placeholder="$t('PoItemName2')"
          v-model="searchVal"
          debounce="500"
          @update:model-value="() => updateStockSearchList()"
        >
          <template v-slot:append>
            <q-icon name="search"/>
          </template>
        </q-input>
      </q-card-section>
      <q-list separator style="max-height:70vh;overflow:auto;">
        <template v-if="stocks?.length">
          <q-item
            v-for="stock in stocks" :key="stock?.id"
            clickable
            @click="() => toggleStock(stock)"
          >
            <q-item-section side>
              <q-checkbox
                :model-value="Boolean(stockIdExists(stock?.id))"
                @click="() => toggleStock(stock)"
              />
            </q-item-section>
            <q-item-section top>
              <q-item-label v-if="isSingleVariant">
                <template v-if="stock?.purchaseOrderNumber">{{ stock?.purchaseOrderNumber }}</template>
                <i v-else class="text-grey">{{ $t('NoPurchaseOrder') }}</i>
              </q-item-label>
              <q-item-label v-else>{{ stock?.itemName }}</q-item-label>
              <q-item-label class="text-caption">#{{ stock?.id }}</q-item-label>
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{
                  $t(
                    'QuantityDisplayText',
                    { totalStocks: stock?.quantity },
                    `Qty: ${stock?.quantity}`
                  )
                }}
              </q-item-label>
              <q-item-label>
                {{
                  $t(
                    'CostPrice',
                    { price: stock?.costPrice, currency: marketplaceStore?.currency },
                    `Cost Price: ${stock?.costPrice} ${marketplaceStore?.currency}`
                  )
                }}
              </q-item-label>
              <q-item-label v-if="context === 'sales' && stock?.expiresAt">
                <template v-if="stock?.expiresAt?.getTime() <= Date.now()">
                  {{ $t('Expired') }}:
                </template>
                <template v-else>{{ $t('Expires') }}:</template>
                {{ formatDateRelative(stock.expiresAt) }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </template>
        <div v-else-if="!searchVal" class="q-pa-md text-grey text-center">
          {{ $t('SearchStocks') }}
        </div>
        <div v-else class="q-pa-md text-grey text-center">
          {{ $t('NoData') }}
        </div>

        <q-item
          v-if="pagination?.count > stocks?.length"
          clickable
          v-ripple
          :disable="loading"
          @click="() => updateStockSearchList({append: true })"
        >
          <q-item-section class="text-center">
            <q-item-label :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'">
              {{ $t('ShowMore') }}
              <q-spinner v-if="loading"/>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <div class="row items-center q-pa-sm q-gutter-x-sm q-mt-sm">
        <q-btn
          v-if="cancel"
          flat
          :label="$t('Cancel')"
          v-bind="cancel"
          class="q-space"
          @click="onDialogCancel"
        />
        <q-btn
          v-if="ok"
          color="brandblue"
          :label="$t('OK')"
          v-bind="ok"
          class="q-space"
          @click="submit"
        />
      </div>
    </q-card>
  </q-dialog>
</template>
<script>
import { Stock } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { formatDateRelative } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'StockSearchDialog',
  emits: [
    'update:modelValue',
    'update:selected',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    context: String, // where the component is used (e.g. sales, batch-update, stock-recount)
    modelValue: Boolean,
    selected: [Array, Stock],
    searchFilterKwargs: Object,
    ok: [Object, Boolean],
    cancel: [Object, Boolean],
  },
  setup(props, {emit: $emit}) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()
    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    const innerSelected = ref(props.selected)
    watch(innerSelected, () => $emit('update:selected', innerSelected.value), { deep: true })
    watch(() =>  [props.selected], () => innerSelected.value = props.selected, { deep: true })
    const multiple = computed(() => Array.isArray(innerSelected.value))

    const isSingleVariant = computed(() => {
      if (!props.searchFilterKwargs?.variant_id) return false

      const variantIds = stocks.value.map(stock => stock?.variant?.id)
      const mainVariantId = variantIds[0]
      return variantIds.every(variantId => variantId == mainVariantId)
    })

    const loading = ref(false)
    const searchVal = ref('')
    const stocks = ref([].map(Stock.parse))
    const pagination = ref({ offset: 0, limit: 0, count: 0})
    onMounted(() => updateStockSearchList())
    function updateStockSearchList(opts={append: false}) {
      const params = Object.assign({}, props.searchFilterKwargs, {
        limit: 5,
        offset: undefined,
        s: searchVal.value,
        shop_id: marketplaceStore.activeShopId || null,
      })

      if (opts?.append) {
        params.offset = pagination.value.limit + pagination.value.offset
      }

      loading.value = true
      backend.get(`stocks/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return
          const _stocks = response?.data?.results.map(Stock.parse)
          
          if (opts?.append) stocks.value.push(..._stocks)
          else stocks.value = _stocks
          pagination.value.count = response?.data?.count || 0
          pagination.value.limit = response?.data?.limit || 0
          pagination.value.offset = response?.data?.offset || 0
        })
        .finally(() => {
          loading.value = false
        })
    }

    function toggleStock(stock=Stock.parse()) {
      if (stockIdExists(stock?.id)) removeStockFromList(stock)
      else addStockToList(stock)
    }

    function stockIdExists(stockId) {
      if (multiple.value) return innerSelected.value.some(stock => stock?.id === stockId)
      return innerSelected.value?.id === stockId
    }

    function addStockToList(stock=Stock.parse()) {
      if (multiple.value) innerSelected.value.push(stock)
      else innerSelected.value = stock
    }

    function removeStockFromList(stock=Stock.parse()) {
      if (multiple.value) {
        innerSelected.value = innerSelected.value.filter(_stock => {
          return _stock?.id !== stock?.id
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
      innerSelected,
      innerVal,

      isSingleVariant,

      loading,
      searchVal,
      stocks,
      pagination,
      updateStockSearchList,

      toggleStock,
      stockIdExists,
      addStockToList,
      removeStockFromList,

      submit,

      // utils funcs
      formatDateRelative,
    }
  },
})
</script>
