<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="width: max(90vw, 500px)">
      <q-card-section class="q-pb-sm">
        <div class="row no-wrap items-center">
          <div class="row items-center q-gutter-x-xs">
            <div class="text-h5">
              <!-- <template v-if="salesOrder?.draft">Draft</template> -->
              {{ $t('Sale') }}
              <template v-if="salesOrder?.number">#{{ salesOrder?.number }}</template>
            </div>
          </div>
          <div v-if="salesOrder?.draft">
            <q-chip class="text-weight-medium" color="grey" dense>{{ $t('Draft') }}</q-chip>
          </div>
          <q-space/>
          <slot name="menu" v-bind="{ salesOrder }"></slot>
        </div>
        <div class="row items-center">
          <div v-if="salesOrder?.createdAt" class="text-caption bottom text-grey">
            {{ formatTimestampToText(salesOrder?.createdAt) }}
            <q-menu class="q-pa-sm">
              {{
                $t(
                  'CreatedAt',
                  { date: formatTimestampToText(salesOrder?.createdAt) },
                  `Created at ${formatTimestampToText(salesOrder?.createdAt)}`
                )
              }}
            </q-menu>
          </div>
          <q-space/>
          <div v-if="salesOrder?.createdBy?.id" class="text-caption bottom text-grey">
            {{ salesOrder?.createdBy?.fullName }}
            <q-menu class="q-pa-sm">
              {{
                $t(
                  'CreatedBy',
                  { name: salesOrder?.createdBy?.fullName },
                  `Created by ${salesOrder?.createdBy?.fullName}`
                )
              }}
            </q-menu>
          </div>
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div class="row items-center q-r-mx-xs">
          <div v-if="salesOrder?.parsedStatus" class="q-pa-xs q-space">
            <div>{{ salesOrder?.parsedStatus }}</div>
            <div class="text-caption bottom text-grey">{{ $t('Status') }}</div>
          </div>
          <div v-if="salesOrder?.paymentMode" class="q-pa-xs q-space">
            <div>{{ salesOrder?.parsedPaymentMode || salesOrder?.paymentMode }}</div>
            <div class="text-caption bottom text-grey">{{ $t('PaymentMode') }}</div>
          </div>
          <template v-if="salesOrder?.paymentMode == 'bch'">
            <div v-if="salesOrder?.bchRecipientAddress" class="q-pa-xs q-space">
              <div class="ellipsis" style="max-width:10em">{{ salesOrder?.bchRecipientAddress }}</div>
              <div class="text-caption bottom text-grey">{{ $t('RecipientAddress') }}</div>
              <q-menu class="q-pa-sm">
                <div class="row items-center">
                  <div class="text-subtitle2 q-space">{{ $t('RecipientAddress') }}</div>
                  <div class="row items-center">
                    <q-btn
                      flat
                      icon="content_copy"
                      padding="xs"
                      @click="() => copyToClipboard(salesOrder?.bchRecipientAddress, $t('RecipientAddressCopied'))"
                    />
                  </div>
                </div>
                <div style="word-break: break-all;">{{ salesOrder?.bchRecipientAddress }}</div>
              </q-menu>
            </div>
            <div v-if="salesOrder?.bchTxid" class="q-pa-xs q-space">
              <div class="ellipsis" style="max-width:10em">{{ salesOrder?.bchTxid }}</div>
              <div class="text-caption bottom text-grey">{{ $t('Transaction') }}</div>
              <q-menu class="q-pa-sm">
                <div class="row items-center">
                  <div class="text-subtitle2 q-space">{{ $t('Transaction') }}</div>
                  <div class="row items-center q-gutter-sm">
                    <q-btn
                      flat
                      icon="content_copy"
                      padding="xs"
                      @click="() => copyToClipboard(salesOrder?.bchTxid, $t('TransactionCopied'))"
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
        <div v-if="salesOrder?.$state?.updating" class="row items-center justify-center">
          <q-spinner size="3em"/>
        </div>
        <div v-if="salesOrder?.items?.length" class="text-subtitle1">{{ $t('Items') }}</div>
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
        <div v-if="salesOrder?.total || salesOrder?.bchTotal" class="text-subtitle1 row items-start q-pr-md">
          <div class="text-grey q-space">{{ $t('Total') }}</div>
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
                        `BCH price at ${formatTimestampToText(salesOrder?.bchPrice?.timestamp)}`
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
              {{ salesOrder?.total }} {{ salesOrder?.currency?.symbol }}
            </template>
          </div>
        </div>
        <slot name="bottom"></slot>
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
import { useI18n } from 'vue-i18n'

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
    const { t } = useI18n()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    function copyToClipboard(value, message='') {
      this.$copyText(value)
        .then(() => {
          $q.notify({
            message: message || t('CopiedToClipboard'),
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
