<template>
  <q-page class="q-pa-md batch-stock-update-page">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">{{ $t('StockUpdate') }}</div>
          <div class="text-grey">{{ $t('Marketplace') }}</div>
        </div>
      </template>
    </MarketplaceHeader>
    <div class="row">
      <q-chip
        no-caps rounded
        padding="2px 0.75em"
      >
        {{
          $t(
            'NumberOfStocks',
            {
              count: formDataList?.length,
              unit: formDataList?.length === 1 ? $t('stock') : $t('stocks')
            },
            `${formDataList?.length} ${ formDataList?.length === 1 ? $t('stock') : $t('stocks') }`
          )
        }}
      </q-chip>
      <q-space/>
      <q-btn
        flat
        :disable="loading"
        padding="none sm"
        no-caps
        @click="() => openStockSearchDialog()"
      >
        <q-icon name="add"/>
        <span class="text-underline">{{ $t('EditMoreStocks') }}</span>
      </q-btn>
    </div>
    <q-form @submit="() => updateStocks()">
      <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-sm">
        <div v-if="formErrors?.detail?.length === 1">
          {{ formErrors.detail[0] }}
        </div>
        <ul v-else class="q-pl-md">
          <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
        </ul>
      </q-banner>
      <div
        :class="[
          { dark: $q.dark.isActive },
          $q.screen.lt.md ? 'stocks-table-container--cards' : 'stocks-table-container--table',
        ]"
        class="stocks-table-container"
      >
        <div class="stocks-grid stocks-grid--header">
          <div class="stock-cell stock-area--stock">{{ $t('Stock') }}</div>
          <div class="stock-cell stock-area--quantity">{{ $t('Quantity') }}</div>
          <div class="stock-cell stock-area--cost">{{ $t('CostPrice') }}</div>
          <div class="stock-cell stock-area--expires">{{ $t('ExpiresAt') }}</div>
          <div class="stock-cell stock-area--manufactured">{{ $t('ManufacturedAt', 'Manufactured at') }}</div>
          <div class="stock-cell stock-area--actions"></div>
        </div>
        <div
          v-for="(formData, index) in formDataList"
          :key="formData.stock?.id || index"
          class="stocks-grid stocks-grid--row"
          :class="{ 'stocks-grid--edited': serializedFormDataList[index]?.$edited }"
        >
          <div class="stock-cell stock-cell--stock stock-area--stock text-weight-medium" @click="() => displayStock(formData.stock)">
            <div>
              {{
                $t(
                  'StockId',
                  { id: formData?.stock?.id },
                  `Stock#${formData?.stock?.id}`
                )
              }}
              <template v-if="serializedFormDataList[index]?.$edited">
                *
              </template>
            </div>
            <div class="text-caption bottom ellipsis">{{ formData.stock.itemName }}</div>
          </div>
          <div class="stock-cell stock-cell--quantity stock-area--quantity">
            <div class="stock-field-label">{{ $t('Quantity') }}</div>
            <q-input
              dense outlined
              :disable="loading"
              :placeholder="formData.adjustment?.adjustType === 'add' ? '0' : formData?.stock?.quantity"
              type="number"
              v-model.number="formData.adjustment.quantity"
              :error="Boolean(formErrors?.stocks?.[index]?.adjustment?.quantity || formErrors?.stocks?.[index]?.adjustment?.adjustType)"
              :error-message="formErrors?.stocks?.[index]?.adjustment?.quantity || formErrors?.stocks?.[index]?.adjustment?.adjustType"
              :hint="quantityAdjustmentHint(formData)"
              reactive-rules
              :rules="[
                val => formData.adjustment?.adjustType === 'add' || val >= 0 || 'Invalid',
              ]"
              class="full-width"
            >
              <template v-slot:prepend>
                <q-btn
                  flat
                  dense
                  no-caps
                  :disable="loading"
                  :label="formData.adjustment.adjustType === 'set' ? $t('Set') : $t('Add')"
                  padding="xs"
                  class="stock-adjust-type"
                  @click.stop="() => toggleAdjustType(formData)"
                />
              </template>
            </q-input>
          </div>
          <div class="stock-cell stock-cell--cost stock-area--cost">
            <div class="stock-field-label">{{ $t('CostPrice') }}</div>
            <q-input
              dense outlined
              :disable="loading"
              :suffix="marketplaceStore?.currency"
              type="numeric"
              v-model.number="formData.costPrice"
              :error="Boolean(formErrors?.stocks?.[index]?.costPrice)"
              :error-message="formErrors?.stocks?.[index]?.costPrice"
              class="full-width"
            />
          </div>
          <div class="stock-cell stock-cell--expires stock-area--expires">
            <div class="stock-field-label">{{ $t('ExpiresAt') }}</div>
            <q-field
              dense outlined
              :disable="loading"
              :model-value="formData.expiresAt"
              :error="Boolean(formErrors?.stocks?.[index]?.expiresAt)"
              :error-message="formErrors?.stocks?.[index]?.expiresAt"
              clearable
              class="full-width"
              @clear="() => (formData.expiresAt = null)"
            >
              <template v-slot:control>
                <div
                  class="full-width no-outline cursor-pointer ellipsis"
                  tabindex="0"
                  @click="!loading && openDateTimePicker(formData, 'expiresAt', $t('ExpiresAt'))"
                >
                  <span v-if="formData.expiresAt">{{ formatTimestampToText(formData.expiresAt) }}</span>
                  <span v-else class="text-grey">{{ $t('Optional') }}</span>
                </div>
              </template>
              <template v-slot:append>
                <q-icon
                  name="event"
                  class="cursor-pointer"
                  @click.stop="!loading && openDateTimePicker(formData, 'expiresAt', $t('ExpiresAt'))"
                />
              </template>
            </q-field>
          </div>
          <div class="stock-cell stock-cell--manufactured stock-area--manufactured">
            <div class="stock-field-label">{{ $t('ManufacturedAt', 'Manufactured at') }}</div>
            <q-field
              dense outlined
              :disable="loading"
              :model-value="formData.manufacturedAt"
              :error="Boolean(formErrors?.stocks?.[index]?.manufacturedAt)"
              :error-message="formErrors?.stocks?.[index]?.manufacturedAt"
              clearable
              class="full-width"
              @clear="() => (formData.manufacturedAt = null)"
            >
              <template v-slot:control>
                <div
                  class="full-width no-outline cursor-pointer ellipsis"
                  tabindex="0"
                  @click="!loading && openDateTimePicker(formData, 'manufacturedAt', $t('ManufacturedAt', 'Manufactured at'))"
                >
                  <span v-if="formData.manufacturedAt">{{ formatTimestampToText(formData.manufacturedAt) }}</span>
                  <span v-else class="text-grey">{{ $t('Optional') }}</span>
                </div>
              </template>
              <template v-slot:append>
                <q-icon
                  name="event"
                  class="cursor-pointer"
                  @click.stop="!loading && openDateTimePicker(formData, 'manufacturedAt', $t('ManufacturedAt', 'Manufactured at'))"
                />
              </template>
            </q-field>
          </div>
          <div class="stock-cell stock-cell--actions stock-area--actions">
            <q-btn
              :disable="loading || !serializedFormDataList[index]?.$edited"
              icon="restart_alt"
              flat round dense
              color="grey-7"
              @click="() => resetStockFormData(formData, index)"
            >
              <q-tooltip>{{ $t('Reset', 'Reset') }}</q-tooltip>
            </q-btn>
            <q-btn
              :disable="loading"
              icon="close"
              flat round dense
              color="red"
              @click="() => toggleStock(formData.stock)"
            >
              <q-tooltip>{{ $t('RemoveStock', 'Remove stock') }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </div>
      <div class="fixed-bottom batch-update-footer q-pa-sm" style="z-index:5;">
        <q-btn
          :disable="loading || serializedFormDataList.every(d => !d.$edited)"
          :loading="loading"
          no-caps
          :label="$t('Update')"
          color="brandblue"
          class="full-width"
          type="submit"
        />
      </div>
    </q-form>
    <StockDetailDialog v-model="stockDetailDialog.show" :stock="stockDetailDialog.stock"/>
  </q-page>
</template>
<script>
import { Stock } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { errorParser, formatTimestampToText } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'
import StockSearchDialog from 'src/components/marketplace/inventory/StockSearchDialog.vue'
import DateTimePickerDialog from 'src/components/DateTimePickerDialog.vue'

export default defineComponent({
  name: 'BatchStockUpdatePage',
  components: {
    MarketplaceHeader,
    StockDetailDialog,
  },
  props: {
    stockIds: String,
  },
  setup(props) {
    const $q = useQuasar()
    const { t } = useI18n()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    const loading = ref(false)
    const formDataList = ref([].map(() => {
      return {
        stock: Stock.parse(),
        adjustment: {
          adjustType: 'set', // set | add,
          quantity: 0,
        },
        costPrice: null,
        manufacturedAt: null,
        expiresAt: null,
      }
    }))

    const serializedFormDataList = computed(() => {
      const dataList = formDataList.value.map(formData => {
        const data = {
          stock_id: formData.stock.id,
          adjustment: {
            adjust_type: formData.adjustment.adjustType,
            quantity: formData.adjustment.quantity,
          },
          cost_price: formData.costPrice,
          manufactured_at: formData.manufacturedAt ? new Date(formData.manufacturedAt) : null,
          expires_at: formData.expiresAt ? new Date(formData.expiresAt) : null,
        }

        // remove data thats not updated anyway
        if (data.manufactured_at?.getTime() === formData.stock.manufacturedAt?.getTime()) data.manufactured_at = undefined
        if (data.expires_at?.getTime() === formData.stock.expiresAt?.getTime()) data.expires_at = undefined
        if (data.cost_price === formData.stock.costPrice) data.cost_price = undefined
        if (data.adjustment.adjust_type === 'add' && !formData.adjustment.quantity) data.adjustment = undefined
        else if (data.adjustment.adjust_type === 'set' && formData.adjustment.quantity === formData.stock.quantity) data.adjustment = undefined

        data.$edited = data.adjustment !== undefined ||
                       data.cost_price !== undefined ||
                       data.manufactured_at !== undefined ||
                       data.expires_at !== undefined
        return data
      })
      return dataList
    })

    function resetStockFormData(formData, index) {
      formData.adjustment.adjustType = 'set'
      formData.adjustment.quantity = formData.stock?.quantity
      formData.costPrice = formData.stock?.costPrice
      formData.manufacturedAt = formData.stock?.manufacturedAt ? formData.stock?.manufacturedAt.toISOString() : null
      formData.expiresAt = formData.stock?.expiresAt ? formData.stock?.expiresAt.toISOString() : null
      if (Number.isInteger(index) && formErrors.value.stocks?.[index]) formErrors.value.stocks[index] = undefined
    }

    function resetFormDataList() {
      formDataList.value.forEach(formData => resetStockFormData(formData))
    }

    onMounted(() => {
      if (!props.stockIds) return
      const params = { ids: props.stockIds }
      backend.get(`stocks/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          response?.data?.results.map(Stock.parse).forEach(addStockToList)
          return response
        })
    })

    function stockIdExists(stockId) {
      return formDataList.value.some(formData => formData.stock?.id === stockId)
    }

    function toggleStock(stock=Stock.parse()) {
      if (stockIdExists(stock?.id)) removeStockFromList(stock)
      else addStockToList(stock)
    }

    function addStockToList(stock=Stock.parse()) {
      const index = formDataList.value.findIndex(formData => formData.stock?.id === stock?.id)
      if (index >= 0) return

      formDataList.value.push({
        stock: stock,
        adjustment: {
          adjustType: 'set',
          quantity: stock?.quantity,
        },
        costPrice: stock?.costPrice,
        manufacturedAt: stock?.manufacturedAt ? stock?.manufacturedAt.toISOString() : null,
        expiresAt: stock?.expiresAt ? stock?.expiresAt.toISOString() : null,
      })
    }

    function removeStockFromList(stock=Stock.parse()) {
      formDataList.value = formDataList.value.filter(formData => {
        return formData.stock?.id !== stock?.id
      })
    }

    function setAdjustType(formData, adjustType) {
      if (formData.adjustment.adjustType === adjustType) return
      const stockQuantity = Number(formData.stock?.quantity) || 0
      const currentQuantity = Number(formData.adjustment.quantity) || 0
      formData.adjustment.quantity = adjustType === 'set'
        ? stockQuantity + currentQuantity
        : currentQuantity - stockQuantity
      formData.adjustment.adjustType = adjustType
    }

    function toggleAdjustType(formData) {
      setAdjustType(formData, formData.adjustment.adjustType === 'set' ? 'add' : 'set')
    }

    function quantityAdjustmentHint(formData) {
      if (formData.adjustment?.adjustType !== 'add') return ''
      const previousQuantity = Number(formData.stock?.quantity) || 0
      const adjustmentQuantity = Number(formData.adjustment?.quantity) || 0
      const resultingQuantity = previousQuantity + adjustmentQuantity
      return t('QuantityAdjustmentHint', { previous: previousQuantity, result: resultingQuantity }, `${previousQuantity} -> ${resultingQuantity}`)
    }

    function openDateTimePicker(target, field, title) {
      $q.dialog({
        component: DateTimePickerDialog,
        componentProps: {
          modelValue: target[field] || '',
          title,
        },
      }).onOk(iso => {
        target[field] = iso
      })
    }

    const formErrors = ref({
      detail: [].map(String),
      stocks: [].map(() => {
        return {
          adjustment: {
            adjustType: '',
            quantity: '',
          },
          costPrice: '',
          manufacturedAt: '',
          expiresAt: '',
        }
      }) 
    })
    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.stocks = []
    }

    function updateStocks() {
      const dataList = serializedFormDataList.value
      const data = { stocks: dataList }
      data.stocks.forEach(d => delete d.$edited)
      if (!dataList?.length) {
        return $q.dialog({ title: t('NoStocksToUpdate') })
      }

      const dialog = $q.dialog({
        title: t('UpdatingStocks'),
        progress: true,
        persistent: true,
        ok: false,
      })
      loading.value = true
      return backend.post(`stocks/batch_update/`, data)
        .finally(() => clearFormErrors())
        .then(response => {
          if (!Array.isArray(response?.data)) return Promise.reject({ response })
          const updatedStocks = response?.data?.map(Stock.parse)
          formDataList.value.forEach(formData => {
            const updatedStock = updatedStocks.find(stock => formData.stock?.id === stock?.id)
            if (updatedStock) formData.stock = updatedStock
            else formData.stock?.refetch?.()
          })
          resetFormDataList()
          dialog.update({
            title: t('StocksUpdated'),
            ok: { noCaps: true, label: t('Return'), flat: true, color: 'brandblue' },
            cancel: { noCaps: true, label: t('StayOnPage'), flat: true, color: 'grey' },
          }).onOk(() => $router.go(-1))
          return response
        })
        .catch(error => {
          // resolve error msg for dialog
          const data = error?.response?.data
          let msg = errorParser.firstElementOrValue(data?.non_field_errors)
          if (!msg) msg = data?.detail
          dialog.update({
            title: t('StocksUpdateError'),
            message: msg || t('EncounteredErrorInUpdatingStocks'),
          })
          return Promise.reject(error)
        })
        .catch(error => {
          // resolve error msgs for form
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          if (Array.isArray(data?.stocks)) {
            if (!Array.isArray(formErrors.value.stocks)) formErrors.value.stocks = []
            for(var i = 0; i < data.stocks.length; i++) {
              const stockFormErrors = data.stocks[i]
              if (!formErrors.value.stocks[i]) formErrors.value.stocks[i] = {
                detail: [],
                adjustment: { adjustType: '', quantity: '' },
                costPrice: '',
                manufacturedAt: '',
                expiresAt: '',
              }

              formErrors.value.stocks[i].adjustment.adjustType = errorParser.firstElementOrValue(stockFormErrors?.adjustment?.adjust_type)
              formErrors.value.stocks[i].adjustment.quantity = errorParser.firstElementOrValue(stockFormErrors?.adjustment?.quantity)
              formErrors.value.stocks[i].costPrice = errorParser.firstElementOrValue(stockFormErrors?.cost_price)
              formErrors.value.stocks[i].manufacturedAt = errorParser.firstElementOrValue(stockFormErrors?.manufactured_at)
              formErrors.value.stocks[i].expiresAt = errorParser.firstElementOrValue(stockFormErrors?.expires_at)
            }
          }

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]
          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = [t('EncounteredErrorsInUpdatingStocks')]
          }
        })
        .finally(() => {
          dialog.update({ persistent: false, progress: false })
          loading.value = false
        })
    }

    const stockDetailDialog = ref({ show: false, stock: Stock.parse() })
    function displayStock(stock=Stock.parse()) {
      stockDetailDialog.value.stock = stock
      stockDetailDialog.value.show = true
    }

    function openStockSearchDialog() {
      $q.dialog({
        component: StockSearchDialog,
        componentProps: {
          selected: formDataList.value.map(item => item?.stock).filter(Boolean),
          ok: true,
        }
      }).onOk(stocks => {
        formDataList.value = formDataList.value.filter(item => {
          return stocks.find(stock => item.stock.id === stock.id)
        })
        stocks.map(stock => {
          if (stockIdExists(stock.id)) return
          addStockToList(stock)
        })
      })
    }

    return {
      marketplaceStore,
      loading,
      formDataList,
      serializedFormDataList,
      stockIdExists,
      toggleStock,
      addStockToList,
      removeStockFromList,
      toggleAdjustType,
      quantityAdjustmentHint,
      openDateTimePicker,
      resetStockFormData,
      formErrors,
      updateStocks,

      stockDetailDialog,
      displayStock,

      openStockSearchDialog,

      // utils funcs
      formatTimestampToText,
    }
  },
})
</script>
<style scoped lang="scss">
.batch-stock-update-page {
  padding-bottom: calc(4rem + env(safe-area-inset-bottom)) !important;
}

.stocks-table-container {
  border-radius: 8px;
}

.stocks-grid {
  display: grid;
  align-items: start;
  gap: 12px;
  padding: 10px 12px;
}

.stocks-grid--header {
  position: sticky;
  top: 0;
  z-index: 1;
  padding-top: 12px;
  padding-bottom: 8px;
  font-weight: 500;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  background-color: $grey-1;
}
.stocks-table-container.dark .stocks-grid--header {
  border-bottom-color: rgba(255, 255, 255, 0.12);
  background-color: $dark;
}

.stocks-grid--row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  background-color: $grey-1;
}
.stocks-table-container.dark .stocks-grid--row {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background-color: $dark;
}
.stocks-grid--row:last-child {
  border-bottom: none;
}
.stocks-grid--edited {
  background-color: rgba(33, 150, 243, 0.08);
}
.stocks-table-container.dark .stocks-grid--edited {
  background-color: rgba(33, 150, 243, 0.16);
}

.stock-cell {
  min-width: 0;
}
.stock-area--stock {
  grid-area: stock;
}
.stock-area--quantity {
  grid-area: quantity;
}
.stock-area--cost {
  grid-area: cost;
}
.stock-area--expires {
  grid-area: expires;
}
.stock-area--manufactured {
  grid-area: manufactured;
}
.stock-area--actions {
  grid-area: actions;
}
.stock-cell--stock {
  cursor: pointer;
}
.stock-cell--actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.stock-adjust-type {
  min-width: 2.5em;
  justify-content: flex-start;
}
.stock-field-label {
  display: none;
}

.stocks-table-container--table {
  overflow-x: auto;

  .stocks-grid {
    grid-template-areas:
      "stock quantity cost expires manufactured actions";
    grid-template-columns:
      minmax(12rem, 2fr)
      minmax(8rem, 1fr)
      minmax(9rem, 1fr)
      minmax(11rem, 1.1fr)
      minmax(11rem, 1.1fr)
      5.5rem;
  }
}

.stocks-table-container--cards {
  overflow: visible;

  .stocks-grid--header {
    display: none;
  }

  .stocks-grid--row {
    grid-template-areas:
      "stock actions"
      "quantity cost"
      "expires manufactured";
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;
    margin-bottom: 12px;
    padding: 12px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
  }

  &.dark .stocks-grid--row {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .stocks-grid--row:last-child {
    margin-bottom: 0;
  }

  .stock-cell--actions {
    align-items: flex-start;
    margin-top: -4px;
  }

  .stock-field-label {
    display: block;
    margin-bottom: 4px;
    color: $grey-6;
    font-size: 12px;
  }

  &.dark .stock-field-label {
    color: $grey-5;
  }
}

.batch-update-footer {
  background-color: $grey-1;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}
.q-dark .batch-update-footer,
.body--dark .batch-update-footer {
  background-color: $dark;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.35);
}
</style>
