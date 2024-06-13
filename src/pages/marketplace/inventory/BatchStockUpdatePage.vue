<template>
  <q-page class="q-pa-md q-pb-xl">
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
      <div :class="{ dark: $q.dark.isActive }" class="row stocks-table-container" style="overflow:auto;">
        <table class="stocks-table full-width" :class="{ dark: $q.dark.isActive }">
          <tr>
            <th>{{ $t('Stock') }}</th>
            <th>{{ $t('Quantity') }}</th>
            <th>{{ $t('CostPrice') }}</th>
            <th>{{ $t('ExpiresAt') }}</th>
            <th></th>
          </tr>
          <tr v-for="(formData, index) in formDataList" :key="index">
            <td class="text-weight-medium" @click="() => displayStock(formData.stock)">
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
              <div class="text-caption bottom ellipsis" style="max-width:25vw;">{{ formData.stock.itemName }}</div>
            </td>
            <td>
              <q-input
                dense outlined
                :disable="loading"
                :placeholder="formData.adjustment?.adjustType === 'add' ? '0' : formData?.stock?.quantity"
                type="number"
                v-model.number="formData.adjustment.quantity"
                :error="Boolean(formErrors?.stocks?.[index]?.adjustment?.quantity || formErrors?.stocks?.[index]?.adjustment?.adjustType)"
                :error-message="formErrors?.stocks?.[index]?.adjustment?.quantity || formErrors?.stocks?.[index]?.adjustment?.adjustType"
                reactive-rules
                :rules="[
                  val => formData.adjustment?.adjustType === 'add' || val >= 0 || 'Invalid',
                ]"
                style="min-width:6em;"
              >
                <template v-slot:prepend>
                  <span class="text-body2">
                    {{ formData.adjustment.adjustType }}
                  </span>
                </template>
                <q-menu no-focus class="q-pa-sm">
                  <div class="text-grey text-subtitle2">{{ $t('AdjustType') }}</div>
                  <q-btn-toggle
                    :disable="loading"
                    no-caps
                    padding="2px md"
                    v-model="formData.adjustment.adjustType"
                    toggle-color="brandblue"
                    :options="[
                      {label: $t('Set'), value: 'set'},
                      {label: $t('Add'), value: 'add'},
                    ]"
                    @update:model-value="val => {
                      formData.adjustment.quantity = val === 'set' ?(formData.stock.quantity + formData.adjustment.quantity) : (formData.adjustment.quantity - formData.stock.quantity)
                    }"
                  />
                </q-menu>
              </q-input>
            </td>
            <td>
              <q-input
                dense outlined
                :disable="loading"
                :suffix="marketplaceStore?.currency"
                type="numeric"
                v-model.number="formData.costPrice"
                :error="Boolean(formErrors?.stocks?.[index]?.costPrice)"
                :error-message="formErrors?.stocks?.[index]?.costPrice"
                style="min-width:11em;"
              />
            </td>
            <td>
              <q-input
                dense outlined
                :disable="loading"
                mask="####-##-##"
                v-model="formData.expiresAt"
                :error="Boolean(formErrors?.stocks?.[index]?.expiresAt)"
                :error-message="formErrors?.stocks?.[index]?.expiresAt"
                clearable
                style="min-width:13em;"
              >
                <template v-slot:append>
                  <q-icon name="calendar_today">
                    <q-popup-proxy breakpoint="0">
                      <q-date v-model="formData.expiresAt" mask="YYYY-MM-DD">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup :label="$t('Close')" color="brandblue" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </td>
            <td>
              <q-btn
                :disable="loading"
                icon="close"
                flat padding="sm"
                color="red" class="q-mx-sm"
                @click="() => toggleStock(formData.stock)"
              />
            </td>
          </tr>
        </table>
      </div>
      <div class="fixed-bottom q-pa-sm" style="z-index:5;">
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
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'
import StockSearchDialog from 'src/components/marketplace/inventory/StockSearchDialog.vue'

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
          expires_at: formData.expiresAt ? new Date(formData.expiresAt) : null,
        }

        if (data.expires_at) data.expires_at.setUTCHours(0,0,0,0)

        // remove data thats not updated anyway
        if (data.expires_at?.getTime() === formData.stock.expiresAt?.getTime()) data.expires_at = undefined
        if (data.cost_price === formData.stock.costPrice) data.cost_price = undefined
        if (data.adjustment.adjust_type === 'add' && !formData.adjustment.quantity) data.adjustment = undefined
        else if (data.adjustment.adjust_type === 'set' && formData.adjustment.quantity === formData.stock.quantity) data.adjustment = undefined

        data.$edited = data.adjustment !== undefined ||
                       data.cost_price !== undefined ||
                       data.expires_at !== undefined
        return data
      })
      return dataList
    })

    function resetFormDataList() {
      formDataList.value.forEach(formData => {
        formData.adjustment.adjustType = 'set'
        formData.adjustment.quantity = formData.stock?.quantity
        formData.costPrice = formData.stock?.costPrice
        formData.expiresAt = formData.stock?.expiresAt ? formData.stock?.expiresAt.toISOString() : null
      })
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
        expiresAt: stock?.expiresAt ? stock?.expiresAt.toISOString() : null,
      })
    }

    function removeStockFromList(stock=Stock.parse()) {
      formDataList.value = formDataList.value.filter(formData => {
        return formData.stock?.id !== stock?.id
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
              if (!formErrors.value.stocks[i]) formErrors.value.stocks[i] = { detail: [], adjustment: { adjustType: '', quantity: '' }}

              formErrors.value.stocks[i].adjustment.adjustType = errorParser.firstElementOrValue(stockFormErrors?.adjustment?.adjust_type)
              formErrors.value.stocks[i].adjustment.adjustType = errorParser.firstElementOrValue(stockFormErrors?.adjustment?.adjust_type)
              formErrors.value.stocks[i].costPrice = errorParser.firstElementOrValue(stockFormErrors?.cost_price)
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
      formErrors,
      updateStocks,

      stockDetailDialog,
      displayStock,

      openStockSearchDialog,
    }
  },
})
</script>
<style scoped lang="scss">
.stocks-table-container {
  background-color: $grey-1;
  border-radius: 8px;
}
.stocks-table-container.dark {
  background-color: $dark;
}
table.stocks-table {
  margin-left: auto;
  margin-right: auto;
  border-spacing: 0px;
  padding: 10px 10px 5px 0px;
}
table.stocks-table > tr > td {
  vertical-align: top;
}
table.stocks-table tr th:first-child,
table.stocks-table tr td:first-child {
  padding-left: 10px;
  position: sticky;
  left: 0;
  z-index: 2;
  background-color: $grey-1;
}
table.stocks-table.dark tr th:first-child,
table.stocks-table.dark tr td:first-child {
  background-color: $dark;
}
table.stocks-table tr th {
  position: sticky;
  top: 0;
  z-index: 1;
  // width: 25vw;
  background: $grey-1;
}
table.stocks-table.dark tr th {
  background-color: $dark;
}
</style>
