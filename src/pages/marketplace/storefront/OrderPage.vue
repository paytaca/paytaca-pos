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

      <div class="row items-start no-wrap">
        <div class="row items-center q-space">
          <div class="text-h5 q-space">Order #{{ order?.id }}</div>
          <div v-if="order?.id" style="margin-left:-4px;">
            <q-chip
              v-if="!order?.isCancelled"
              :color="parsePaymentStatusColor(order?.paymentStatus)"
              class="text-weight-medium text-white"
              clickable
              @click="() => showPaymentsDialog = true"
            >
              {{ formatOrderStatus(order?.paymentStatus) }}
            </q-chip>
            <q-chip :color="parseOrderStatusColor(order?.status)" class="text-weight-medium text-white">
              {{ formatOrderStatus(order?.status) }}
            </q-chip>
          </div>
        </div>
        <div>
          <q-btn flat icon="more_vert" padding="xs" class="q-r-mr-md">
            <q-menu>
              <q-item
                v-if="payments?.length"
                v-close-popup clickable
                @click="() => showPaymentsDialog = true"
              >
                <q-item-section>
                  <q-item-label>
                    View Payments
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                v-if="order?.totalPayable > 0"
                v-close-popup clickable
                @click="() => createPayment()"
              >
                <q-item-section>
                  <q-item-label>
                    Create Payment
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-separator class="menu-separator"/>
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
                v-if="!order?.isCancelled"
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
      </div>
      <div v-if="order?.createdAt" class="text-caption text-grey col-12">
        {{ formatTimestampToText(order?.createdAt) }}
      </div>
      <div class="q-mb-md"></div>

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
          <div class="column items-end float-right q-r-mt-sm">
            <div>
              <q-btn
                flat
                padding="none"
                no-caps
                label="Open Map"
                class="q-mt-sm text-underline"
                @click="() => showMap = true"
              />
            </div>
            <div class="q-mt-xs">
              <q-btn
                v-if="order?.editable"
                flat
                icon="edit"
                padding="xs"
                @click="() => openUpdateDeliveryAddressDialog = true"
              />
            </div>
          </div>
          <LeafletMapDialog v-model="showMap" :locations="mapLocations"/>
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
        <template v-if="delivery?.id">
          <q-separator/>
          <q-card-section class="q-pt-sm">
            <q-btn v-if="!delivery?.activeRiderId && !delivery?.completedAt && !order?.isCancelled" flat icon="more_vert" padding="xs" class="float-right">
              <q-menu>
                <q-list separator>
                  <q-item
                    v-if="!delivery?.activeRiderId && !delivery?.completedAt"
                    clickable v-close-popup
                    @click="() => searchRiderForDelivery()"
                  >
                    <q-item-section>Search for rider</q-item-section>
                  </q-item>
                  <q-item
                    v-if="!delivery?.activeRiderId && delivery?.rider?.id"
                    clickable v-close-popup
                    @click="() => assignRider({id: null})"
                  >
                    <q-item-section>Unassign rider</q-item-section>
                  </q-item>
                  <q-item
                    clickable v-close-popup
                    @click="() => setDeliveryPublicity(!delivery.isPublic)"
                  >
                    <q-item-section>
                      <q-item-label>Set {{ delivery?.isPublic ? 'Private' : 'Public' }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
            <div class="float-right q-my-xs">
              <q-icon v-if="delivery?.activeRiderId" name="check_circle" size="1.5em" color="green">
                <q-menu class="q-pa-sm">
                  Rider has accepted delivery
                  <span v-if="delivery?.acceptedAt">({{  formatDateRelative(delivery?.acceptedAt) }})</span>
                </q-menu>
              </q-icon>
              <q-icon
                v-if="delivery?.pickedUpAt || delivery?.deliveredAt"
                name="delivery_dining"
                size="2em"
                :color="delivery?.deliveredAt ? 'green' : 'amber'"
                class="q-mx-sm"
              >
                <q-menu class="q-pa-sm">
                  <div v-if="delivery.pickedUpAt">
                    Picked up {{ formatDateRelative(delivery.pickedUpAt) }}
                  </div>
                  <div v-if="delivery.deliveredAt">
                    Delivered {{ formatDateRelative(delivery.deliveredAt) }}
                  </div>
                </q-menu>
              </q-icon>
            </div>
            <div class="text-subtitle1">Delivery status</div>
            <div class="text-caption bottom">
              Delivery #{{ delivery?.id }}
              <template v-if="delivery.isPublic === false">
                <span class="text-grey text-underline">(Private)</span>
                <q-menu class="q-pa-sm">
                  Delivery will not be visible to riders when searching deliveries.
                  Assign a rider or set to public.
                </q-menu>
              </template>
            </div>
            <div v-if="delivery?.rider?.id" class="q-mt-xs">
              <div class="text-subtitle2">Rider</div>
              <div class="row items-start q-gutter-x-xs">
                <div>{{ delivery?.rider?.firstName }} {{ delivery?.rider?.lastName }}</div>
                <div>{{ delivery?.rider?.phoneNumber }}</div>
              </div>
            </div>
            <div v-else class="text-grey">No rider yet</div>
          </q-card-section>
        </template>
        <template v-else>
          <q-card-section v-if="order?.id && !order?.isCancelled" class="q-pt-sm">
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
            <q-btn
              v-if="order?.editable"
              flat
              icon="edit"
              padding="xs"
              @click="() => openUpdateItemsDialog = true"
            />
          </div>
        </q-card-section>
        <q-markup-table dense>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
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
              <td class="text-center" style="white-space:nowrap;">{{ orderItem?.price }} {{ orderCurrency }}</td>
              <td class="text-center" style="white-space:nowrap;">{{ orderItem?.price * orderItem?.quantity }} {{ orderCurrency }}</td>
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
          <div class="q-space">Markup</div>
          <div v-if="displayBch">{{ orderAmounts.markupAmount.bch }} BCH</div>
          <div v-else>{{ orderAmounts.markupAmount.currency }} {{ orderCurrency }}</div>
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
        <template v-if="orderAmounts.totalPaid.currency || orderAmounts.totalPendingPayment.currency">
          <q-separator/>
          <div class="row items-start text-body1">
            <div class="q-space">Total Paid</div>
            <div v-if="displayBch">{{ orderAmounts.totalPaid.bch || 0 }} BCH</div>
            <div v-else>{{ orderAmounts.totalPaid.currency || 0 }} {{ orderCurrency }}</div>
          </div>
          <div
            v-if="orderAmounts.totalPendingPayment.currency"
            class="row items-start text-grey"
            @click.stop
          >
            <div class="q-space">Pending amount</div>
            <div v-if="displayBch">{{ orderAmounts.totalPendingPayment.bch }} BCH</div>
            <div v-else>{{ orderAmounts.totalPendingPayment.currency }} {{ orderCurrency }}</div>
            <q-menu class="q-pa-md">Amount sent by customer but not yet received</q-menu>
          </div>

          <template v-if="orderAmounts.totalRefunded.currency">
            <div class="row items-start text-grey">
              <div class="q-space">Total refunded</div>
              <div v-if="displayBch">{{ orderAmounts.totalRefunded.bch }} BCH</div>
              <div v-else>{{ orderAmounts.totalRefunded.currency }} {{ orderCurrency }}</div>
            </div>
            <div class="row items-start">
              <div class="q-space">Net paid</div>
              <div v-if="displayBch">{{ orderAmounts.netPaid.bch }} BCH</div>
              <div v-else>{{ orderAmounts.netPaid.currency }} {{ orderCurrency }}</div>
            </div>
          </template>
        </template>
      </div>
    </q-pull-to-refresh>
    <OrderPaymentsDialog ref="paymentsDialog" v-model="showPaymentsDialog" :payments="payments" @updated="() => fetchOrder()">
      <template v-slot:before>
        <div class="row items-center justify-end">
          <q-btn
            flat
            no-caps label="Add payment"
            v-close-popup
            @click="() => createPayment()"
          />
        </div>
      </template>
    </OrderPaymentsDialog>
    <VariantInfoDialog v-model="variantInfoDIalog.show" :variant="variantInfoDIalog.variant"/>
    <UpdateOrderDeliveryAddressFormDialog
      v-model="openUpdateDeliveryAddressDialog"
      :order="order"
      @updated="onUpdateOrderData"
    />
    <UpdateOrderItemsFormDialog
      v-model="openUpdateItemsDialog"
      :order="order"
      @updated-items="onUpdateOrderData"
    />
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { marketplaceRpc } from 'src/marketplace/rpc'
import { Delivery, Order, Payment, Rider, Storefront, Variant } from 'src/marketplace/objects'
import { errorParser, formatOrderStatus, parseOrderStatusColor, parsePaymentStatusColor, formatTimestampToText, formatDateRelative } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useNotificationsStore } from 'src/stores/notifications'
import { useQuasar } from 'quasar'
import { computed, defineComponent, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'
import CancelReasonFormDailog from 'src/components/marketplace/storefront/CancelReasonFormDailog.vue'
import SearchDeliveryRiderDialog from 'src/components/marketplace/storefront/SearchDeliveryRiderDialog.vue'
import LeafletMapDialog from 'src/components/marketplace/LeafletMapDialog.vue'
import OrderPaymentsDialog from 'src/components/marketplace/storefront/OrderPaymentsDialog.vue'
import UpdateOrderItemsFormDialog from 'src/components/marketplace/storefront/UpdateOrderItemsFormDialog.vue'
import UpdateOrderDeliveryAddressFormDialog from 'src/components/marketplace/storefront/UpdateOrderDeliveryAddressFormDialog.vue'

export default defineComponent({
  name: 'OrderPage',
  components: {
    MarketplaceHeader,
    VariantInfoDialog,
    LeafletMapDialog,
    OrderPaymentsDialog,
    UpdateOrderItemsFormDialog,
    UpdateOrderDeliveryAddressFormDialog,
  },
  props: {
    orderId: [String, Number]
  },
  setup(props) {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()
    const notificationsStore = useNotificationsStore()
    onMounted(() => refreshPage())
    const order = ref(Order.parse())
    const storefrontId = computed(() => order.value?.storefrontId)
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
        markupAmount: { currency: order.value?.markupAmount || 0, bch: 0 },
        deliveryFee: { currency: order.value?.payment?.deliveryFee || 0, bch: 0 },
        total: { currency: order.value.total, bch: 0 },
        totalPaid: { currency: parseFloat(order.value?.totalPaid), bch: 0 },
        totalPendingPayment: { currency: parseFloat(order.value?.totalPendingPayment), bch: 0 },
        totalRefunded: { currency: parseFloat(order.value?.totalRefunded), bch: 0 },
        netPaid: { currency: parseFloat(order.value?.netPaid), bch: 0 },
      }

      if(!isNaN(orderBchPrice.value)) {
        data.subtotal.bch = parseBch(data.subtotal.currency / orderBchPrice.value)
        data.markupAmount.bch = parseBch(data.markupAmount.currency / orderBchPrice.value)
        data.deliveryFee.bch = parseBch(data.deliveryFee.currency / orderBchPrice.value)
        data.total.bch = parseBch(data.total.currency / orderBchPrice.value)
        data.totalPaid.bch = parseBch(data.totalPaid.currency / orderBchPrice.value)
        data.totalPendingPayment.bch = parseBch(data.totalPendingPayment.currency / orderBchPrice.value)
        data.totalRefunded.bch = parseBch(data.totalRefunded.currency / orderBchPrice.value)
        data.netPaid.bch = parseBch(data.netPaid.currency / orderBchPrice.value)
      } else {
        data.subtotal.bch = null
        data.markupAmount.bch = null
        data.deliveryFee.bch = null
        data.total.bch = null
        data.totalPaid.bch = null
        data.totalPendingPayment.bch = null
        data.totalRefunded.bch = null
        data.netPaid.bch = null
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

    const storefront = ref(Storefront.parse())
    watch(storefrontId, () => fetchStorefront())
    function fetchStorefront() {
      if (!storefrontId.value) return Promise.reject()
      if (storefrontId.value == marketplaceStore.storefront?.id) {
        storefront.value = marketplaceStore.storefront
        return Promise.resolve()
      }
      return backend.get(`connecta/storefronts/${storefrontId.value}/`)
        .then(response => {
          storefront.value = Storefront.parse(response?.data)
          return response
        })
    }

    const openUpdateDeliveryAddressDialog = ref(false)
    const openUpdateItemsDialog = ref(false)
    function onUpdateOrderData(orderData) {
      order.value.raw = orderData
      openUpdateItemsDialog.value = false
      openUpdateDeliveryAddressDialog.value = false
    }

    const orderStatusSequence = [
      'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    ]
    const nextStatus = computed(() => {
      const index = orderStatusSequence.indexOf(order.value?.status)
      if (index < 0) return
      return orderStatusSequence[index+1]
    })
    const prevStatus = computed(() => {
      const index = orderStatusSequence.indexOf(order.value?.status)
      if (index < 0) return
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
      if (!riderId && riderId !== null) return Promise.reject('Invalid rider ID')
      const data = { rider_id: riderId }

      const dialog = $q.dialog({
        title: 'Delivery request',
        message: riderId ? 'Assigning rider' : 'Unassigning rider',
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
          const defaultError = riderId ? 'Unable to assign rider' : 'Unable to unassign rider'
          const errorMessage = error?.response?.data?.detail ||
              errorParser.firstElementOrValue(error?.response?.data?.non_field_errors)
          dialog.update({ message: errorMessage || defaultError })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue' }})
        })
    }

    function setDeliveryPublicity(isPublic=false) {
      const data = { is_public: isPublic }
      const dialog = $q.dialog({
        title: 'Updating delivery',
        message: 'Updating delivery',
        progress: true, persistent: true,
        ok: false,
      })
      return backend.patch(`connecta-express/deliveries/${delivery.value?.id}/`, data)
        .then(response => {
          delivery.value = Delivery.parse(response?.data)
          dialog.hide()
          return response
        })
        .catch(error => {
          const errorMessage = error?.response?.data?.detail ||
              errorParser.firstElementOrValue(error?.response?.data?.non_field_errors) ||
              errorParser.firstElementOrValue(error?.response?.data?.is_public)
          dialog.update({ message: errorMessage || defaultError })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue' }})
        })
    }

    const trackRiderInterval = ref(null)
    function stopTrackRider () {
      clearInterval(trackRiderInterval.value)
      trackRiderInterval.value = null
    }
    function trackRider() {
      stopTrackRider()
      updateRiderLocation()
      trackRiderInterval.value = setInterval(() => updateRiderLocation(), 5 * 1000)
    }
    async function updateRiderLocation() {
      const riderId = delivery.value?.rider?.id
      const activeRiderId = delivery.value?.activeRiderId
      if (activeRiderId != riderId) return
      if (!riderId) return
      const params = { ids: riderId }
      const response = await backend.get(`connecta-express/riders/get_locations/`, { params })
      const currentLocation = response?.data?.results?.[0]?.coordinates
      if (isNaN(currentLocation?.[0]) || isNaN(currentLocation?.[1])) return
      delivery.value.rider.currentLocation = [currentLocation[1], currentLocation[0]]
      delivery.value.rider.currentLocationTimestamp = Date.now()
    }
    onUnmounted(() => stopTrackRider())

    const showMap = ref(false)
    watch(showMap, () => showMap.value ? trackRider() : stopTrackRider())
    const mapLocations = computed(() => {
      const data = []
      if (storefront.value?.location?.validCoordinates) {
        data.push({
          popup: ['Pickup location', storefront.value?.location?.formatted].filter(Boolean).join(': '),
          lat: storefront.value?.location?.latitude,
          lon: storefront.value?.location?.longitude,
          icon: { prefix: '', glyph: 'Store' },
        })
      }

      const deliveryLoc = delivery.value?.deliveryLocation?.validCoordinates
        ? delivery.value?.deliveryLocation
        : order.value.deliveryAddress?.location

      if (deliveryLoc?.validCoordinates) {
        data.push({
          lat: deliveryLoc?.latitude,
          lon: deliveryLoc?.longitude,
          popup: ['Delivery address', deliveryLoc?.formatted].filter(Boolean).join(': '),
          icon: { prefix: '', glyph: 'Delivery' },
        })
      }

      const rider = delivery.value?.rider
      const riderLoc = rider?.currentLocation
      const riderLocTimestamp = rider?.currentLocationTimestamp
      if (!isNaN(riderLoc?.[0]) && !isNaN(riderLoc?.[1])) {
        let timestampText = ''
        if (!isNaN(riderLocTimestamp)) timestampText = `<br/>${formatDateRelative(riderLocTimestamp)}`
        const riderName = [rider?.firstName, rider?.lastName].filter(Boolean).join(' ')
        data.push({
          popup: [`Rider`, riderName].filter(Boolean).join(': ') + timestampText,
          lat: riderLoc[0],
          lon: riderLoc[1],
          icon: { prefix: '', glyph: 'Rider' },
        })
      }

      return data
    })

    const paymentsDialog = ref()
    const showPaymentsDialog = ref(false)
    const payments = ref([].map(Payment.parse))
    const payment = computed(() => {
      return payments.value.find(payment => {
        return payment.status == 'pending' && payment.totalAmount == order.value.totalPayable
      })
    })
    const fetchingPayments = ref(false)
    function fetchPayments() {
      const params = {
        order_id: props?.orderId || null,
      }
      fetchingPayments.value = true
      return backend.get(`connecta/payments/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          payments.value = response?.data?.results?.map?.(Payment.parse)
          return response
        })
        .finally(() => {
          fetchingPayments.value = false
        })
    }

    function createPayment() {
      const orderId = order.value.id
      const data = { order_id: orderId }
      const dialog = $q.dialog({
        title: 'Payment',
        message: 'Creating payment request',
        progress: true,
        persistent: true,
        ok: false,
      })

      return backend.post(`connecta/orders/${orderId}/payment/`, data)
        .then(async (response) => {
          const payment = Payment.parse(response?.data)
          const index = payments.value.findIndex(_payment => _payment?.id == payment?.id)
          if (index >= 0) payments.value[index] = payment
          else payments.value.unshift(payment)
          await Promise.allSettled([
            fetchOrder(),
            fetchPayments(),
            payment.fetchEscrowContract(),
          ])
          dialog.hide()
          showPaymentsDialog.value = true
          paymentsDialog.value?.displayPaymentEscrowContract?.(payment)
          return response
        })
        .catch(error => {
          const errorMessage = error?.response?.data?.detail ||
              errorParser.firstElementOrValue(error?.response?.data?.non_field_errors) ||
              errorParser.firstElementOrValue(error?.response?.data?.order_id) ||
              errorParser.firstElementOrValue(error?.response?.data)
          dialog.update({
            title: 'Error',
            message: errorMessage || 'Unable to create payment request',
          })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue' }})
        })
    }

    function onNewPayment() {
      fetchOrder()
      fetchPayments()
      showPaymentsDialog.value = true
    }

    const variantInfoDIalog = ref({ show: false, variant: Variant.parse() })
    function displayVariant(variant = Variant.parse()) {
      variantInfoDIalog.value.variant = variant
      variantInfoDIalog.value.show = true
    }

    const orderUpdateEventName = 'order_updates'
    const onNotificationHandler = notification  => {
      if (notification?.event != orderUpdateEventName) return
      if (notification?.data?.id != props.orderId) return
      fetchOrder()
    }
   
    watch(() => [props.orderId], () => {
      unsubscribeUpdatesToRpc().finally(() => subscribeUpdatesToRpc())
    })
    onMounted(() => subscribeUpdatesToRpc())
    onUnmounted(() => unsubscribeUpdatesToRpc())
    onActivated(() => subscribeUpdatesToRpc())
    onDeactivated(() => unsubscribeUpdatesToRpc())
    async function subscribeUpdatesToRpc() {
      if (!marketplaceRpc.isConnected()) await marketplaceRpc.connect()
      marketplaceRpc.client.call('subscribe', [orderUpdateEventName, { id: parseInt(props.orderId) }])

      if (!marketplaceRpc.client.onNotification.includes(onNotificationHandler)) {
        marketplaceRpc.client.onNotification.push(onNotificationHandler)
      }
    }

    async function unsubscribeUpdatesToRpc() {
      if (!marketplaceRpc.isConnected()) return
      marketplaceRpc.client.call('unsubscribe', [orderUpdateEventName])
      marketplaceRpc.client.onNotification = marketplaceRpc.client.onNotification
        .filter(handler => handler !== onNotificationHandler)
    }

    async function refreshPage(done=() => {}) {
      try {
        await Promise.all([
          fetchOrder(),
          fetchDelivery(),
          fetchPayments(),
        ])
      } finally {
        done()
      }
    }

    onMounted(() => handleOpenedNotification())
    function handleOpenedNotification() {
      const openedNotification = notificationsStore.openedNotification
      const notificationTypes = notificationsStore.types
      const openContractTypes = [
        notificationTypes.MARKETPLACE_ORDER_CREATE,
        notificationTypes.MARKETPLACE_ORDER_STATUS_UPDATE,
      ]

      if (openContractTypes.includes(openedNotification?.data?.type)) {
        const orderId = openedNotification?.data?.order_id
        if (parseInt(props.orderId) == parseInt(orderId)) {
          notificationsStore.clearOpenedNotification()
        }
      }
    }

    return {
      order,
      fetchOrder,
      orderCurrency,
      orderBchPrice,
      orderAmounts,
      displayBch,
      toggleAmountsDisplay,
      storefront,

      openUpdateDeliveryAddressDialog,
      openUpdateItemsDialog,
      onUpdateOrderData,

      nextStatus,
      prevStatus,

      updateStatus,
      confirmCancelOrder,

      delivery,
      fetchingDelivery,
      createDeliveryRequest,
      searchRiderForDelivery,
      assignRider,
      setDeliveryPublicity,

      showMap,
      mapLocations,

      paymentsDialog,
      showPaymentsDialog,
      payments,
      payment,
      fetchingPayments,
      fetchPayments,
      createPayment,
      onNewPayment,

      variantInfoDIalog,
      displayVariant,

      refreshPage,

      // utils funcs
      formatOrderStatus, parseOrderStatusColor,
      parsePaymentStatusColor,
      formatTimestampToText,
      formatDateRelative,
    }
  },
})
</script>
<style lang="scss" scoped>
.menu-separator:first-child, .menu-separator:last-child {
  display: none;
}
</style>