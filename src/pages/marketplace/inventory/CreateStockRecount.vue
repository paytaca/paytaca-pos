<template>
  <q-page class="q-pa-md q-pb-xl">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Stock Recount</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <div class="row">
      <q-chip
        no-caps rounded
        padding="2px 0.75em"
      >
        {{ formData?.items?.length }}
        {{ formData?.items?.length === 1 ? 'stock' : 'stocks' }}
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
        <span class="text-underline">Select more stocks</span>
      </q-btn>
    </div>
    <q-form @submit="() => createStockRecount()">
      <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-sm">
        <div v-if="formErrors?.detail?.length === 1">
          {{ formErrors.detail[0] }}
        </div>
        <ul v-else class="q-pl-md">
          <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
        </ul>
      </q-banner>
      <TransitionGroup name="fade">
        <q-card
          v-for="(item, index) in formData.items" :key="index"
          class="q-mb-sm"
        >
          <q-card-section>
            <q-banner v-if="formErrors?.items?.[index]?.detail?.length" class="bg-red text-white rounded-borders q-mb-sm">
              <div v-if="formErrors?.items?.[index]?.detail?.length === 1">
                {{ formErrors?.items?.[index]?.detail[0] }}
              </div>
              <ul v-else class="q-pl-md">
                <li v-for="(err, index) in formErrors?.items?.[index]?.detail" :key="index">{{err}}</li>
              </ul>
            </q-banner>
            <div class="row items-bottom">
              <div class="q-space text-weight-medium" @click="() => displayStock(item.stock)">
                <div>Stock#{{ item?.stock?.id }}</div>
                <div class="text-caption bottom ellipsis">{{ item.stock.itemName }}</div>
              </div>
              <q-checkbox
                dense
                label="Update stocks"
                v-model="item.autoAdjust"
              />
            </div>
            <div class="q-mt-sm row">  
              <q-input
                dense outlined
                :disable="loading"
                label="Actual"
                type="number"
                v-model.number="item.actualQuantity"
                :rules="[
                  val => val >= 0 || 'Invalid',
                ]"
                :error="Boolean(formErrors?.items?.[index]?.actualQuantity)"
                :error-message="formErrors?.items?.[index]?.actualQuantity"
                class="col-6"
              />
              <q-input
                dense outlined
                :disable="loading"
                label="Expected"
                :placeholder="item?.stock?.quantity"
                type="number"
                v-model.number="item.expectedQuantity"
                :rules="[
                  val => val >= 0 || 'Invalid',
                ]"
                :error="Boolean(formErrors?.items?.[index]?.expectedQuantity)"
                :error-message="formErrors?.items?.[index]?.expectedQuantity"
                class="col-6"
              />
            </div>
            <q-input
              dense
              outlined
              :disable="loading"
              autogrow
              label="Remarks"
              v-model="item.remarks"
              :error="Boolean(formErrors?.items?.[index]?.remarks)"
              :error-message="formErrors?.items?.[index]?.remarks"
            />
          </q-card-section>
        </q-card>
      </TransitionGroup>
      <div class="fixed-bottom q-pa-sm">
        <q-btn
          no-caps
          label="Update stocks"
          color="brandblue"
          class="full-width"
          type="submit"
        />
      </div>
    </q-form>

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
    <StockDetailDialog v-model="stockDetailDialog.show" :stock="stockDetailDialog.stock"/>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Stock } from 'src/marketplace/objects'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'

export default defineComponent({
  name: 'CreateStockRecount',
  components: {
    MarketplaceHeader,
    StockDetailDialog,
  },
  props: {
    stockIds: String,
  },
  setup(props) {
    const marketplaceStore = useMarketplaceStore()
    const $q = useQuasar()
    const $router = useRouter()
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

    const loading = ref(false)
    const formData = ref({
      remarks: '',
      items: [].map(() => {
        return {
          stock: Stock.parse(),
          expectedQuantity: 0,
          actualQuantity: 0,
          remarks: '',
          autoAdjust: true,
        }
      })
    })

    function stockIdExists(stockId) {
      return formData.value.items.some(item => item.stock?.id === stockId)
    }

    function toggleStock(stock=Stock.parse()) {
      if (stockIdExists(stock?.id)) removeStockFromList(stock)
      else addStockToList(stock)
    }

    function addStockToList(stock=Stock.parse()) {
      const index = formData.value.items.findIndex(item => item.stock?.id === stock?.id)
      if (index >= 0) return

      formData.value.items.push({
        stock: stock,
        expectedQuantity: stock?.quantity,
        actualQuantity: stock?.quantity,
        remarks: '',
        autoAdjust: true,
      })
    }


    function removeStockFromList(stock=Stock.parse()) {
      formData.value.items = formData.value.items.filter(formData => {
        return formData.stock?.id !== stock?.id
      })
    }

    const formErrors = ref({
      detail: [],
      remarks: '',
      items: [].map(() => {
        return {
          detail: [],
          stock: '',
          expectedQuantity: '',
          actualQuantity: '',
          remarks: '',
        }
      })
    })

    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.remarks = ''
      formErrors.value.items = []
    }

    function createStockRecount() {
      const data = {
        shop_id: marketplaceStore.activeShopId,
        remarks: formData.value.remarks || undefined,
        items: formData.value.items.map(item => {
          return {
            stock_id: item?.stock?.id,
            actual_quantity: item?.actualQuantity,
            expected_quantity: item?.expectedQuantity,
            remarks: item?.remarks || undefined,
            auto_adjust: item?.autoAdjust,
          }
        })
      }

      loading.value = true
      backend.post(`stock-recounts/`, data)
        .finally(() => clearFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $q.dialog({
            title: 'Stock recount created!',
            ok: true,
          }).onOk(() => $router.back())
          return response
        })
        .catch(error => {
          console.error(error)
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.items = data?.items?.map?.(itemErrors => {
            return {
              detail: errorParser.toArray(itemErrors?.non_field_errors),
              actualQuantity: errorParser.firstElementOrValue(itemErrors?.actual_quantity),
              expectedQuantity: errorParser.firstElementOrValue(itemErrors?.expected_quantity),
              remarks: errorParser.firstElementOrValue(itemErrors?.remarks),
            }
          })

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]
          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered errors in createing stock recount']
          }
        })
        .finally(() => {
          loading.value = false
        })
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

    const stockDetailDialog = ref({ show: false, stock: Stock.parse() })
    function displayStock(stock=Stock.parse()) {
      stockDetailDialog.value.stock = stock
      stockDetailDialog.value.show = true
    }

    return {
      marketplaceStore,

      loading,
      formData,

      stockIdExists,
      toggleStock,
      addStockToList,
      removeStockFromList,

      formErrors,
      createStockRecount,

      stocksSearchDialog,
      updateStockSearchList,
      stockDetailDialog,
      displayStock,
    }
  },
})
</script>
