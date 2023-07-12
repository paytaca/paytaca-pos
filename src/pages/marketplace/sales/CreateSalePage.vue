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
    <div class="row items-start q-mt-sm q-px-sm">
      <div>
        <q-btn-dropdown
          v-if="draftSalesOrders?.length"
          no-caps
          flat
          :label="formData?.salesOrder?.id ? `Draft sales order #${formData?.salesOrder?.id}` : 'Drafts'"
          padding="xs sm"
          menu-self="top start"
          menu-anchor="bottom start"
          class="q-r-ml-md"
        >
          <q-list separator>
            <q-item
              v-if="formData?.salesOrder?.id"
              clickable v-close-popup
              @click="() => clearFormData({ delay: 100 })"
            >
              <q-item-section>
                <q-item-label>
                  New Empty
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              v-for="salesOrder in draftSalesOrders" :key="salesOrder?.id"
              clickable v-close-popup
              :class="[
                salesOrder?.id == formData?.salesOrder?.id ? 'text-weight-medium' : '',
              ]"
              @click="() => viewSalesOrder(salesOrder)"
            >
              <q-item-section>
                <q-item-label>
                  {{ salesOrder?.total }} {{ salesOrder?.currency?.symbol }}
                  <span class="text-grey">
                    ({{ salesOrder?.items?.length || salesOrder?.itemsCount }}
                    {{ (salesOrder?.items?.length || salesOrder?.itemsCount ) > 1 ? 'items' : 'item' }})
                  </span>
                </q-item-label>
                <q-item-label caption >Created {{ formatDateRelative(salesOrder.createdAt) }} </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>
      <q-space/>
      <div v-if="formComputedData.subtotal > 0">
        <q-btn
          outline
          no-caps
          :label="formData?.salesOrder?.id ? 'Save draft' : 'Save as draft'"
          padding="xs md"
          @click="() => createSale({ draft: true, silent: false })"
        />
      </div>
    </div>
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
                      :disable="loading"
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
                          :disable="loading"
                          :cover="false"
                          @update:model-value="val => val ? null: removeItem(item)"
                        >
                          <q-input
                            flat
                            dense
                            :disable="loading"
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
              <AddItemPanel
                :disable="loading"
                :excludeVariantIds="formData?.items?.map(item => item?.variant?.id)"
                persist-scanner
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
            :disable="loading"
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
            <q-checkbox :disable="loading" dense v-model="item.requireStocks" label="Require stocks"/>
            <q-space/>
            <q-btn
              flat
              no-caps
              padding="none"
              label="Select stocks"
              class="text-underline"
              :disable="loading"
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
                  :disable="loading"
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
            :disable="loading"
            label="Next"
            class="full-width"
            @click="() => nextTab()"
          />
        </div>
      </q-tab-panel>
      <q-tab-panel name="payment" class="q-pa-none">
        <q-select
          label="Payment mode"
          dense
          outlined
          :options="['BCH', 'Other']"
          v-model="formData.paymentMode"
          bottom-slots
        />
        <div v-if="formData.paymentMode == 'BCH'" class="q-px-md">
          <div class="row items-start">
            <div v-if="transactionsReceived?.length">
              <q-btn
                v-if="!displayReceivedTransactions"
                flat
                no-caps :label="`Transactions (${transactionsReceived.length})`"
                padding="xs sm"
                class="q-r-ml-md"
                @click="() => displayReceivedTransactions = true"
              />
              <q-btn
                v-else
                flat
                no-caps label="Payment link"
                padding="xs sm"
                class="q-r-ml-md"
                @click="() => displayReceivedTransactions = false"
              />
            </div>
            <q-space/>
            <div v-if="formData?.bchPayment?.price?.value" class="text-right">
              <div>
                {{ formData.bchPayment.price.value }}
                {{ marketplaceStore?.merchant?.currency?.symbol }} / BCH
              </div>
              <div class="text-grey text-caption bottom">
                {{ formatTimestampToText(formData.bchPayment?.price?.timestamp) }}
              </div>
            </div>
          </div>
          <template v-if="displayReceivedTransactions && transactionsReceived?.length">
            <q-item
              v-for="(txReceived, index) in transactionsReceived" :key="index"
              clickable
              v-ripple
              @click="displayReceivedTransaction(txReceived)"
            >
              <q-item-section v-if="txReceived?.logo" side>
                <img :src="txReceived?.logo" height="25"/>
              </q-item-section>
              <q-item-section>
                <q-item-label class="ellipsis">
                  {{ txReceived?.txid }}
                </q-item-label>
              </q-item-section>
              <q-item-section class="text-right">
                <q-item-label caption>
                  {{ txReceived?.amount }} {{ txReceived?.tokenSymbol }}
                </q-item-label>
                <q-item-label v-if="txReceived?.marketValue?.amount && txReceived?.marketValue?.currency" caption>
                  {{ txReceived?.marketValue?.value }} {{ txReceived?.marketValue?.currency }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </template>
          <template v-else>
            <div class="row justify-center items-center q-mt-sm">
              <div class="qr-code-container row items-center">
                <div v-if="loading"><q-skeleton height="200px" width="200px" /></div>
                <template v-else>
                  <img src="~assets/bch-logo.png" height="50" class="qr-code-icon"/>
                  <QRCode
                    :text="bchPaymentUrl"
                    color="#253933"
                    :size="200"
                    error-level="H"
                    :style="bchPaymentUrl ? '' : 'opacity:0;'"
                  />
                </template>
              </div>
            </div>
            <div v-if="formComputedData.bchSubtotal && formData.bchPayment.recipient" class="text-center">
              <div class="text-h5">{{ formComputedData.bchSubtotal }} BCH</div>
              <div class="text-caption bottom">
                {{ formComputedData.subtotal }} {{ marketplaceStore?.merchant?.currency?.symbol }}
              </div>
              <div class="text-subtitle1 q-mt-sm" style="word-break: break-all;">
                {{ formData.bchPayment.recipient }}
                <q-btn
                  flat
                  size="0.75em"
                  padding="none"
                  class="text-underline"
                  no-caps label="Change address"
                  @click="() => updateRecipient()"
                />
              </div>
            </div>
          </template>
        </div>
        <div v-else>
          <q-input
            dense
            outlined
            label="Received Amount"
            type="number"
            v-model.number="formData.receivedAmount"
            :suffix="marketplaceStore?.currency"
          />
        </div>

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
        <q-card class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1">Items</div>
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
          </q-card-section>
        </q-card>
        <q-card class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle1">Payment</div>
            <div class="row no-wrap items-start">
              <div class="q-space q-mr-sm text-grey">Payment method</div>
              <div>{{ formData.paymentMode }}</div>
            </div>
            <template v-if="formData.paymentMode == 'BCH'">
              <div class="row no-wrap items-start">
                <div class="q-space q-mr-sm text-grey">Recipient</div>
                <div style="word-break:break-all;" class="ellipsis">{{ formData?.bchPayment?.recipient }}</div>
              </div>
              <div class="row no-wrap items-start">
                <div class="q-space q-mr-sm text-grey">BCH Price</div>
                <div class="row items-center">
                  <q-icon name="help" class="q-mr-xs"/>
                  <div style="word-break:break-all;" class="ellipsis">
                    {{ formData?.bchPayment?.price?.value }}
                    {{ marketplaceStore.currency }} / BCH
                  </div>
                </div>
                <q-menu class="q-pa-sm">
                  BCH price as of {{ formatTimestampToText(formData?.bchPayment?.price?.timestamp) }}
                </q-menu>
              </div>
              <div v-if="formData?.bchPayment?.txid" class="row no-wrap items-start">
                <div class="q-space q-mr-sm text-grey">Transaction</div>
                <div style="word-break:break-all;" class="ellipsis">{{ formData?.bchPayment?.txid }}</div>
                <q-btn
                  flat round
                  icon="open_in_new" size="0.5em"
                  target="_blank"
                  :href="formComputedData?.bchTxidUrl"
                />
              </div>
            </template>
            <div class="row items-start text-h5">
              <div class="q-space">Total</div>
              <div v-if="formData.paymentMode == 'BCH'" class="text-right">
                <div>{{ formComputedData.bchSubtotal }} BCH</div>
                <div class="text-grey text-caption bottom">
                  {{ formComputedData.subtotal }} {{ marketplaceStore.currency }}
                </div>
              </div>
              <div v-else>
                {{ formComputedData.subtotal }} {{ marketplaceStore.currency }}
              </div>
            </div>
            <template v-if="formData.paymentMode == 'Other' && formData.receivedAmount">
              <div class="row no-wrap items-start q-mt-md">
                <div class="q-space q-mr-sm text-grey">Amount Received</div>
                <div>{{ formData.receivedAmount }} {{ marketplaceStore?.currency }}</div>
              </div>
              <div v-if="formComputedData.changeAmount" class="row no-wrap items-start text-h6">
                <div class="q-space q-mr-sm">Change</div>
                <div>{{ formComputedData.changeAmount }} {{ marketplaceStore?.currency }}</div>
              </div>
            </template>
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
            @click="() => createSale({ draft: false, silent: false })"
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
          :disable="loading"
          label="Quantity"
          v-model="variantInfoDialog.item.quantity"
        >
          <template v-slot:prepend>
            <q-btn :disable="loading" flat padding="sm" icon="remove" @mousedown="() => variantInfoDialog.item.quantity--"/>
          </template>
          <template v-slot:append>
            <q-btn :disable="loading" flat padding="sm" icon="add" @mousedown="() => variantInfoDialog.item.quantity++"/>
          </template>
        </q-input>
      </template>
    </VariantInfoDialog>
    <StockDetailDialog v-model="stockInfoDialog.show" :stock="stockInfoDialog.stock"/>
    <SalesOrderDetailDialog
      v-model="salesOrderDetailDialog.show"
      :sales-order="salesOrderDetailDialog.salesOrder"
    >
      <template v-slot:bottom>
        <q-btn
          no-caps
          :disable="loading"
          label="Load"
          color="brandblue"
          class="full-width q-mt-md"
          v-close-popup
          @click="() => loadDraftSalesOrder({ salesOrder: salesOrderDetailDialog.salesOrder })"
        />
      </template>
    </SalesOrderDetailDialog>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { SalesOrder, Stock, Variant } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { debounce, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import AddItemPanel from 'src/components/marketplace/sales/AddItemPanel.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'
import StockSearchDialog from 'src/components/marketplace/inventory/StockSearchDialog.vue'
import QRCode from 'vue-qrcode-component'
import SalesOrderDetailDialog from 'src/components/marketplace/sales/SalesOrderDetailDialog.vue'
import ReceiveUpdateDialog from 'src/components/receive-page/ReceiveUpdateDialog.vue'
import { useAddressesStore } from 'src/stores/addresses'
import { TransactionListener } from 'src/wallet/utils'

export default defineComponent({
  name: 'CreateSalePage',
  components: {
    AddItemPanel,
    MarketplaceHeader,
    VariantInfoDialog,
    StockDetailDialog,
    QRCode,
    SalesOrderDetailDialog,
  },
  setup() {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    const addressesStore = useAddressesStore()

    const draftSalesOrders = ref([].map(SalesOrder.parse))
    onMounted(() => fetchDraftSalesOrders())
    function fetchDraftSalesOrders() {
      const params = {
        shop_id: marketplaceStore.activeShopId,
        draft: true,
        created_by_id: marketplaceStore.user.id,
      }
      return backend.get(`sales-orders/`, { params })
        .then(response => {
          const results = response.data?.results
          if (Array.isArray(results)) draftSalesOrders.value = results.map(SalesOrder.parse)
          return response
        })
    }

    async function loadDraftSalesOrder(opts={ salesOrder: SalesOrder.parse(), salesOrderId: 0 }) {
      let salesOrder = opts?.salesOrder
      if (!salesOrder && opts?.salesOrderId) {
        salesOrder = SalesOrder.parse({ id: opts?.salesOrderId })
        await salesOrder.refetch()
      }
      if (!salesOrder?.items?.length) await salesOrder.fetchItems()

      const items = salesOrder.items.map(item => {
        const _item = createEmptyItem()
        _item.variant = item.variant
        _item.quantity = item.quantity
        return _item
      })

      const paymentMode = salesOrder?.parsedPaymentMode
      const bchPayment = {
        recipient: salesOrder.bchRecipientAddress,
        txid: salesOrder.bchTxid,
        price: {
          timestamp: salesOrder?.bchPrice?.timestamp * 1,
          value: parseFloat(salesOrder?.bchPrice?.price),
        }
      }
      const receivedAmount = parseFloat(salesOrder?.receivedAmount) || null

      clearFormData()
      formData.value.items = items
      formData.value.paymentMode = paymentMode
      formData.value.receivedAmount = receivedAmount
      formData.value.bchPayment = bchPayment
      formData.value.salesOrder = salesOrder
      tabs.value.forEach(tab => tab.disable = true)
      tab.value = tabs.value[0]?.name
      tabs.value[0].disable = false
      if (bchPayment?.txid && paymentMode == 'BCH') {
        tab.value = tabs.value.at(-1).name
        tabs.value.forEach(tab => tab.disable = false)        
      }

      if (bchPayment?.txid) {
        const satoshis = Math.floor((receivedAmount / bchPayment?.price?.value) * 10 ** 8)
        const txData = txListener.value.parseWebsocketDataReceived({
          txid: bchPayment?.txid,
          amount: satoshis / 10 ** 8,
          value: satoshis,
          token_symbol: 'BCH',
        })

        txData.marketValue = {
          symbol: salesOrder?.currency?.symbol || marketplaceStore?.currency,
          price: bchPayment?.price?.value,
          amount: receivedAmount,
        }

        transactionsReceived.value.push(txData)
      }
    }

    const tab = ref('items')
    const tabs = ref([
      { name: 'items', label: 'Items', disable: false },
      { name: 'stocks', label: 'Stocks', disable: true },
      { name: 'payment', label: 'Payment', disable: true },
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

    // onMounted(() => {
    //   const params = {
    //     offset: 2,
    //     limit: 2,
    //     shop_id: marketplaceStore.activeShopId,
    //   }
    //   backend.get('variants/', { params })
    //     .then(response => {
    //       response?.data?.results.map(Variant.parse).forEach(variant => {
    //         addItem({variant, quantity: 1 })
    //       })
    //     })
    //   setTimeout(() => nextTab(), 10)
    //   setTimeout(() => nextTab(), 10)
    //   setTimeout(() => nextTab(), 10)
    // })

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
      salesOrder: [].map(SalesOrder.parse)[0],
      items: [].map(createEmptyItem),
      paymentMode: 'BCH', // BCH | Other
      receivedAmount: null,
      bchPayment: {
        recipient: addressesStore.currentAddressSet?.receiving || '',
        price: { timestamp: Date.now(), value: 16378.05 }, // for BCH
        txid: '',
      },
    })

    const formComputedData = computed(() => {
      const data = { subtotal: 0, bchSubtotal: 0, bchTxidUrl: '', changeAmount: 0 }
      if (formData.value?.items?.length) {
        data.subtotal = formData.value?.items
          .reduce((subtotal, item) => {
            if (isNaN(item?.variant?.price)) return subtotal
            if (isNaN(item?.quantity)) return subtotal
            return subtotal + (item?.variant?.price * item?.quantity)
          }, 0)
      }
      if (formData.value.bchPayment?.price?.value) {
        data.bchSubtotal = data.subtotal / formData.value.bchPayment.price.value
        data.bchSubtotal = Math.floor(data.bchSubtotal * 10 ** 8) / 10 ** 8
      }

      if (formData.value.bchPayment?.txid) {
        const txid = formData.value.bchPayment?.txid
        const isTestnet = formData.value?.bchPayment?.recipient?.startsWith?.('bchtest:')
        if (isTestnet) data.bchTxidUrl = `https://chipnet.imaginary.cash/tx/${txid}`
        else data.bchTxidUrl = `https://blockchair.com/bitcoin-cash/transaction/${txid}`
      }

      const change = formData.value?.receivedAmount - data.subtotal
      if (!isNaN(change) && change >= 0) data.changeAmount = Math.round(change * 10 ** 3) / 10 ** 3
      return data
    })

    const bchPaymentUrl = computed(() => {
      const recipient = formData.value.bchPayment?.recipient
      const amount = formComputedData.value.bchSubtotal
      if (!amount || !recipient) return ''

      return `${recipient}?amount=${amount}`
    })

    onMounted(() => updateBchPrice())
    watch(() => [formData.value.paymentMode], () => updateBchPrice())

    function clearFormData(opts={delay: 0}) {
      if (opts?.delay && !isNaN(opts?.delay)) {
        setTimeout(() => _clearFormData(), opts?.delay)
        return
      }
      _clearFormData()
    }

    function _clearFormData() {
      formData.value.salesOrder = null
      formData.value.items = []
      formData.value.receivedAmount = null
      formData.value.bchPayment = {
        recipient: '',
        price: { timestamp: 0, value: 0 },
        txid: '',
      }
      formData.value.paymentMode = 'BCH'
      tabs.value.forEach(tab => tab.disable = true)
      tabs.value[0].disable = false
      tab.value = tabs.value[0].name
    }

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

    function updateBchPrice(opts={ checkPaymentMode: true }) {
      if (opts?.checkPaymentMode && formData.value.paymentMode != 'BCH') return Promise.resolve()
      if (formData.value?.bchPayment?.txid) return Promise.reject('Payment already sent')

      const currencyCode = marketplaceStore.currency
      return backend.get(`prices/bch/${currencyCode}/`)
        .then(response => {
          const value = parseFloat(response?.data?.price)
          const timestamp = (response?.data?.timestamp ? new Date(response?.data?.timestamp) : null) * 1
          if (!value || !timestamp) return Promise.reject({ response })
          formData.value.bchPayment.price = { timestamp , value }
          return response
        })
    }

    function updateRecipient() {
      if (formData.value.bchPayment.txid) return Promise.reject('Has existing transaction')
      const addresses = addressesStore.addressSets
        .map(addressSet => addressSet?.receiving)
        .filter(Boolean)
      const currentAddress = formData.value.bchPayment.recipient
      const index = addresses.indexOf(currentAddress)
      const nextIndex = (index+1) % addresses.length
      formData.value.bchPayment.recipient = addresses[nextIndex]
    }

    const txListener = ref(new TransactionListener())
    onUnmounted(() => txListener.value?.disconnect?.())
    onMounted(() => updateTxListenerState())
    watch(tab, ()=> updateTxListenerState())
    watch(() => [formData.value.bchPayment.recipient], () => updateTxListenerState())
    function updateTxListenerState() {
      if (tab.value != 'payment') return Promise.resolve('Not in payment tab')
      return runListener()
    }
    function runListener() {
      txListener.value.disconnect()
      txListener.value.address = formData.value.bchPayment.recipient
      txListener.value.addListener(txListenerCallback)
      return txListener.value.connect()
    }

    const displayReceivedTransactions = ref(false)
    const transactionsReceived = ref([].map(() => {
      const data = txListener.value.parseWebsocketDataReceived()
      return Object.assign({ marketValue: { symbol: '', price: 0, amount: 0 } }, data)
    }))

    const txListenerCallback = (msg, parsedData) => {
      const price = parseFloat(formData.value.bchPayment.price.value)
      const marketValue = {
        symbol: formData.value?.salesOrder?.currency?.symbol || marketplaceStore?.currency,
        price: price,
        amount: (Math.floor(parsedData?.value * price) / 10 ** 8),
      }
      marketValue.amount = Number(marketValue.amount.toPrecision(3))

      parsedData.marketValue = marketValue

      const index = transactionsReceived.value.findIndex(data => data?.txid == parsedData?.txid)
      if (index >= 0) {
        transactionsReceived.value[index] = parsedData
      } else {
        transactionsReceived.value.push(parsedData)
        displayReceivedTransaction(parsedData)
        displayReceivedTransactions.value = true
      }
    }

    function displayReceivedTransaction (data) {
      $q.dialog({
        component: ReceiveUpdateDialog,
        componentProps: {
          txid: data?.txid,
          address: data?.address,
          amount: data?.amount,
          tokenCurrency: data?.tokenSymbol,
          marketValue: data?.marketValue?.amount,
          marketValueCurrency: data?.marketValue?.currency,
          logo: data?.logo,
          expectedAmount: formComputedData.value.bchSubtotal,
        }
      })
        .onOk(() => {
          formData.value.bchPayment.txid = data?.txid
          formData.value.receivedAmount = data?.marketValue?.amount
          createSale({ draft: true, silent: true })
          if (tab.value == 'payment') nextTab()
        })
    }

    const serializedFormData = computed(() => {
      const data = {
        shop_id: marketplaceStore.activeShopId,
        payment_mode: formData.value.paymentMode.toLowerCase() || undefined,
        received_amount: formData.value.receivedAmount,
        bch_price: {
          price: formData.value.bchPayment.price.value,
          timestamp: new Date(formData.value.bchPayment.price.timestamp),
        },
        bch_recipient_address: formData.value.bchPayment.recipient,
        bch_txid: formData.value.bchPayment.txid,
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
      return data
    })

    watch(tab, () => saveSale())
    const saveSale = debounce(function() {
      if (!formData.value.salesOrder?.id) return
      return createSale({ draft: true, silent: true })
    }, 500, true)
    

    function createSale(opts = { draft: undefined, silent: false }) {
      const salesOrderId = formData.value?.salesOrder?.id
      const data = serializedFormData.value
      data.draft = typeof opts?.draft === 'boolean' ? opts?.draft : undefined

      let request
      if (salesOrderId) request = backend.patch(`sales-orders/${salesOrderId}/`, data)
      else request = backend.post('sales-orders/', data)

      loading.value = true
      return request
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          formData.value.salesOrder = SalesOrder.parse(response?.data)
          if (formData.value.salesOrder?.draft) {
            const index = draftSalesOrders.value.findIndex(so => so?.id == formData.value.salesOrder?.id)
            if (index < 0) draftSalesOrders.value.push(formData.value.salesOrder)
            else draftSalesOrders.value[index] = formData.value.salesOrder
          }

          if (!opts?.silent) {
            $q.dialog({
              title: 'Success',
              message: data.draft ? 'Draft saved' : 'Sale Created',
            }).onDismiss(() => $router.go(-1))
          }
          return response
        })
        .catch(error => {
          let errorMsg = error?.response?.data?.detail
          if (!opts?.silent) {
            $q.notify({
              message: data.draft ? 'Failed to save draft' : 'Failed to create sale',
              caption: errorMsg || 'Encountered error',
              type: 'negative',
            })
          }
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

    const salesOrderDetailDialog = ref({ show: false, salesOrder: SalesOrder.parse() })
    function viewSalesOrder(salesOrder=SalesOrder.parse()) {
      if (!Array.isArray(salesOrder.items)) salesOrder.fetchItems()
      salesOrderDetailDialog.value.salesOrder = salesOrder
      salesOrderDetailDialog.value.show = true
    }

    return {
      marketplaceStore,

      draftSalesOrders,
      fetchDraftSalesOrders,
      loadDraftSalesOrder,

      tab,
      tabs,
      nextTab,

      loading,
      formData,
      formComputedData,
      bchPaymentUrl,
      clearFormData,

      addItem,
      removeItem,
      selectStocks,

      updateRecipient,
      txListener,
      runListener,
      displayReceivedTransactions,
      transactionsReceived,
      displayReceivedTransaction,

      createSale,

      variantInfoDialog,
      viewItemVariant,

      stockInfoDialog,
      viewStockDetail,

      salesOrderDetailDialog,
      viewSalesOrder,

      formatTimestampToText,
      formatDateRelative,
    }
  },
})
</script>
<style scoped>
.items-container {
  display: flex;
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
<style scoped lang="scss">
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

.qr-code-container {
  position:relative;

  display: flex;
  justify-content: center;
  align-content: center;

  border-radius: 16px;
  border: 4px solid #ed5f59;
  background-color: white;

  padding: 1.2rem 1.7rem;
}

.qr-code-container > .qr-code-icon {
  background-color: white;
  border-radius: 10000px;

  /* absolute center */
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.q-r-ml-md {
  margin-left: -(map-get($space-md, 'x'))/2;
}
</style>
