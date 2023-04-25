<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Sale</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-tabs v-model="tab" >
      <q-tab v-for="(tabOpt, index) in tabs" :key="index" v-bind="tabOpt"/>
    </q-tabs>
    <q-tab-panels
      animated
      keep-alive
      v-model="tab"
      style="background:none;"
      class="q-mt-sm"
    >
      <q-tab-panel name="items" class="q-pa-none">
        <div class="items-container">
          <q-card class="q-space items-card q-mb-md">
            <q-card-section>
              <div class="text-h5">Items</div>
              <TransitionGroup name="fade">
                <div v-for="(item, index) in formData.items" :key="item?.variant?.id">
                  <div class="row items-center justify-end">
                    <div class="text-grey q-space">Item {{ index+1 }}</div> 
                    <q-btn
                      flat
                      icon="close"
                      color="red"
                      padding="xs"
                      @click="() => removeItem(item)"
                    />
                  </div>
                  <div class="row items-center no-wrap q-gutter-x-sm q-mb-sm">
                    <div class="q-space row items-center no-wrap text-weight-medium" @click="() => viewItemVariant(item)">
                      <img
                        v-if="item?.variant?.itemImage"
                        :src="item?.variant?.itemImage"
                        style="width:30px;"
                        class="rounded-borders q-mr-xs"
                      />
                      <div>{{ item?.variant?.itemName }}</div>
                    </div>
                    <div class="col-3 col-sm-2">
                      {{ item.variant?.price }} {{ marketplaceStore?.currency }}
                    </div>
                    <div class="col-2 col-sm-1">
                      <div class="row no-wrap items-center justify-center">
                        <span class="text-underline">x{{ item.quantity }}</span>
                        <q-popup-edit
                          v-model="item.quantity" v-slot="props"
                          :cover="false"
                          @update:model-value="val => val ? null: removeItem(item)"
                        >
                          <q-input
                            flat
                            dense
                            type="number"
                            v-model.number="props.value"
                            @keypress.enter="() => props.set()"
                          />
                        </q-popup-edit>
                        <q-icon
                          v-if="item?.quantity > item?.variant?.totalStocks"
                          name="assignment_late"
                          size="1.25em"
                          class="q-ml-xs"
                        >
                          <q-menu class="q-py-sm q-px-md">
                            Quantity is over total stocks: {{ item?.variant?.totalStocks }} 
                          </q-menu>
                        </q-icon>
                      </div>
                    </div>
                  </div>
                </div>
              </TransitionGroup>
              <div v-if="!formData.items?.length" class="text-center text-grey">
                No items
              </div>
            </q-card-section>
          </q-card>
          <q-card class="add-item-card col-12 col-sm-4 q-mb-md">
            <q-card-section>
              <div class="text-h6">Add Item</div>
              <AddItemForm
                :exludeVariantIds="formData?.items?.map(item => item?.variant?.id)"
                inline-scanner
                hide-cancel
                @submit="addItem"
              />
            </q-card-section>
          </q-card>
        </div>
    
        <q-card class="rounded-borders">
          <q-card-section>
            <div class="row">
              <div class="q-space">Subtotal</div>
              <div>
                {{ formComputedData.subtotal }}
                {{ marketplaceStore?.currency  }}
              </div>
            </div>
          </q-card-section>
        </q-card>
    
        <div v-if="formComputedData.subtotal > 0" class="q-mt-md">
          <q-btn
            color="brandblue"
            no-caps
            label="Next"
            class="full-width"
            @click="() => nextTab()"
          />
        </div>
      </q-tab-panel>
      <q-tab-panel name="stocks" class="q-pa-none">
        <q-card v-for="(item, index) in formData.items" :key="item?.variant?.id" class="q-pa-sm q-mb-sm">
          <div>Item {{ index+1 }}</div>
          <div class="q-space row items-center no-wrap q-gutter-x-sm q-mb-sm">
            <div class="row items-center no-wrap text-weight-medium" @click="() => viewItemVariant(item)">
              <img
                v-if="item?.variant?.itemImage"
                :src="item?.variant?.itemImage"
                style="width:30px;"
                class="rounded-borders q-mr-xs"
              />
              <div>{{ item?.variant?.itemName }}</div>
            </div>
            <div class="text-body1">x{{ item?.quantity }}</div>
          </div>
          <div class="row items-center">
            <q-checkbox dense v-model="item.requireStocks" label="Require stocks"/>
            <q-space/>
            <q-btn
              flat
              no-caps
              padding="none"
              label="Select stocks"
              class="text-underline"
              @click="() => selectStocks(item)"
            />
          </div>
          <div
            v-for="consumption in item.consumptions" :key="consumption.stock.id"
            class="row q-mt-sm"
          >
            <q-item-section @click="() => viewStockDetail(consumption?.stock)">
              <q-item-label class="text-weight-medium">
                Stock #{{ consumption?.stock?.id }}
              </q-item-label>
              <q-item-label class="text-caption">
                In stock: {{ consumption?.stock?.quantity }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label>
                <q-input
                  outlined
                  dense
                  type="number"
                  v-model.number="consumption.quantity"
                  width="5em"
                />
              </q-item-label>
            </q-item-section>
          </div>
        </q-card>

        <div v-if="formComputedData.subtotal > 0" class="q-mt-md">
          <q-btn
            color="brandblue"
            no-caps
            label="Next"
            class="full-width"
            @click="() => nextTab()"
          />
        </div>
      </q-tab-panel>
      <q-tab-panel name="review" class="q-pa-none">
        <q-card>
          <q-card-section>
            <div v-for="(item) in formData.items" :key="item?.variant?.id">
              <div class="row items-center no-wrap q-gutter-x-sm q-mb-sm">
                <div class="q-space row items-center no-wrap text-weight-medium" @click="() => viewItemVariant(item)">
                  <img
                    v-if="item?.variant?.itemImage"
                    :src="item?.variant?.itemImage"
                    style="width:30px;"
                    class="rounded-borders q-mr-xs"
                  />
                  <div>{{ item?.variant?.itemName }}</div>
                </div>
                <div class="col-3">{{ item?.variant?.price }} {{ marketplaceStore.currency }}</div>
                <div class="col-2">x{{ item?.quantity }}</div>
              </div>
            </div>
            <q-separator spaced/>
            <div class="row items-center text-h5">
              <div class="q-space">Subtotal</div>
              <div>
                {{ formComputedData.subtotal }}
                {{ marketplaceStore.currency }}
              </div>
            </div>
          </q-card-section>
        </q-card>
        <div class="q-mt-sm">
          <q-btn
            :disable="loading"
            :loading="loading"
            no-caps
            label="Create Sale"
            color="brandblue"
            class="full-width"
            @click="() => createSale()"
          />
        </div>
      </q-tab-panel>
    </q-tab-panels>
    <VariantInfoDialog
      v-model="variantInfoDialog.show"
      :variant="variantInfoDialog.item?.variant"
    >
      <template v-if="tab === 'items'" v-slot:bottom>
        <q-input
          dense
          outlined
          label="Quantity"
          v-model="variantInfoDialog.item.quantity"
        >
          <template v-slot:prepend>
            <q-btn flat padding="sm" icon="remove" @mousedown="() => variantInfoDialog.item.quantity--"/>
          </template>
          <template v-slot:append>
            <q-btn flat padding="sm" icon="add" @mousedown="() => variantInfoDialog.item.quantity++"/>
          </template>
        </q-input>
      </template>
    </VariantInfoDialog>
    <StockDetailDialog v-model="stockInfoDialog.show" :stock="stockInfoDialog.stock"/>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Stock, Variant } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import AddItemForm from 'src/components/marketplace/sales/AddItemForm.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'
import StockSearchDialog from 'src/components/marketplace/inventory/StockSearchDialog.vue'

export default defineComponent({
  name: 'CreateSalePage',
  components: {
    AddItemForm,
    MarketplaceHeader,
    VariantInfoDialog,
    StockDetailDialog,
  },
  setup() {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    const tab = ref('items')
    const tabs = ref([
      { name: 'items', label: 'Items', disable: false },
      { name: 'stocks', label: 'Stocks', disable: true },
      { name: 'review', label: 'Review', disable: true },
    ])
    watch(tab, () => {
      // tabs will be disabled by default, then be enabled when visited once
      tabs.value.forEach(tabOpt => {
        if (tabOpt.name === tab.value) tabOpt.disable = false
      })
    })
    function nextTab() {
      const _tabs = tabs.value
      const index = _tabs.findIndex(tabOpt => tabOpt.name === tab.value)
      const nextIndex = Math.min(index + 1, tabs.value.length-1)

      tab.value = _tabs.at(nextIndex).name
    }


    function createEmptyItem() {
      return {
        variant: Variant.parse(),
        quantity: 0,
        requireStocks: true,
        consumptions: [].map(() => {
          return {
            stock: Stock.parse(),
            quantity: 0,
          }
        }),
      }
    }
    const loading = ref(false)
    const formData = ref({
      items: [].map(createEmptyItem),
    })

    const formComputedData = computed(() => {
      const data = { subtotal: 0 }
      if (formData.value?.items?.length) {
        data.subtotal = formData.value?.items
          .reduce((subtotal, item) => {
            if (isNaN(item?.variant?.price)) return subtotal
            if (isNaN(item?.quantity)) return subtotal
            return subtotal + (item?.variant?.price * item?.quantity)
          }, 0)
      }
      return data
    })

    function addItem(item) {
      const index = formData.value.items.findIndex(_item => _item?.variant?.id === item?.variant?.id)
      const itemData = Object.assign(createEmptyItem(), {
        variant: item?.variant,
        quantity: item?.quantity,
      })
      if (index >= 0) formData.value.items[index] = itemData
      else  formData.value.items.push(itemData)
    }

    function removeItem(item) {
      formData.value.items = formData.value.items.filter(_item => _item !== item)
    }

    function selectStocks(item) {
      let selected = item?.consumptions?.map?.(consumption => consumption?.stock)
      if (!Array.isArray(selected)) selected = []
      $q.dialog({
        component: StockSearchDialog,
        componentProps: {
          context: 'sales',
          selected: selected,
          ok: true,
          searchFilterKwargs: {
            // empty: false,
            variant_id: item?.variant?.id,
          }
        }
      })
        .onOk(stocks => {
          // const sortedStocks = stocks.sort((stock1, stock2) => stock1.quantity - stock2.quantity)
          let remaining = item?.quantity
          item.consumptions = stocks.map(stock => {
            const consumed = Math.min(remaining, stock?.quantity)
            const data = { stock, quantity: consumed }
            remaining -= consumed
            return data
          })
        })
    }

    function createSale() {
      const data = {
        shop_id: marketplaceStore.activeShopId,
        items: formData.value.items.map(item => {
          return {
            variant_id: item.variant.id,
            quantity: item.quantity,
            require_stocks: item.requireStocks,
            consumptions: item.consumptions.map(consumption => {
              return {
                stock_id: consumption.stock.id,
                quantity: consumption.quantity,
              }
            }),
          }
        }),
      }

      loading.value = true
      backend.post('sales-orders/', data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $q.dialog({
            title: 'Success',
            message: 'Sale created',
          }).onDismiss(() => $router.go(-1))
          return response
        })
        .catch(error => {
          let errorMsg = error?.response?.data?.detail
          $q.notify({
            message: 'Failed to create sale',
            caption: errorMsg || 'Encountered error',
            type: 'negative',
          })
          return Promise.reject(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    const variantInfoDialog = ref({
      show: false,
      item: { variant: Variant.parse(), quantity: 0 },
    })
    function viewItemVariant(item={ variant: Variant.parse(), quantity: 0 }) {
      variantInfoDialog.value.item = item
      variantInfoDialog.value.show = true
    }

    const stockInfoDialog = ref({ show: false, stock: Stock.parse() })
    function viewStockDetail(stock=Stock.parse()) {
      stockInfoDialog.value.stock = stock
      stockInfoDialog.value.show = true
    }

    return {
      marketplaceStore,

      tab,
      tabs,
      nextTab,

      loading,
      formData,
      formComputedData,

      addItem,
      removeItem,
      selectStocks,

      createSale,

      variantInfoDialog,
      viewItemVariant,

      stockInfoDialog,
      viewStockDetail,
    }
  },
})
</script>
<style scoped>
.items-container {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column-reverse;
}

.items-card {
  flex: 0 0 auto;
  height: auto;
  flex-grow: 1;
}

.add-item-card {
  flex: 0 0 auto;
  height: auto;
  width: 100%
}

@media (min-width: 600px) {
  .items-container {
    align-items: start;
    flex-direction: row;
  }

  .add-item-card {
    --margin: 4px;
    width: calc(30% - var(--margin));
    margin-left: var(--margin);
  }
}

</style>
<style scoped>
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
