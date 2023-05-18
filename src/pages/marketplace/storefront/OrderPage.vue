<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Order</div>
            <div class="text-grey">Storefront</div>
          </div>
        </template>
      </MarketplaceHeader>

      <div class="row items-center q-mb-md">
        <div class="text-h5 q-space">Order #{{ order?.id }}</div>
        <div>
          <q-chip :color="parseOrderStatusColor(order?.status)" class="text-weight-medium">
            {{ formatOrderStatus(order?.status) }}
          </q-chip>
          <q-btn flat icon="more_vert" padding="xs">
            <q-menu>
              <q-item
                v-if="prevStatus"
                v-close-popup clickable
                @click="() => updateStatus({ status: prevStatus, errorMessage:'Unable to revert status'})"
              >
                <q-item-section>
                  <q-item-label class="text-no-wrap">
                    <template v-if="prevStatus === 'pending'">Unconfirm order</template>
                    <template v-else-if="prevStatus === 'confirmed'">Revert to confirmed</template>
                    <template v-else-if="prevStatus === 'preparing'">Revert as preparing</template>
                    <template v-else>Revert to '{{ formatOrderStatus(prevStatus) }}'</template>
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-close-popup clickable
                @click="() => confirmCancelOrder()"
              >
                <q-item-section>
                  <q-item-label class="text-no-wrap">Cancel Order</q-item-label>
                </q-item-section>
              </q-item>
            </q-menu>
          </q-btn>
        </div>
        <div v-if="order?.createdAt" class="text-caption text-grey bottom col-12">
          {{ formatTimestampToText(order?.createdAt) }}
        </div>
      </div>
      
      <div class="row items-center q-gutter-sm q-mb-md">
        <q-btn
          v-if="nextStatus"
          no-caps
          :label="formatOrderStatus(nextStatus)"
          :color="parseOrderStatusColor(nextStatus)"
          class="q-space"
          @click="() => updateStatus({ status: nextStatus, errorMessage:'Unable to update order' })"
        />
      </div>
      <q-card class="q-mb-md">
        <q-card-section class="q-pt-sm">
          <div class="row items-center">
            <div class="text-h6 q-space">Delivery</div>
          </div>
          <div>
            {{ order?.deliveryAddress?.firstName }}
            {{ order?.deliveryAddress?.lastName }}
          </div>
          <div>{{ order?.deliveryAddress?.phoneNumber }}</div>
          <div>{{ order?.deliveryAddress?.location?.formatted }}</div>
        </q-card-section>
      </q-card>

      <q-card class="q-mb-md">
        <q-card-section class="q-pb-none q-pt-sm">
          <div class="row items-center">
            <div class="text-h6 q-space">Items</div>
          </div>
        </q-card-section>
        <q-markup-table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="orderItem in order?.items" :key="orderItem?.id">
              <td class="text-weight-medium" @click="displayVariant(orderItem?.variant)">
                <div class="row items-center justify-left no-wrap full-width text-left q-my-xs">
                  <q-img
                    v-if="orderItem?.variant?.itemImage"
                    :src="orderItem?.variant?.itemImage"
                    width="35px"
                    ratio="1"
                    class="rounded-borders q-mr-xs"
                  />
                  <div>{{ orderItem?.variant?.itemName }}</div>
                </div>
              </td>
              <td class="text-center" style="white-space:nowrap;">{{ orderItem?.quantity }}</td>
              <td class="text-center" style="white-space:nowrap;">{{ orderItem?.variant?.price }} {{ orderCurrency }}</td>
              <td class="text-center" style="white-space:nowrap;">{{ orderItem?.variant?.price * orderItem?.quantity }} {{ orderCurrency }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-card>

      <div class="q-px-xs" @click="toggleAmountsDisplay">
        <div class="row items-start text-subtitle2">
          <div class="q-space">Subtotal</div>
          <div v-if="displayBch">{{ orderAmounts.subtotal.bch }} BCH</div>
          <div v-else>{{ orderAmounts.subtotal.currency }} {{ orderCurrency }}</div>
        </div>
        <div class="row items-start text-subtitle2">
          <div class="q-space">Delivery fee</div>
          <div v-if="displayBch">{{ orderAmounts.deliveryFee.bch }} BCH</div>
          <div v-else>{{ orderAmounts.deliveryFee.currency }} {{ orderCurrency }}</div>
        </div>
        <div class="row items-start text-h6">
          <div class="q-space">Total</div>
          <div v-if="displayBch">{{ orderAmounts.total.bch }} BCH</div>
          <div v-else>{{ orderAmounts.total.currency }} {{ orderCurrency }}</div>
        </div>
      </div>
    </q-pull-to-refresh>
    <VariantInfoDialog v-model="variantInfoDIalog.show" :variant="variantInfoDIalog.variant"/>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Order, Variant } from 'src/marketplace/objects'
import { errorParser, formatOrderStatus, parseOrderStatusColor, formatTimestampToText } from 'src/marketplace/utils'
import { useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'
import CancelReasonFormDailog from 'src/components/marketplace/storefront/CancelReasonFormDailog.vue'

export default defineComponent({
  name: 'OrderPage',
  components: {
    MarketplaceHeader,
    VariantInfoDialog,
  },
  props: {
    orderId: [String, Number]
  },
  setup(props) {
    const $q = useQuasar()
    onMounted(() => refreshPage())
    const order = ref(Order.parse())
    function fetchOrder() {
      return backend.get(`connecta/orders/${props.orderId}/`)
      .then(response => {
        order.value = Order.parse(response?.data)
        return response
      })
    }
    const orderCurrency = computed(() => order.value?.currency?.symbol)
    const orderBchPrice = computed(() => order.value?.bchPrice?.price || undefined)
    const orderAmounts = computed(() => {
      const parseBch = num => Math.floor(num * 10 ** 8) / 10 ** 8
      const data = {
        subtotal: { currency: order.value?.subtotal || 0, bch: 0 },
        deliveryFee: { currency: order.value?.payment?.deliveryFee || 0, bch: 0 },
        total: { currency: 0, bch: 0 },
      }
      data.total.currency = Number(data.subtotal.currency) + Number(data.deliveryFee.currency)
      data.total.currency = Math.round(data.total.currency * 10 ** 3) / 10 ** 3

      if(!isNaN(orderBchPrice.value)) {
        data.subtotal.bch = parseBch(data.subtotal.currency / orderBchPrice.value)
        data.deliveryFee.bch = parseBch(data.deliveryFee.currency / orderBchPrice.value)
        data.total.bch = parseBch(data.total.currency / orderBchPrice.value)
      } else {
        data.subtotal.bch = null
        data.deliveryFee.bch = null
        data.total.bch = null
      }

      return data
    })

    const displayBch = ref(false)
    function toggleAmountsDisplay() {
      if (isNaN(orderBchPrice.value)) {
        displayBch.value = false
        return
      }
      displayBch.value = !displayBch.value
    }

    const orderStatusSequence = [
      'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    ]
    const nextStatus = computed(() => {
      const index = orderStatusSequence.indexOf(order.value?.status)
      return orderStatusSequence[index+1]
    })
    const prevStatus = computed(() => {
      const index = orderStatusSequence.indexOf(order.value?.status)
      return orderStatusSequence[index-1]
    })

    function updateStatus(opts={ status: '', errorMessage: '', cancelReason: '' }) {
      const data = { status: opts?.status, cancel_reason: opts?.cancelReason || undefined }
      return backend.post(`connecta/orders/${order.value.id}/update_status/`, data)
        .then(response => {
          order.value.raw = response?.data
        })
        .catch(error => {
          $q.notify({
            type: 'negative',
            message: opts?.errorMessage || 'Unable to update status',
            caption: error?.response?.data?.detail ||
                    errorParser.firstElementOrValue(error?.response?.data),
          })
        })
    }

    function confirmCancelOrder() {
      $q.dialog({
        title: 'Cancel order',
        message: 'Cancel order, are you sure?',
        ok: { color: 'brandblue', flat: true },
      }).onOk(() => cancelOrder())
    }

    function cancelOrder() {
      $q.dialog({
        component: CancelReasonFormDailog,
      }).onOk(cancelReason => {
        updateStatus({
          status: 'cancelled',
          errorMessage: 'Unable to cancel order',
          cancelReason: cancelReason,
        })
      })
    }

    const variantInfoDIalog = ref({ show: false, variant: Variant.parse() })
    function displayVariant(variant = Variant.parse()) {
      variantInfoDIalog.value.variant = variant
      variantInfoDIalog.value.show = true
    }

    async function refreshPage(done=() => {}) {
      try {
        await Promise.all([
          fetchOrder(),
        ])
      } finally {
        done()
      }
    }
    return {
      order,
      orderCurrency,
      orderBchPrice,
      orderAmounts,
      displayBch,
      toggleAmountsDisplay,
      nextStatus,
      prevStatus,

      updateStatus,
      confirmCancelOrder,

      variantInfoDIalog,
      displayVariant,

      refreshPage,

      // utils funcs
      formatOrderStatus, parseOrderStatusColor,
      formatTimestampToText,
    }
  },
})
</script>
