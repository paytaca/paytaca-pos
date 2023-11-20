<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Payments</div>
            <div class="text-grey">Storefront</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md">
          <q-input
            dense
            v-model="filterOpts.search"
            placeholder="Customer name / Order ID"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn flat padding="sm" icon="tune">
            <q-menu v-model="openFilterOptsForm" class="q-pa-md">
              <q-btn
                flat
                no-caps label="Reset"
                color="brandblue"
                padding="xs md"
                class="text-underline q-r-mr-lg float-right"
                v-close-popup
                @click="() => filterOpts = createDefaultFilterOpts()"
              />
              <div class="q-mb-sm">
                <div class="text-subtitle1">Statuses</div>
                <div>
                  <q-checkbox
                    v-for="status in statusOpts" :key="status"
                    dense
                    :label="formatStatusGeneric(status)"
                    :val="status"
                    v-model="filterOpts.statuses"
                    class="q-pa-xs"
                  />
                </div>
              </div>
              <div class="q-mb-sm">
                <div class="text-subtitle1">Escrow</div>
                <q-btn-toggle
                  v-model="filterOpts.isEscrow"
                  no-caps
                  spread
                  toggle-color="primary"
                  padding="none xs"
                  :options="[
                    {label: 'Yes', value: true },
                    {label: 'No', value: false },
                    {label: 'All', value: undefined}
                  ]"
                />
              </div>

              <div class="q-mb-sm">
                <div class="text-subtitle1">Refundable</div>
                <q-btn-toggle
                  v-model="filterOpts.refundable"
                  no-caps
                  spread
                  toggle-color="primary"
                  padding="none xs"
                  :options="[
                    {label: 'Yes', value: true },
                    {label: 'No', value: false },
                    {label: 'All', value: undefined}
                  ]"
                />
              </div>
            </q-menu>
          </q-btn>
        </div>
        <div class="row q-gutter-sm">
          <div
            v-if="filterOpts?.statuses?.length" style="max-width:45vw;"
            class="ellipsis filter-opt q-px-xs"
            @click="openFilterOptsForm = true"
          >
            Status: {{ filterOpts?.statuses?.map?.(formatStatusGeneric)?.join(', ') }}
          </div>
          <div
            v-if="(typeof filterOpts?.isEscrow) === 'boolean'"
            class="filter-opt q-px-xs"
            @click="openFilterOptsForm = true"
          >
            <q-icon
              size="1.25em"
              :name="filterOpts?.isEscrow ? 'check_circle' : 'cancel'"
              :color="filterOpts?.isEscrow ? 'green' : 'red'"
              class="q-mr-xs"
            />
            Escrow
          </div>
          <div
            v-if="(typeof filterOpts?.refundable) === 'boolean'"
            class="filter-opt q-px-xs"
            @click="openFilterOptsForm = true"
          >
            <q-icon
              size="1.25em"
              :name="filterOpts?.refundable ? 'check_circle' : 'cancel'"
              :color="filterOpts?.refundable ? 'green' : 'red'"
              class="q-mr-xs"
            />
            Refundable
          </div>
        </div>
      </div>
      <q-table
        :loading="fetchingPayments"
        :columns="paymentsTableColumns"
        :rows="payments"
        :pagination="{ rowsPerPage: 0 }"
        row-key="id"
        hide-pagination
      >
        <template v-slot:bottom>
          <div class="row items-center full-width">
            <q-space/>
            <LimitOffsetPagination
              :pagination-props="{
                maxPages: 5,
                rounded: true,
                padding: 'sm md',
                flat: true,
                boundaryNumbers: true
              }"
              :hide-below-pages="2"
              :modelValue="paymentsPagination"
              @update:modelValue="fetchPayments"
            />
          </div>
        </template>

        <template v-slot:body-cell-source="props">
          <q-td :props="props">
            <q-btn v-if="props?.row?.orderId"
              flat
              no-caps :label="`Order #${props?.row?.orderId}`"
              padding="2px sm"
              @click="() => displayPaymentOrder(props.row)"
            />
            <span v-else-if="props?.row?.checkoutId" class="text-grey">
              Checkout
            </span>
          </q-td>
        </template>
        <template v-slot:body-cell-escrow="props">
          <q-td :props="props">
            <q-btn
              v-if="props?.row?.escrowContractAddress"
              flat
              no-caps label="View details"
              padding="none xs"
              @click="() => displayPaymentEscrowContract(props?.row)"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat padding="sm" icon="more_vert">
              <q-menu>
                <q-item clickable v-ripple v-close-popup @click="() => refundPayment(props?.row)">
                  <q-item-section>
                    <q-item-label>Refund payment</q-item-label>
                  </q-item-section>
                </q-item>
              </q-menu>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>
    <EscrowContractDialog
      v-model="escrowContractDialog.show"
      :escrow-contract="escrowContractDialog.escrowContract"
      :bch-price="escrowContractDialog.bchPrice"
      :currency="escrowContractDialog.currency"
    />
    <OrderDetailDialog
      v-model="orderDetailDialog.show"
      :order="orderDetailDialog.order"
    />
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { BchPrice, EscrowContract, Order, Payment } from 'src/marketplace/objects'
import { errorParser, formatDateRelative, formatStatusGeneric } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import EscrowContractDialog from 'src/components/marketplace/storefront/EscrowContractDialog.vue'
import OrderDetailDialog from 'src/components/marketplace/storefront/OrderDetailDialog.vue'

export default defineComponent({
  name: 'PaymentsPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
    EscrowContractDialog,
    OrderDetailDialog,
  },
  setup() {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()
    window.t = () => $q.dark.toggle()

    onMounted(() => refreshPage())
    const openFilterOptsForm = ref(false)
    function createDefaultFilterOpts() {
      return {
        search: '',
        statuses: ['sent', 'received', 'voided'].map(String),
        isEscrow: undefined,
        refundable: undefined,
      }
    }
    const filterOpts = ref(createDefaultFilterOpts())
    watch(filterOpts, () => fetchPayments(), { deep: true })
    const statusOpts = ['pending', 'sent', 'received', 'voided']
    function toggleSelectedStatusFilter(status='') {
      if (!statusOpts.includes(status)) return

      if(filterOpts.value.statuses.includes(status)) {
        filterOpts.value.statuses = filterOpts.value.statuses.filter(_status => _status !== status)
      } else {
        filterOpts.value.statuses = statusOpts.filter(_status => {
          return filterOpts.value.statuses.includes(_status) || _status === status
        })
      }
    }

    const fetchingPayments = ref(false)
    const payments = ref([].map(Payment.parse))
    const paymentsPagination = ref({ offset: 0, limit: 0, count: 0 })
    function fetchPayments(opts={ limit: 0, offset: 0 }) {
      const params = {
        storefront_id: marketplaceStore.storefront.id || -1,
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
        s: filterOpts.value?.search || undefined,
        statuses: filterOpts.value?.statuses?.filter?.(Boolean)?.join?.(',') || undefined,
        is_escrow: filterOpts.value?.isEscrow,
        refundable: filterOpts.value?.refundable,
      }

      fetchingPayments.value = true
      return backend.get(`connecta/payments/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          payments.value = response?.data?.results.map(Payment.parse)
          paymentsPagination.value.count = response?.data?.count
          paymentsPagination.value.limit = response?.data?.limit
          paymentsPagination.value.offset = response?.data?.offset

          return response
        })
        .finally(() => {
          fetchingPayments.value = false
        })
    }

    const paymentsTableColumns = [
      { name: 'id', align: 'center', label: 'Payment', field: 'id', format: val => val ? `#${val}` : '' },
      { name: 'status', align: 'center', label: 'Status', field: 'status', format: formatStatusGeneric },
      { name: 'amount', align: 'center', label: 'Amount', field: obj => `${obj?.totalAmount} ${obj?.currency?.symbol}` },
      { name: 'source', align: 'center', label: 'Reference', },
      { name: 'escrow', align: 'center', label: 'Escrow', },
      { name: 'timestamp', align: 'center', label: 'Timestamp', field: 'createdAt', format: formatDateRelative },
      { name: 'actions', align: 'center', },
    ]

    function refundPayment(payment=Payment.parse()) {
      const paymentId = payment?.id

      const dialog = $q.dialog({
        title: 'Refunding payment',
        progress: true,
        persistent: true,
        ok: false,
        color: 'brandblue',
      })

      return backend.post(`connecta/payments/${paymentId}/void_escrow/`)
        .then(response => {
          const prevStatus = payment?.status
          payment.raw = response?.data
          dialog.update({ title: 'Refund', message: 'Payment updated'})
          if (prevStatus != payment?.status && payment?.status === 'voided')  {
            dialog.update({ message: 'Payment refunded!' })
          }
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMessage = errorParser.firstElementOrValue(data?.non_field_errors) ||
                            errorParser.firstElementOrValue(data?.detail)

          if (!errorMessage && typeof error?.message === 'string' && error?.message?.length < 200) {
            errorMessage = error?.message
          }
          if (!errorMessage) errorMessage = 'Unknown error'
          dialog.update({ title: 'Refund failed', message: errorMessage })
          return Promise.reject(error)
        })
        .finally(() => {
          dialog.update({ persistent: false, progress: false, ok: true })
        })
    }


    const escrowContractDialog = ref({
      show: false,
      escrowContract: EscrowContract.parse(),
      bchPrice: BchPrice.parse(),
      currency: '',
    })
    async function displayPaymentEscrowContract(payment=Payment.parse()) {
      if (!payment.escrowContractAddress) return

      if (!payment.escrowContract) await payment.fetchEscrowContract()

      escrowContractDialog.value.escrowContract = payment.escrowContract
      escrowContractDialog.value.bchPrice = payment.bchPrice
      escrowContractDialog.value.currency = payment.currency.symbol
      escrowContractDialog.value.show = true
    }

    const orderDetailDialog = ref({ show: false, order: Order.parse() })
    async function displayPaymentOrder(payment = Payment.parse()) {
      if (!payment.orderId) return

      if (!payment.order) {
        const dialog = $q.dialog({
          title: 'Fetching order',
          progress: true,
          color: 'brandblue',
          ok: false,
          cancel: false,
          persistent: true,
        })
        await payment.fetchOrder()?.finally(() => dialog?.hide())
        dialog.hide()
      }

      orderDetailDialog.value.order = payment.order
      orderDetailDialog.value.show = true
    }

    async function refreshPage(done=()=>{}) {
      try {
        await fetchPayments()
      } finally {
        done?.()
      }
    }

    return {
      openFilterOptsForm,
      createDefaultFilterOpts,
      filterOpts,
      statusOpts,
      toggleSelectedStatusFilter,

      fetchingPayments,
      payments,
      paymentsPagination,
      fetchPayments,
      paymentsTableColumns,

      refundPayment,

      escrowContractDialog,
      displayPaymentEscrowContract,
      orderDetailDialog,
      displayPaymentOrder,

      refreshPage,

      formatStatusGeneric,
    }
  },
})
</script>
<style lang="scss" scoped>
.filter-opt {
  border: 1px solid currentColor;
  border-radius: 4px;
}
</style>