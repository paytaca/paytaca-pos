<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="row no-wrap items-start q-pb-sm">
        <div class="q-space row items-center q-gutter-x-xs">
          <div class="text-h5">Sale</div>
          <div class="text-grey">#{{ salesOrder?.id }}</div>
        </div>
        <slot name="menu" v-bind="{ salesOrder }"></slot>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div v-if="salesOrder?.number" class="q-pa-xs">
          <div>SO#{{ salesOrder?.number }}</div>
          <div class="text-caption bottom text-grey">Sales Order</div>
        </div>
        <div class="row items-center">
          <div v-if="salesOrder?.paymentMode" class="q-pa-xs q-space">
            <div>{{ salesOrder?.parsedPaymentMode || salesOrder?.paymentMode }}</div>
            <div class="text-caption bottom text-grey">Payment mode</div>
          </div>
          <template v-if="salesOrder?.paymentMode == 'bch'">
            <div v-if="salesOrder?.bchRecipientAddress" class="q-pa-xs q-space">
              <div class="ellipsis" style="max-width:10em">{{ salesOrder?.bchRecipientAddress }}</div>
              <div class="text-caption bottom text-grey">Recipient Address</div>
              <q-menu class="q-pa-sm">
                <div class="row items-center">
                  <div class="text-subtitle2 q-space">Recipient Address</div>
                  <div class="row items-center">
                    <q-btn
                      flat
                      icon="content_copy"
                      padding="xs"
                      @click="() => copyToClipboard(salesOrder?.bchRecipientAddress, 'Recipient address copied')"
                    />
                  </div>
                </div>
                <div style="word-break: break-all;">{{ salesOrder?.bchRecipientAddress }}</div>
              </q-menu>
            </div>
            <div v-if="salesOrder?.bchTxid" class="q-pa-xs q-space">
              <div class="ellipsis" style="max-width:10em">{{ salesOrder?.bchTxid }}</div>
              <div class="text-caption bottom text-grey">Transaction</div>
              <q-menu class="q-pa-sm">
                <div class="row items-center">
                  <div class="text-subtitle2 q-space">Transaction</div>
                  <div class="row items-center q-gutter-sm">
                    <q-btn
                      flat
                      icon="content_copy"
                      padding="xs"
                      @click="() => copyToClipboard(salesOrder?.bchTxid, 'Transaction copied')"
                      class="q-mr-sm"
                    />

                    <q-btn
                      flat
                      :disable="Boolean(!salesOrder.bchTxidLink)"
                      icon="open_in_new"
                      padding="xs"
                      target="_blank"
                      :href="salesOrder.bchTxidLink"
                    />
                  </div>
                </div>
                <div style="word-break: break-all;">
                  {{ salesOrder?.bchTxid }}
                </div>
              </q-menu>
            </div>
          </template>
        </div>
        <div class="row items-center">
          <div v-if="!isNaN(salesOrder.createdAt)" class="q-pa-xs q-space">
            <div>{{ formatTimestampToText(salesOrder.createdAt) }}</div>
            <div class="text-caption bottom text-grey">Created at</div>
          </div>
          <div v-if="salesOrder?.createdBy?.id" class="q-pa-xs q-space">
            <div>{{ salesOrder?.createdBy?.firstName }} {{ salesOrder?.createdBy?.lastName }}</div>
            <div class="text-caption bottom text-grey">Created by</div>
          </div>
        </div>
        <div v-if="salesOrder?.$state?.updating" class="row items-center justify-center">
          <q-spinner size="3em"/>
        </div>
        <div v-if="salesOrder?.items?.length" class="text-subtitle1">Items</div>
        <table class="full-width">
          <tr v-for="item in salesOrder.items" :key="item?.variant?.id">
            <td class="text-weight-medium">
              <div class="row items-center no-wrap">
                <template v-if="item?.variant?.id">
                  <img
                    v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                    :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                    style="width:50px;"
                    class="rounded-borders q-mr-sm"
                  />
                  <div>
                    {{ item?.variant?.product?.name }}
                    <template v-if="item?.variant?.name">
                      - {{ item?.variant?.name }}
                    </template>
                  </div>
                </template>
                <template v-else>
                  {{ item?.itemName }}
                </template>
              </div>
            </td>
            <td>
              {{ item?.price }} {{ salesOrder?.currency?.symbol }}
            </td>
            <td>
              <div class="row no-wrap items-center">
                <span>x{{ item.quantity }}</span>
              </div>
            </td>
          </tr>
        </table>
        <div class="text-subtitle1 row items-start q-pr-md">
          <div class="text-grey q-space">Total</div>
          <div>
            <div v-if="salesOrder?.paymentMode == 'bch' && salesOrder?.bchTotal" class="text-right">
              <div class="row items-center">
                <div>{{ salesOrder?.bchTotal }} BCH</div>
                <q-icon v-if="salesOrder?.bchPrice?.timestamp" name="info" size="1em">
                  <q-menu class="q-pa-sm">
                    BCH price at {{ formatTimestampToText(salesOrder?.bchPrice?.timestamp) }}
                  </q-menu>
                </q-icon>
              </div>
              <div class="text-grey text-caption bottom">
                {{ salesOrder?.total }} {{ salesOrder?.currency?.symbol }}
              </div>
            </div>
            <template v-else>
              {{ salesOrder?.total }} {{ salesOrder?.currency?.symbol }}
            </template>
          </div>
        </div>
      </q-card-section>
      <!-- {{ salesOrder }} -->
    </q-card>
  </q-dialog>
</template>
<script>
import { SalesOrder } from 'src/marketplace/objects'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import { formatTimestampToText } from 'src/marketplace/utils'

export default defineComponent({
  name: 'SalesOrderDetailDialog',

  emits: [
    'update:model-value',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    modelValue: Boolean,
    salesOrder: SalesOrder,
  },
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

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

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      copyToClipboard,

      // utils funcs
      formatTimestampToText,
    }
  },
})
</script>
