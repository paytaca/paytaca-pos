<template>
  <q-page class="q-pa-md q-pb-xl">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">{{ $t('StockRecount') }}</div>
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
              count: formDataList?.items?.length,
              unit: formDataList?.items?.length === 1 ? $t('stock') : $t('stocks')
            },
            `${formDataList?.items?.length} ${ formDataList?.items?.length === 1 ? $t('stock') : $t('stocks') }`
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
        <span class="text-underline">{{ $t('SelectMoreStocks') }}</span>
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
      <div :class="{ dark: $q.dark.isActive }" class="row stocks-table-container" style="overflow:auto;">
        <table class="stocks-table full-width" :class="{ dark: $q.dark.isActive }">
          <tr>
            <th>{{ $t('Stock') }}</th>
            <th>{{ $t('Expected') }}</th>
            <th>{{ $t('Actual') }}</th>
            <th>{{ $t('Remarks') }}</th>
            <th></th>
          </tr>
          <TransitionGroup name="fade">
            <tr v-for="(item, index) in formData.items" :key="item?.stock?.id">
              <td class="row items-center no-wrap text-weight-medium field" @click="() => displayStock(item.stock)">
                <div class="q-space">
                  <div>
                    {{
                      $t(
                        'StockId',
                        { id: item?.stock?.id },
                        `Stock#${item?.stock?.id}`
                      )
                    }}
                  </div>
                  <div class="text-caption bottom ellipsis" style="max-width:25vw;">{{ item.stock.itemName }}</div>
                </div>
                <q-icon
                  v-if="formErrors?.items?.[index]?.detail?.length"
                  name="error" color="red"
                  size="1.5em" class="q-ml-xs q-pa-sm"
                  @click.stop
                >
                  <q-menu class="q-pa-sm bg-red text-white">
                    <div v-if="formErrors?.items?.[index]?.detail?.length === 1">
                      {{ formErrors?.items?.[index]?.detail[0] }}
                    </div>
                    <ul v-else class="q-pl-md q-my-none">
                      <li v-for="(err, index) in formErrors?.items?.[index]?.detail" :key="index">{{err}}</li>
                    </ul>
                  </q-menu>
                </q-icon>
              </td>
              <td class="field">
                <q-input
                  dense
                  outlined
                  readonly
                  type="number"
                  :model-value="item?.stock?.quantity"
                  bottom-slots
                />
              </td>
              <td class="field">
                <q-input
                  dense
                  outlined
                  :disable="loading"
                  type="number"
                  :placeholder="item?.stock?.quantity"
                  v-model.number="item.actualQuantity"
                  :rules="[
                    val => val >= 0 || $t('Invalid'),
                  ]"
                  :error="Boolean(formErrors?.items?.[index]?.actualQuantity)"
                  :error-message="formErrors?.items?.[index]?.actualQuantity"
                />
              </td>
              <td class="field">
                <q-input
                  dense
                  outlined
                  :disable="loading"
                  autogrow
                  v-model="item.remarks"
                  :error="Boolean(formErrors?.items?.[index]?.remarks)"
                  :error-message="formErrors?.items?.[index]?.remarks"
                />
              </td>
              <td>
                <q-btn
                  :disable="loading"
                  icon="close"
                  flat padding="sm"
                  color="red" class="q-mx-sm"
                  @click="() => toggleStock(item.stock)"
                />
              </td>
            </tr>
          </TransitionGroup>
        </table>
      </div>
      <q-card class="q-mt-sm">
        <q-card-section>
          <div>{{ $t('Remarks') }}</div>
          <q-input
            dense
            outlined
            autogrow
            v-model="formData.remarks"
            :error="Boolean(formErrors?.remarks)"
            :error-message="formErrors?.remarks"
          />
        </q-card-section>
      </q-card>
      <div class="fixed-bottom q-pa-sm" style="z-index: 2;">
        <q-btn
          no-caps
          :label="$t('UpdateStocks')"
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
import { backend } from 'src/marketplace/backend'
import { Stock } from 'src/marketplace/objects'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'
import StockSearchDialog from 'src/components/marketplace/inventory/StockSearchDialog.vue'

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
    const { t } = useI18n()
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
          actualQuantity: 0,
          remarks: '',
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
        actualQuantity: null,
        remarks: '',
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
            expected_quantity: item?.stock?.quantity,
            remarks: item?.remarks || undefined,
            auto_adjust: true,
          }
        })
      }

      loading.value = true
      backend.post(`stock-recounts/`, data)
        .finally(() => clearFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $q.dialog({
            title: t('StockRecountCreated'),
            ok: true,
          }).onOk(() => $router.back())
          return response
        })
        .catch(error => {
          console.error(error)
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.items = data?.items?.map?.((itemErrors, index) => {
            const errors = {
              detail: errorParser.toArray(itemErrors?.non_field_errors),
              actualQuantity: errorParser.firstElementOrValue(itemErrors?.actual_quantity),
              remarks: errorParser.firstElementOrValue(itemErrors?.remarks),
            }
            if (errors?.detail?.[0]?.indexOf?.('Incorrect expected quantity') >= 0) {
              formData.value.items?.[index]?.stock?.refetch()
            }
            return errors
          })

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]
          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = [t('StockRecountErrMsg')]
          }
        })
        .finally(() => {
          loading.value = false
        })
    }

    function openStockSearchDialog() {
      $q.dialog({
        component: StockSearchDialog,
        componentProps: {
          selected: formData.value.items.map(item => item?.stock).filter(Boolean),
          ok: true,
        }
      }).onOk(stocks => {
        formData.value.items = formData.value.items.filter(item => {
          return stocks.find(stock => item.stock.id === stock.id)
        })
        stocks.map(stock => {
          if (stockIdExists(stock.id)) return
          addStockToList(stock)
        })
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

      openStockSearchDialog,
      stockDetailDialog,
      displayStock,
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

table.stocks-table td.field {
  min-width: min(30vw, 8rem);
  padding: 8px;
}


/* 1. declare transition */
.fade-move,
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}

/* 2. declare enter from and leave to state */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(30px, 0);
}

/* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
/* .fade-leave-active {
  position: absolute;
} */
</style>
