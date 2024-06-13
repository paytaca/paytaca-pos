<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('SalesOrder') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div v-if="!initialized && loading" class="row items-center justify-center">
        <q-spinner size="3em"/>
      </div>
      <q-card v-if="initialized">
        <q-card-section>
          <div class="row items-center">
            <div class="text-h5">
              <template v-if="salesOrder?.draft">{{ $t('DraftSale') }}</template>
              <template v-else>{{ $t('Sale') }}</template>
              <template v-if="salesOrder?.number">#{{ salesOrder?.number }}</template>
              <q-spinner v-if="loading" class="on-right"/>
            </div>
            <q-chip
              v-if="salesOrder?.parsedStatus"
              dense
              :color="salesOrder?.statusColor"
              class="text-weight-medium text-white q-ml-sm q-my-none q-mr-none"
            >
              {{ salesOrder?.parsedStatus }}
            </q-chip>
            <q-space/>
            <q-btn
              v-if="!salesOrder?.isVoid || true"
              flat
              padding="xs"
              icon="more_vert"
            >
              <q-menu>
                <q-item clickable v-ripple v-close-popup @click="() => confirmVoidSale()">
                  <q-item-section>
                    <q-item-label>
                      {{ $t('VoidSale') }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-menu>
            </q-btn>
          </div>
          <div class="row items-center text-caption text-grey">
            <template v-if="salesOrder?.createdAt">
              <div>{{ formatTimestampToText(salesOrder?.createdAt) }}</div>
              <q-space/>
            </template>
            <div v-if="salesOrder?.createdBy?.fullName">{{ salesOrder?.createdBy?.fullName }}</div>
          </div>

          <div class="text-h6 q-mt-md">{{ $t('Items') }}</div>
          <table class="items-table">
            <tr
              v-for="item in salesOrder?.items" :key="item?.id"
            >
              <td class="full-width row items-center no-wrap text-weight-medium">
                <img
                  v-if="item?.variant?.itemImage"
                  :src="item?.variant?.itemImage"
                  style="width:50px;"
                  class="rounded-borders q-mr-xs"
                />
                <div>
                  <div>{{ item?.variant?.itemName || item?.itemName }}</div>
                  <!-- <div class="text-caption bottom">{{ item?.price }} {{ salesOrder?.currency?.symbol }}</div> -->
                </div>
              </td>
              <td style="text-wrap:nowrap;">x{{ item?.quantity }}</td>
              <td class="text-right" style="text-wrap:nowrap;">
                {{ item?.subtotal }} {{ salesOrder?.currency?.symbol }}
              </td>
            </tr>
          </table>
          
          <q-separator spaced/>
          <div class="text-h5 row items-start">
            <div class="q-space">{{ $t('Total') }}</div>
            <div>
              <div v-if="salesOrder?.paymentMode == 'bch' && salesOrder?.bchTotal" class="text-right">
                <div class="row items-center">
                  <div>{{ salesOrder?.bchTotal }} BCH</div>
                  <q-icon v-if="salesOrder?.bchPrice?.timestamp" name="info" size="1em">
                    <q-menu class="q-pa-sm">
                      {{
                        $t(
                          'BchPriceAtValue',
                          { value: formatTimestampToText(salesOrder?.bchPrice?.timestamp) },
                          `BCH price at ${ formatTimestampToText(salesOrder?.bchPrice?.timestamp) }`
                        )
                      }}
                    </q-menu>
                  </q-icon>
                </div>
                <div class="text-grey text-caption bottom">
                  {{ salesOrder?.total }} {{ salesOrder?.currency?.symbol }}
                </div>
              </div>
              <template v-else>
                {{ salesOrder?.total || 0 }} {{ salesOrder?.currency?.symbol }}
              </template>
            </div>
          </div>

          <div class="row no-wrap items-start">
            <div class="q-space q-mr-sm">{{ $t('PaymentMethod') }}</div>
            <div>{{ salesOrder.parsedPaymentMode }}</div>
          </div>
          <template v-if="salesOrder?.paymentMode == 'bch'">
            <div class="row no-wrap items-start">
              <div class="q-space q-mr-sm">{{ $t('Recipient') }}</div>
              <div style="word-break:break-all;" class="ellipsis">{{ salesOrder?.bchRecipientAddress }}</div>
            </div>
            <div v-if="salesOrder?.bchTxid" class="row no-wrap items-start">
              <div class="q-space q-mr-sm">{{ $t('Transaction') }}</div>
              <div style="word-break:break-all;" class="ellipsis">{{ salesOrder?.bchTxid }}</div>
              <q-btn
                v-if="salesOrder?.bchTxidLink"
                flat round
                icon="open_in_new" size="0.5em"
                target="_blank"
                :href="salesOrder?.bchTxidLink"
              />
            </div>
          </template>
          <div v-if="salesOrder?.receivedAmount || salesOrder?.paymentMode != 'bch'" class="row no-wrap items-start text-subtitle1">
            <div class="q-space q-mr-sm">Amount Received</div>
            <div v-if="salesOrder?.receivedAmount">
              {{ salesOrder.receivedAmount }} {{ salesOrder?.currency?.symbol }}
            </div>
            <div v-else-if="salesOrder?.paymentMode != 'bch' && !salesOrder?.isVoid" class="text-grey text-underline">Set</div>
            <q-popup-edit
              v-if="salesOrder?.id && !salesOrder?.isVoid"
              :cover="false"
              anchor="bottom right"
              self="top right"
              :model-value="salesOrder?.receivedAmount"
              @update:model-value="val => setAmountReceived(val)"
              separate-close-popup
              v-slot="scope"
            >
              <q-input
                dense
                borderless
                label="Amount Received"
                type="number"
                v-model.number="scope.value"
                :suffix="salesOrder?.currency?.symbol"
                @keydown.enter="() => scope.set()"
              />
            </q-popup-edit>
          </div>
          <div v-if="salesOrder?.changeAmount > 0" class="row no-wrap items-start text-h6">
            <div class="q-space q-mr-sm">Change</div>
            <div>{{ salesOrder?.changeAmount }} {{ salesOrder?.currency?.symbol }}</div>
          </div>
          <template v-if="salesOrder?.paymentMode == 'bch' && !salesOrder?.isVoid">
            <div class="row no-wrap items-start justify-center q-mt-md">
              <!-- <div class="q-space q-mr-sm">Payment</div> -->
              <q-btn
                flat
                padding="none"
                no-caps label="Scan Payment"
                icon="mdi-qrcode-scan" 
                @click="() => bchPayment.show = !bchPayment.show"
              />
            </div>
            <q-slide-transition>
              <div v-if="bchPayment.show && !salesOrder?.isVoid" class="q-mt-md">
                <div class="row justify-center items-center q-mt-sm">
                  <div class="qr-code-container row items-center">
                    <img src="~assets/bch-logo.png" height="50" class="qr-code-icon"/>
                    <QRCode
                      :text="bchPaymentUrl"
                      color="#253933"
                      :size="200"
                      error-level="H"
                      :style="bchPaymentUrl ? '' : 'opacity:0;'"
                    />
                  </div>
                </div>
                <div class="q-mx-md">
                  <div class="text-h5 text-center">
                    {{ salesOrder?.bchTotal }} BCH
                  </div>
                  <q-input
                    dense
                    outlined
                    readonly
                    :model-value="bchPaymentUrl"
                  >
                    <template v-slot:append>
                      <q-btn flat padding="xs" icon="content_copy" @click="() => copyToClipboard(bchPaymentUrl)"/>
                    </template>
                  </q-input>
                </div>
                <q-item
                  v-for="(txReceived, index) in bchPayment.transactionsReceived" :key="index"
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
              </div>
            </q-slide-transition>
          </template>
        </q-card-section>
      </q-card>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { SalesOrder } from 'src/marketplace/objects'
import { errorParser, formatTimestampToText } from 'src/marketplace/utils'
import { TransactionListener } from 'src/wallet/utils'
import { useAddressesStore } from 'src/stores/addresses'
import { copyToClipboard, useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import QRCode from 'vue-qrcode-component'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import ReceiveUpdateDialog from 'src/components/receive-page/ReceiveUpdateDialog.vue'

export default defineComponent({
  name: 'SalesOrderDetail',
  components: {
    MarketplaceHeader,
    QRCode,
  },
  props: {
    salesOrderId: [Number, String]
  },
  setup(props) {
    const $q = useQuasar()
    const addressesStore = useAddressesStore()
    const initialized = ref(false)
    function resetPage() {
      initialized.value = false
      salesOrder.value = SalesOrder.parse()
    }
    onMounted(() => refreshPage())
    watch(() => [props.salesOrderId], () => {
      resetPage()
      refreshPage()
    })

    const loading = ref(false)
    const salesOrder = ref(SalesOrder.parse())
    function fetchSalesOrder() {
      if (!props?.salesOrderId) {
        salesOrder.value.raw = null
        return Promise.resolve()
      }

      loading.value = true
      return backend.get(`sales-orders/${props?.salesOrderId}/`)
        .then(response => {
          salesOrder.value = SalesOrder.parse(response?.data)
          return response
        })
        .finally(() => {
          loading.value = false
        })
    }

    const bchPaymentUrl = computed(() => {
      const recipient = salesOrder.value?.bchRecipientAddress
      const amount = salesOrder.value?.bchTotal
      if (!amount || !recipient) return ''
      return `${recipient}?amount=${amount}`
    })

    const txListener = ref(new TransactionListener())
    const bchPayment = ref({
      show: false,
      transactionsReceived: [].map(txListener.value.parseWebsocketDataReceived),
    })

    watch(() => [bchPayment.value.show], () => {
      if (!bchPayment.value.show) return txListener.value.disconnect()

      if (!salesOrder.value?.bchRecipientAddress) updateRecipient()
      txListener.value.address = salesOrder.value?.bchRecipientAddress
      txListener.value.addListener(txListenerCallback)
      txListener.value.connect()

      const currentPrice = parseFloat(salesOrder.value.bchPrice?.price)
      if (!currentPrice) updateBchPrice()
    })

    function updateBchPrice() {
      const currentPrice = parseFloat(salesOrder.value.bchPrice?.price)
      if (currentPrice) return Promise.reject('Sales order has existing bch price')

      const currency = salesOrder.value.currency?.code || salesOrder.value.currency?.symbol
      return backend.get(`prices/bch/${currency}/`)
        .then(response => {
          salesOrder.value.bchPrice.price = parseFloat(response?.data?.price)
          salesOrder.value.bchPrice.timestamp = new Date(response?.data?.timestamp || undefined)
          return response
        })
    }

    function updateRecipient() {
      if (salesOrder.value?.bchTxid) return Promise.reject('Has existing transaction')
      const addresses = addressesStore.addressSets
        .map(addressSet => addressSet?.receiving)
        .filter(Boolean)
      // const addresses = [
      //   'bchtest:qq4sh33hxw2v23g2hwmcp369tany3x73wuveuzrdz5',
      //   'bchtest:qzyrw008v4rnxvzuzauetf4z8s3rqyljw5jqddgug8',
      //   'bchtest:qrmrn0um32u752k2v3a3y4h6a7nhth249q8g33smvf',
      //   'bchtest:qzdlrh9ntufqsm6slcls02dp0c2859srkywkvd2c4e',
      //   'bchtest:qq20wfjhv53u3cm0k5w0rstt7y7rrckequas8t40qf',
      // ]
      const currentAddress = salesOrder.value.bchRecipientAddress
      const index = addresses.indexOf(currentAddress)
      const nextIndex = (index+1) % addresses.length
      salesOrder.value.bchRecipientAddress = addresses[nextIndex]
    }

    // window.t = () => {
    //   const data = {"token_name": "bch", "token_id": "slp/bch", "token_symbol": "bch", "token_decimals": 8, "amount": null, "value": 3280456, "address": "bchtest:qq4sh33hxw2v23g2hwmcp369tany3x73wuveuzrdz5", "source": "WatchTower", "txid": "6414eab1068fa86aaff06860ea23169037287fd0d3d009474519c3ad27420a92", "block": null, "index": 0, "address_path": "0/0", "senders": ["bchtest:qq4sh33hxw2v23g2hwmcp369tany3x73wuveuzrdz5", "bchtest:qq4sh33hxw2v23g2hwmcp369tany3x73wuveuzrdz5"]}
    //   const parsedData = txListener.value.parseWebsocketDataReceived(data)
    //   txListenerCallback(undefined, parsedData)
    // }

    const txListenerCallback = (msg, parsedData) => {
      const price = parseFloat(salesOrder.value?.bchPrice?.price)
      const marketValue = {
        symbol: salesOrder.value?.currency?.symbol,
        price: price,
        amount: (Math.floor(parsedData?.value * price) / 10 ** 8),
      }
      marketValue.amount = Number(marketValue.amount.toPrecision(3))

      parsedData.marketValue = marketValue
      console.log(parsedData)
      const index = bchPayment.value.transactionsReceived.findIndex(data => data?.txid == parsedData?.txid)
      if (index >= 0) {
        bchPayment.value.transactionsReceived[index] = parsedData
      } else {
        bchPayment.value.transactionsReceived.push(parsedData)
        displayReceivedTransaction(parsedData)
      }
    }

    function displayReceivedTransaction (data=txListener?.value?.parseWebsocketDataReceived?.()) {
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
          expectedAmount: salesOrder.value?.bchTotal,
        }
      })
        .onOk(() => saveBchPayment(data))
    }

    function saveBchPayment(txReceived=txListener?.value?.parseWebsocketDataReceived?.()) {
      const data = {
        bch_txid: txReceived?.txid,
        received_amount: parseFloat(txReceived?.marketValue?.amount).toFixed(3),
        bch_recipient_address: txReceived?.address,
        bch_price: {
          price: salesOrder.value.bchPrice.price,
          timestamp: salesOrder.value.bchPrice.timestamp,
        },
      }

      loading.value = true
      return backend.patch(`sales-orders/${salesOrder.value?.id}/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          salesOrder.value.raw = response?.data
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          const errorMsg = data?.detail ||
                         errorParser.firstElementOrValue(data) ||
                         errorParser.firstElementOrValue(data?.non_field_errors)
          $q.notify({
            type: 'negative',
            message: errorMsg || 'Unable to save payment',
            multiLine: true,
          })
        })
        .finally(() => {
          loading.value = false
        })
        .then(() => {
          addressesStore.removeAddressSet(data.bch_recipient_address)
          addressesStore.fillAddressSets()
        })
    }

    function setAmountReceived(value) {
      const data = { received_amount: value || null }
      loading.value = true
      return backend.patch(`sales-orders/${salesOrder.value?.id}/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          salesOrder.value.raw = response?.data
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          const errorMsg = data?.detail ||
                         errorParser.firstElementOrValue(data) ||
                         errorParser.firstElementOrValue(data?.non_field_errors) ||
                         errorParser.firstElementOrValue(data?.received_amount)
          $q.notify({
            type: 'negative',
            message: errorMsg || 'Unable to set received amount',
            multiLine: true,
          })
        })
        .finally(() => {
          loading.value = false
        })
    }

    function confirmVoidSale() {
      $q.dialog({
        title: 'Void Sales Order',
        message: 'Void sales order. Are you sure?',
        ok: { color: 'red', noCaps: true, label: 'Void sale' },
        cancel: { flat: true, color: 'grey', noCaps: true, label: 'Cancel' },
      }).onOk(() => voidSale())
    }

    function voidSale() {
      const dialog = $q.dialog({
        title: 'Voiding Sale',
        progress: true,
        persistent: true,
        ok: false,
      })

      return backend.post(`sales-orders/${salesOrder?.value?.id}/void/`)
        .then(response => {
          if (!response?.data?.id) fetchSalesOrder()
          else salesOrder.value.raw = response?.data

          dialog.hide()
        })
        .catch(error => {
          const data = error?.response?.data
          const errorMessage = data?.detail || (Array.isArray(data) ? data?.[0] : null)
          dialog.update({
            title: errorMessage ? 'Error' : '',
            message: errorMessage || 'Failed to void sale',
          })
        })
        .finally(() => {
          dialog.update({
              progress: false,
              persistent: false,
              ok: false,
              cancel: { flat: true, noCaps: true, label: 'Close', color: 'grey' },
            })
        })
    }

    function copyToClipboard(value, message='') {
      this.$copyText(value)
        .then(() => {
          $q.notify({
            message: message || 'Copied to clipboard',
            timeout: 800,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        })
        .catch(() => {})
    }

    async function refreshPage(done=() => {}) {
      try {
        await fetchSalesOrder()
      } finally {
        initialized.value = true
        done()
      }
    }

    return {
      initialized,
      loading,
      resetPage,
      salesOrder,
      setAmountReceived,

      bchPaymentUrl,
      bchPayment,
      displayReceivedTransaction,

      confirmVoidSale,
      voidSale,

      copyToClipboard,

      refreshPage,

      // utils funcs
      formatTimestampToText,
    }
  },
})
</script>
<style lang="scss" scoped>
.items-table {
  width: 100%;
  border-spacing: (map-get($space-sm, 'x'))/2;
}
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
</style>
