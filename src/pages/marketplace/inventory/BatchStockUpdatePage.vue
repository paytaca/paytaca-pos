<template>
  <q-page class="q-pa-md q-pb-xl">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Stock Update</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <div class="row">
      <q-chip
        no-caps rounded
        padding="2px 0.75em"
      >
        {{ formDataList?.length }}
        {{ formDataList?.length === 1 ? 'stock' : 'stocks' }}
      </q-chip>
      <q-space/>
      <q-btn
        flat
        :disable="loading"
        padding="none sm"
        no-caps
        @click="() => stocksSearchDialog.show = true"
      >
        <q-icon name="add"/>
        <span class="text-underline">Edit more stocks</span>
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
      <table class="stocks-table full-width">
        <tr>
          <th>Stock</th>
          <th>Quantity</th>
          <th>Cost Price</th>
        </tr>
        <tr v-for="(formData, index) in formDataList" :key="index">
          <td class="text-weight-medium" @click="() => displayStock(formData.stock)">
            <div>Stock#{{ formData?.stock?.id }}</div>
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
            >
              <template v-slot:prepend>
                <span class="text-body2">
                  {{ formData.adjustment.adjustType }}
                </span>
              </template>
              <q-menu no-focus class="q-pa-sm">
                <div class="text-grey text-subtitle2">Adjust type</div>
                <q-btn-toggle
                  :disable="loading"
                  no-caps
                  padding="2px md"
                  v-model="formData.adjustment.adjustType"
                  toggle-color="brandblue"
                  :options="[
                    {label: 'Set', value: 'set'},
                    {label: 'Add', value: 'add'},
                  ]"
                  @update:model-value="val => {
                    formData.adjustment.quantity = val === 'set' ? (formData.stock.quantity + formData.adjustment.quantity) : (formData.adjustment.quantity - formData.stock.quantity)
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
            />
          </td>
        </tr>
      </table>
      <div class="fixed-bottom q-pa-sm">
        <q-btn
          :disable="loading"
          :loading="loading"
          no-caps
          label="Update"
          color="brandblue"
          class="full-width"
          type="submit"
        />
      </div>
    </q-form>
    <StockDetailDialog v-model="stockDetailDialog.show" :stock="stockDetailDialog.stock"/>
    <q-dialog
      v-model="stocksSearchDialog.show"
      position="bottom"
      @show="() => updateStockSearchList()"
    >
      <q-card>
        <q-card-section>
          <q-input
            dense
            outlined
            :loading="stocksSearchDialog.loading"
            placeholder="Item name / PO#"
            v-model="stocksSearchDialog.searchVal"
            debounce="500"
            @update:model-value="() => updateStockSearchList()"
          >
            <template v-slot:append>
              <q-icon name="search"/>
            </template>
          </q-input>
        </q-card-section>
        <q-list separator style="max-height:70vh;overflow:auto;">
          <template v-if="stocksSearchDialog.stocks?.length">
            <q-item
              v-for="stock in stocksSearchDialog.stocks" :key="stock?.id"
              clickable
              @click="() => toggleStock(stock)"
            >
              <q-item-section side>
                <q-checkbox
                  :model-value="Boolean(stockIdExists(stock?.id))"
                  @click="() => toggleStock(stock)"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ stock?.itemName }}</q-item-label>
                <q-item-label class="text-caption">#{{ stock?.id }}</q-item-label>
              </q-item-section>
              <q-item-section>
                <q-item-label>Qty: {{ stock?.quantity }}</q-item-label>
                <q-item-label>Cost Price: {{ stock?.costPrice }} {{ marketplaceStore?.currency }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <div v-else-if="!stocksSearchDialog.searchVal" class="q-pa-md text-grey text-center">
            Search stocks
          </div>
          <div v-else class="q-pa-md text-grey text-center">
            No data
          </div>

          <q-item
            v-if="stocksSearchDialog.pagination?.count > stocksSearchDialog.stocks?.length"
            clickable
            v-ripple
            :disable="stocksSearchDialog.loading"
            @click="() => updateStockSearchList({append: true })"
          >
            <q-item-section class="text-center">
              <q-item-label :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'">
                Show more
                <q-spinner v-if="stocksSearchDialog.loading"/>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
  </q-page>
</template>
<script>
import { Stock } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { defineComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'
import { errorParser } from 'src/marketplace/utils'

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
      }
    }))

    function resetFormDataList() {
      formDataList.value.forEach(formData => {
        formData.adjustment.adjustType = 'set'
        formData.adjustment.quantity = formData.stock?.quantity
        formData.costPrice = formData.stock?.costPrice
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
        }
      }) 
    })
    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.stocks = []
    }

    function updateStocks() {
      const dataList = formDataList.value.map(formData => {
        const data = {
          stock_id: formData.stock.id,
          adjustment: {
            adjust_type: formData.adjustment.adjustType,
            quantity: formData.adjustment.quantity,
          },
          cost_price: formData.costPrice
        }

        // remove data thats not updated anyway
        if (data.cost_price === formData.stock.costPrice) data.cost_price = undefined
        if (data.adjustment.adjust_type === 'add' && !formData.adjustment.quantity) data.adjustment = undefined
        if (data.adjustment.adjust_type === 'set' && formData.adjustment.quantity === formData.stock.quantity) data.adjustment = undefined

        return data
      })
      
      const data = { stocks: dataList }
      if (!dataList?.length) {
        return $q.dialog({ title: 'No stocks to update' })
      }

      const dialog = $q.dialog({
        title: 'Updating stocks',
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
            title: 'Stocks updated',
            ok: { noCaps: true, label: 'Return', flat: true, color: 'brandblue' },
            cancel: { noCaps: true, label: 'Stay on page', flat: true, color: 'grey' },
          }).onOk(() => $router.go(-1))
          return response
        })
        .catch(error => {
          // resolve error msg for dialog
          const data = error?.response?.data
          let msg = errorParser.firstElementOrValue(data?.non_field_errors)
          if (!msg) msg = data?.detail
          dialog.update({
            title: 'Stocks update error',
            message: msg || 'Encountered error in updating stocks',
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
            }
          }

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]
          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered errors in updating stocks']
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

    const stocksSearchDialog = ref({
      show: false,
      loading: false,
      searchVal: '',
      stocks: [].map(Stock.parse),
      pagination: {count: 0, limit: 0, offset: 0},
    })
    function updateStockSearchList(opts={append: false}) {
      const params = {
        limit: 5,
        offset: undefined,
        s: stocksSearchDialog.value.searchVal,
        shop_id: marketplaceStore.activeShopId || null,
      }

      if (opts?.append) {
        params.offset = stocksSearchDialog.value.pagination.limit + stocksSearchDialog.value.pagination.offset
      }

      stocksSearchDialog.value.loading = true
      backend.get(`stocks/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return
          const stocks = response?.data?.results.map(Stock.parse)
          if (opts?.append) stocksSearchDialog.value.stocks.push(...stocks)
          else stocksSearchDialog.value.stocks = stocks
          stocksSearchDialog.value.pagination.count = response?.data?.count || 0
          stocksSearchDialog.value.pagination.limit = response?.data?.limit || 0
          stocksSearchDialog.value.pagination.offset = response?.data?.offset || 0
        })
        .finally(() => {
          stocksSearchDialog.value.loading = false
        })
    }

    return {
      marketplaceStore,
      loading,
      formDataList,
      stockIdExists,
      toggleStock,
      addStockToList,
      removeStockFromList,
      formErrors,
      updateStocks,

      stockDetailDialog,
      displayStock,

      stocksSearchDialog,
      updateStockSearchList,
    }
  },
})
</script>
<style scoped>
table.stocks-table {
  margin-left: auto;
  margin-right: auto;
}
table.stocks-table > tr > td {
  vertical-align: top;
}
</style>