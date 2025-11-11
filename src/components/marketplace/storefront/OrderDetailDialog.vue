<template>
  <q-dialog v-model="innerVal" ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card>
      <q-card-section>
        <div class="row no-wrap items-center justify-center">
          <div class="text-h6">{{ $t('Order') }} #{{ order?.id }}</div>
          <q-chip :color="order?.statusColor" class="text-weight-medium text-white">
            {{ order?.formattedStatus }}
          </q-chip>
          <q-space/>
          <q-btn
            flat
            padding="sm"
            icon="close"
            v-close-popup
          />
        </div>
        <div v-if="order?.createdAt" class="text-grey text-caption bottom">
          {{ formatTimestampToText(order?.createdAt) }}
        </div>
        <div v-if="order?.customer?.fullName" class="q-mb-sm">
          <div class="text-subtitle1">{{ $t('Customer') }}</div>
          <div>{{ order?.customer?.fullName }}</div>
          <div>{{ order?.customer?.phoneNumber }}</div>
        </div>
        <div v-if="order?.deliveryAddress" class="q-mb-sm">
          <div class="text-subtitle1">{{ $t('Delivery') }}</div>
          <div v-if="order?.deliveryAddress?.fullName !== order?.customer?.fullName">
            {{ order?.deliveryAddress?.fullName }}
          </div>
          <div v-if="order?.deliveryAddress?.phoneNumber !== order?.customer?.phoneNumber">
            {{ order?.deliveryAddress?.phoneNumber }}
          </div>
          <div>{{ order?.deliveryAddress?.location?.formatted }}</div>
        </div>
        <table class="items-table full-width q-mt-md">
          <thead>
            <tr>
              <th colspan="2">{{ $t('Item') }}</th>
              <th>{{ $t('Price')}} </th>
              <th>{{ $t('Qty') }}</th>
              <th>{{ $t('Subtotal') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="orderItem in order?.items" :key="orderItem?.id">
              <tr>
                <td colspan="2" class="text-weight-medium order-item-cell">
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
                <td class="text-center" style="white-space:nowrap;">{{ formatNumberAutoDecimals(orderItem?.price) }} {{ orderCurrency }}</td>
                <td class="text-center" style="white-space:nowrap;">{{ orderItem?.quantity }}</td>
                <td class="text-center" style="white-space:nowrap;">{{ formatNumberAutoDecimals(orderItem?.price * orderItem?.quantity) }} {{ orderCurrency }}</td>
              </tr>
              <tr v-for="(addon, index) in orderItem.addons" :key="`${orderItem?.id}-${index}`">
                <td></td>
                <td>
                  <div>{{ addon?.label }}</div>
                  <div v-if="addon?.inputValue" class="text-caption bottom">{{ addon?.inputValue }}</div>
                </td>
                <td class="text-center" style="white-space:nowrap;">{{ formatNumberAutoDecimals(addon?.price) }} {{ orderCurrency }}</td>
                <td class="text-center" style="white-space:nowrap;">{{ addon?.quantity }}</td>
                <td class="text-center" style="white-space:nowrap;">{{ formatNumberWithDecimals(round(addon?.price * orderItem?.quantity, 3), 3) }} {{ orderCurrency }}</td>
              </tr>
            </template>
          </tbody>
        </table>
        <q-separator spaced/>
        <div class="row items-start">
          <div>{{ $t('Subtotal') }}</div>
          <q-space/>
          <div>{{ formatNumberAutoDecimals(order?.subtotal) }} {{ orderCurrency }}</div>
        </div>

        <div class="row items-start">
          <div>{{ $t('Markup') }}</div>
          <q-space/>
          <div>{{ formatNumberAutoDecimals(order?.markupAmount) }} {{ orderCurrency }}</div>
        </div>

        <div class="row items-start">
          <div>{{ $t('DeliveryFee', {}, 'Delivery fee') }}</div>
          <q-space/>
          <div>{{ formatNumberAutoDecimals(order?.payment?.deliveryFee) }} {{ orderCurrency }}</div>
        </div>
        <div class="row items-start">
          <div class="text-subtitle1">{{ $t('Total') }}</div>
          <q-space/>
          <div>{{ formatNumberAutoDecimals(order?.total) }} {{ orderCurrency }}</div>
        </div>
        <q-btn
          no-caps label="Go to page"
          color="brandblue"
          class="full-width q-mt-md"
          :to="{ name: 'marketplace-storefront-order', params: { orderId: order?.id }}"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { Order } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, ref, watch } from 'vue'
import { formatTimestampToText, round } from 'src/marketplace/utils'
import { formatNumberAutoDecimals, formatNumberWithDecimals } from 'src/utils/number-format'

export default defineComponent({
  name: 'OrderDetailDialog',
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    order: Order,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    const orderCurrency = computed(() => props.order?.currency?.symbol)

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      orderCurrency,

      round,
      formatTimestampToText,
      formatNumberAutoDecimals,
      formatNumberWithDecimals,
    }
  },
})
</script>
<style scoped lang="scss">
table.items-table {
  border-spacing: (map-get($space-md, 'x') / 2) 0;
}
table.items-table tr td:last-child {
  text-align: end;
}
table.items-table tr td.order-item-cell:first-child {
 width: 100%;
}
</style>
