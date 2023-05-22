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
          <div @click="() => displayDeliveryAddressLocation()">
            <div>{{ order?.deliveryAddress?.location?.formatted }}</div>
            <q-btn
              v-if="order?.deliveryAddress?.location?.validCoordinates"
              flat
              padding="none"
              no-caps
              label="View location"
              class="text-underline"
            />
          </div>
        </q-card-section>
        <template v-if="delivery?.id">
          <q-separator/>
          <q-card-section class="q-pt-sm">
            <q-btn flat icon="more_vert" padding="xs" class="float-right">
              <q-menu>
                <q-list separator>
                  <q-item
                    v-if="!delivery?.activeRiderId"
                    clickable v-close-popup
                    @click="() => searchRiderForDelivery()"
                  >
                    <q-item-section>Search for rider</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <div class="text-subtitle1">Delivery status</div>
            <div class="text-caption bottom">Delivery #{{ delivery?.id }}</div>
            <div v-if="delivery?.rider?.id" class="q-mt-xs">
              <div class="text-subtitle2">
                Rider
                <q-icon v-if="delivery?.activeRiderId" name="check_circle" size="1.25em" color="green">
                  <q-menu class="q-pa-sm">Rider has accepted delivery</q-menu>
                </q-icon>
              </div>
              <div class="row items-start q-gutter-x-xs">
                <div>{{ delivery?.rider?.firstName }} {{ delivery?.rider?.lastName }}</div>
                <div>{{ delivery?.rider?.phoneNumber }}</div>
              </div>
            </div>
            <div v-else class="text-grey">No rider yet</div>
          </q-card-section>
        </template>
        <template v-else>
          <q-card-section class="q-pt-sm">
            <q-btn
              no-caps
              label="Create delivery request"
              color="brandblue"
              class="full-width"
              @click="() => createDeliveryRequest()"
            />
          </q-card-section>
        </template>
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
import { Delivery, Order, Rider, Variant } from 'src/marketplace/objects'
import { errorParser, formatOrderStatus, parseOrderStatusColor, formatTimestampToText } from 'src/marketplace/utils'
import { useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import PinLocationDialog from 'src/components/marketplace/PinLocationDialog.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'
import CancelReasonFormDailog from 'src/components/marketplace/storefront/CancelReasonFormDailog.vue'
import SearchDeliveryRiderDialog from 'src/components/marketplace/storefront/SearchDeliveryRiderDialog.vue'

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

    function displayDeliveryAddressLocation() {
      if (!order.value?.deliveryAddress?.location?.validCoordinates) return
      $q.dialog({
        component: PinLocationDialog,
        componentProps: {
          static: true,
          initLocation: {
            latitude: parseFloat(order.value?.deliveryAddress?.location?.latitude),
            longitude: parseFloat(order.value?.deliveryAddress?.location?.longitude),
          }
        }
      })
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

    const delivery = ref(Delivery.parse())
    const fetchingDelivery = ref(false)
    function fetchDelivery() {
      if (!props.orderId) return Promise.reject()
      const params = { order_id: props.orderId }

      fetchingDelivery.value = true
      return backend.get(`connecta-express/deliveries/`, { params })
        .then(response => {
          const data = response?.data?.results?.[0]
          delivery.value = Delivery.parse(data)
          return response
        })
        .finally(() => {
          fetchingDelivery.value = false
        })
    }

    function createDeliveryRequest() {
      const data = { order_id: order.value.id }
      const dialog = $q.dialog({
        title: 'Delivery request',
        message: 'Creating delivery request',
        progress: true,
        persistent: true,
        ok: false,
      })

      return backend.post(`connecta-express/deliveries/`, data)
        .then(response => {
          delivery.value = Delivery.parse(response?.data)
          dialog.hide()
          return response
        })
        .catch(error => {
          const errorMessage = error?.response?.data?.detail ||
              errorParser.firstElementOrValue(error?.response?.data?.non_field_errors) ||
              errorParser.firstElementOrValue(error?.response?.data?.order_id)
          dialog.update({ message: errorMessage || 'Unable to create delivery request' })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue' }})
        })
    }

    function searchRiderForDelivery() {
      $q.dialog({
        component: SearchDeliveryRiderDialog,
        componentProps: { delivery: delivery.value }
      }).onOk(assignRider)
    }
    function assignRider(rider=Rider.parse()) {
      const riderId = rider?.id
      if (!riderId) return Promise.reject('Invalid rider ID')
      const data = { rider_id: riderId }

      const dialog = $q.dialog({
        title: 'Delivery request',
        message: 'Assigning rider',
        progress: true, persistent: true,
        ok: false,
      })
      return backend.post(`connecta-express/deliveries/${delivery.value?.id}/assign_rider/`, data)
        .then(response => {
          delivery.value = Delivery.parse(response?.data)
          dialog.hide()
          return response
        })
        .catch(error => {
          const errorMessage = error?.response?.data?.detail ||
              errorParser.firstElementOrValue(error?.response?.data?.non_field_errors)
          dialog.update({ message: errorMessage || 'Unable to assign rider' })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue' }})
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
          fetchDelivery(),
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
      displayDeliveryAddressLocation,
      nextStatus,
      prevStatus,

      updateStatus,
      confirmCancelOrder,

      delivery,
      fetchingDelivery,
      createDeliveryRequest,
      searchRiderForDelivery,

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
