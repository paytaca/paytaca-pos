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
        <q-chip :color="parseOrderStatusColor(order?.status)" class="text-weight-medium">
          {{ formatOrderStatus(order?.status) }}
        </q-chip>
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
import { formatOrderStatus, parseOrderStatusColor } from 'src/marketplace/utils'
import { computed, defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'

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
        subtotal: { currency: order.value?.subtotal, bch: 0 },
        deliveryFee: { currency: order.value?.payment?.deliveryFee, bch: 0 },
        total: { currency: 0, bch: 0 },
      }
      data.total.currency = Number(data.subtotal.currency) + Number(data.deliveryFee.currency)

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

      variantInfoDIalog,
      displayVariant,

      refreshPage,

      // utils funcs
      formatOrderStatus, parseOrderStatusColor,
    }
  },
})
</script>
