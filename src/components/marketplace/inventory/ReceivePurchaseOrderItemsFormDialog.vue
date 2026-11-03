<template>
  <q-dialog
    ref="dialogRef"
    full-width
    position="bottom"
    :persistent="loading"
    v-model="innerVal"
    @hide="onDialogHide"
    @before-show="resetForm"
  >
    <q-card class="column" style="max-height: 90vh;">
      <q-card-section class="q-pb-none">
        <div class="row items-center no-wrap">
          <div class="text-h6 q-space">
            {{ $t('ReceiveItems', {}, 'Receive items') }}
            <template v-if="purchaseOrder?.number">
              -
              {{
                $t(
                  'PoNumber',
                  { number: purchaseOrder?.number },
                  `PO#${purchaseOrder?.number}`
                )
              }}
            </template>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            :disable="loading"
            @click="() => (innerVal = false)"
          />
        </div>
      </q-card-section>
      <q-card-section class="col scroll q-pt-sm">
        <q-form @submit="submit">
          <q-banner
            v-if="errors?.length"
            class="bg-red text-white rounded-borders q-mb-sm"
          >
            <div v-if="errors?.length === 1">{{ errors[0] }}</div>
            <ul v-else class="q-pl-md q-my-none">
              <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
            </ul>
          </q-banner>

          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">
                {{ $t('ReceivedAt', {}, 'Received at') }}
              </div>
              <div class="row items-center no-wrap">
                <q-btn
                  flat
                  dense
                  no-caps
                  align="left"
                  class="col"
                  :disable="loading"
                  :label="
                    form.receivedAt
                      ? formatTimestampToText(form.receivedAt)
                      : $t('SetDate', {}, 'Set date')
                  "
                  @click="
                    () =>
                      openDateTimePicker(
                        form,
                        'receivedAt',
                        'ReceivedAt',
                        'Received at'
                      )
                  "
                />
                <q-btn
                  v-if="form.receivedAt"
                  flat
                  round
                  dense
                  size="sm"
                  icon="close"
                  :disable="loading"
                  @click="() => (form.receivedAt = null)"
                />
              </div>
            </div>
            <div class="col-12 col-sm-6">
              <div class="text-caption text-grey">
                {{ $t('ReceivedBy', {}, 'Received by') }}
              </div>
              <div class="text-body2 q-pt-xs">
                {{
                  marketplaceStore.user?.fullName ||
                  marketplaceStore.user?.username ||
                  $t('You', {}, 'You')
                }}
              </div>
            </div>
            <div class="col-12">
              <q-input
                dense
                outlined
                :disable="loading"
                v-model="form.supplierDocumentNumber"
                :label="
                  $t(
                    'SupplierDocumentNumber',
                    {},
                    'Supplier document number'
                  )
                "
              />
            </div>
            <div class="col-12">
              <q-input
                dense
                outlined
                autogrow
                type="textarea"
                :disable="loading"
                v-model="form.notes"
                :label="$t('Notes', {}, 'Notes')"
              />
            </div>
          </div>

          <div class="row items-center q-mt-md">
            <div class="text-subtitle1 q-space">
              {{ $t('ItemsToReceive', {}, 'Items to receive') }}
            </div>
            <q-btn
              v-if="form.lines?.length"
              flat
              dense
              no-caps
              :disable="loading"
              :label="
                allLinesSelected
                  ? $t('DeselectAll', {}, 'Deselect all')
                  : $t('SelectAll', {}, 'Select all')
              "
              @click="() => toggleSelectAll(!allLinesSelected)"
            />
          </div>

          <div v-if="!form.lines?.length" class="text-grey text-center q-py-md">
            {{ $t('NoPendingItemsToReceive', {}, 'No pending items to receive') }}
          </div>

          <q-expansion-item
            v-for="line in form.lines"
            :key="line.purchaseOrderItem?.id"
            v-model="line.expanded"
            class="q-mb-sm rounded-borders"
            style="border: 1px solid rgba(0, 0, 0, 0.12);"
            @update:model-value="
              (value) => {
                if (value) line.selected = true
              }
            "
          >
            <template v-slot:header>
              <q-item-section side top>
                <q-checkbox
                  dense
                  v-model="line.selected"
                  :disable="loading"
                  @click.stop
                  @keydown.enter.stop
                />
              </q-item-section>
              <q-item-section
                v-if="lineImage(line)"
                side
                top
              >
                <img
                  :src="lineImage(line)"
                  style="width: 42px;"
                  class="rounded-borders"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label
                  class="text-weight-medium"
                  style="overflow-wrap: anywhere;"
                >
                  {{ line.purchaseOrderItem?.variant?.itemName || line.purchaseOrderItem?.raw?.item_name }}
                </q-item-label>
                <q-item-label caption>
                  {{
                    $t(
                      'PendingQuantity',
                      { quantity: pendingQuantityOf(line.purchaseOrderItem) },
                      `Pending: ${pendingQuantityOf(line.purchaseOrderItem)}`
                    )
                  }}
                </q-item-label>
              </q-item-section>
            </template>

            <q-card flat>
              <q-card-section class="q-pt-none">
                <div class="row q-col-gutter-sm">
                  <div class="col-6">
                    <q-input
                      dense
                      outlined
                      type="number"
                      :disable="loading"
                      :min="0"
                      :max="pendingQuantityOf(line.purchaseOrderItem)"
                      v-model.number="line.quantityReceived"
                      :label="$t('QuantityReceived', {}, 'Quantity received')"
                    />
                  </div>
                  <div class="col-6">
                    <q-input
                      dense
                      outlined
                      type="number"
                      :disable="loading"
                      :min="0"
                      :max="line.quantityReceived"
                      v-model.number="line.quantityRejected"
                      :label="$t('QuantityRejected', {}, 'Quantity rejected')"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      dense
                      outlined
                      type="number"
                      :disable="loading"
                      :min="0"
                      :suffix="purchaseOrder?.currency?.symbol"
                      v-model.number="line.unitCost"
                      :label="$t('UnitCost', {}, 'Unit cost')"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-input
                      dense
                      outlined
                      :disable="loading"
                      v-model="line.supplierBatchNumber"
                      :label="
                        $t('SupplierBatchNumber', {}, 'Supplier batch number')
                      "
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <div class="text-caption text-grey">
                      {{ $t('ManufacturedAt', {}, 'Manufactured at') }}
                    </div>
                    <div class="row items-center no-wrap">
                      <q-btn
                        flat
                        dense
                        no-caps
                        align="left"
                        class="col"
                        :disable="loading"
                        :label="
                          line.manufacturedAt
                            ? formatTimestampToText(line.manufacturedAt)
                            : $t('SetDate', {}, 'Set date')
                        "
                        @click="
                          () =>
                            openDateTimePicker(
                              line,
                              'manufacturedAt',
                              'ManufacturedAt',
                              'Manufactured at'
                            )
                        "
                      />
                      <q-btn
                        v-if="line.manufacturedAt"
                        flat
                        round
                        dense
                        size="sm"
                        icon="close"
                        :disable="loading"
                        @click="() => (line.manufacturedAt = null)"
                      />
                    </div>
                  </div>
                  <div class="col-12 col-sm-6">
                    <div class="text-caption text-grey">
                      {{ $t('ExpiresAt', {}, 'Expires at') }}
                    </div>
                    <div class="row items-center no-wrap">
                      <q-btn
                        flat
                        dense
                        no-caps
                        align="left"
                        class="col"
                        :disable="loading"
                        :label="
                          line.expiresAt
                            ? formatTimestampToText(line.expiresAt)
                            : $t('SetDate', {}, 'Set date')
                        "
                        @click="
                          () =>
                            openDateTimePicker(
                              line,
                              'expiresAt',
                              'ExpiresAt',
                              'Expires at'
                            )
                        "
                      />
                      <q-btn
                        v-if="line.expiresAt"
                        flat
                        round
                        dense
                        size="sm"
                        icon="close"
                        :disable="loading"
                        @click="() => (line.expiresAt = null)"
                      />
                    </div>
                  </div>
                  <div class="col-12">
                    <q-input
                      dense
                      outlined
                      autogrow
                      type="textarea"
                      :disable="loading"
                      v-model="line.remarks"
                      :label="$t('Remarks', {}, 'Remarks')"
                    />
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>

          <div class="q-mt-md">
            <q-btn
              type="submit"
              no-caps
              color="brandblue"
              class="full-width"
              :loading="loading"
              :disable="loading || !canSubmit"
              :label="$t('ReceiveItems', {}, 'Receive items')"
            />
            <div
              v-if="form.lines?.length && !selectedLines?.length"
              class="text-caption text-grey text-center q-mt-xs"
            >
              {{
                $t(
                  'SelectItemsToReceiveMsg',
                  {},
                  'Select at least one item to receive'
                )
              }}
            </div>
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { backend } from 'src/marketplace/backend'
import { PurchaseOrder } from 'src/marketplace/objects'
import { formatTimestampToText } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DateTimePickerDialog from 'src/components/DateTimePickerDialog.vue'

export default defineComponent({
  name: 'ReceivePurchaseOrderItemsFormDialog',
  emits: [
    'update:model-value',
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    purchaseOrder: PurchaseOrder,
  },
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const { t: $t } = useI18n()
    const marketplaceStore = useMarketplaceStore()
    const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => (innerVal.value = props.modelValue))
    watch(innerVal, () => $emit('update:model-value', innerVal.value))

    const loading = ref(false)
    const errors = ref([])

    const emptyForm = () => ({
      receivedAt: new Date().toISOString(),
      supplierDocumentNumber: '',
      notes: '',
      lines: [],
    })
    const form = ref(emptyForm())

    function resetForm() {
      errors.value = []
      form.value = emptyForm()
      if (!Array.isArray(props.purchaseOrder?.items)) return

      form.value.lines = props.purchaseOrder.items
        .filter((item) => pendingQuantityOf(item) > 0)
        .map((item) => ({
          purchaseOrderItem: item,
          selected: false,
          expanded: false,
          quantityReceived: pendingQuantityOf(item),
          quantityRejected: 0,
          unitCost:
            item?.costPrice === null || item?.costPrice === undefined
              ? null
              : Number(item.costPrice),
          supplierBatchNumber: '',
          manufacturedAt: null,
          expiresAt: item?.expiresAt
            ? new Date(item.expiresAt).toISOString()
            : null,
          remarks: '',
        }))
    }

    function pendingQuantityOf(item) {
      const pendingQuantity = Number(item?.pendingQuantity)
      if (Number.isFinite(pendingQuantity)) return pendingQuantity

      const quantity = Number(item?.quantity) || 0
      const receivedQuantity = Number(item?.receivedQuantity) || 0
      return Math.max(quantity - receivedQuantity, 0)
    }

    const selectedLines = computed(() => {
      return (form.value.lines || []).filter((line) => {
        return line.selected && Number(line.quantityReceived) > 0
      })
    })
    const allLinesSelected = computed(() => {
      return (
        Boolean(form.value.lines?.length) &&
        form.value.lines.every((line) => line.selected)
      )
    })
    const canSubmit = computed(() => {
      return selectedLines.value.length > 0
    })

    function toggleSelectAll(value) {
      ;(form.value.lines || []).forEach((line) => (line.selected = value))
    }

    function lineImage(line) {
      const variant = line?.purchaseOrderItem?.variant
      return variant?.imageUrl || variant?.product?.imageUrl
    }

    function openDateTimePicker(target, field, titleKey, title) {
      $q.dialog({
        component: DateTimePickerDialog,
        componentProps: {
          modelValue: target[field] || '',
          title: $t(titleKey, {}, title),
        },
      }).onOk((iso) => {
        target[field] = iso
      })
    }

    function extractErrorMessages(data) {
      if (!data) return []

      const messages = []
      function visit(value) {
        if (!value) return
        if (typeof value === 'string') {
          messages.push(value)
          return
        }
        if (Array.isArray(value)) {
          value.forEach(visit)
          return
        }
        if (typeof value === 'object') {
          Object.values(value).forEach(visit)
        }
      }

      visit(data)
      return Array.from(new Set(messages)).filter(Boolean)
    }

    function submit() {
      if (!selectedLines.value.length) {
        errors.value = [
          $t(
            'SelectItemsToReceiveMsg',
            {},
            'Select at least one item to receive'
          ),
        ]
        return
      }

      for (const line of selectedLines.value) {
        const itemName =
          line.purchaseOrderItem?.variant?.itemName ||
          line.purchaseOrderItem?.raw?.item_name ||
          $t('Item', {}, 'Item')
        const pendingQuantity =
          Number(line.purchaseOrderItem?.pendingQuantity) || 0
        const quantityReceived = Number(line.quantityReceived) || 0
        const quantityRejected = Number(line.quantityRejected) || 0

        let validationError = ''
        if (quantityReceived <= 0) {
          validationError = $t(
            'QuantityReceivedMustBeGreaterThanZero',
            { item: itemName },
            `Quantity received must be greater than zero for ${itemName}`
          )
        } else if (quantityReceived > pendingQuantity) {
          validationError = $t(
            'QuantityReceivedExceedsPending',
            { item: itemName, quantity: pendingQuantity },
            `Only ${pendingQuantity} unit(s) are pending for ${itemName}`
          )
        } else if (quantityRejected > quantityReceived) {
          validationError = $t(
            'QuantityRejectedExceedsReceived',
            { item: itemName },
            `Rejected quantity cannot exceed received quantity for ${itemName}`
          )
        }

        if (validationError) {
          errors.value = [validationError]
          return
        }
      }

      const data = {
        purchase_order_id: props.purchaseOrder?.id,
        supplier_document_number: form.value.supplierDocumentNumber || '',
        notes: form.value.notes || '',
        post_immediately: true,
        lines: selectedLines.value.map((line) => ({
          purchase_order_item_id: line.purchaseOrderItem?.id,
          quantity_received: Number(line.quantityReceived) || 0,
          quantity_rejected: Number(line.quantityRejected) || 0,
          unit_cost:
            line.unitCost === null || line.unitCost === ''
              ? null
              : Number(line.unitCost),
          supplier_batch_number: line.supplierBatchNumber || '',
          manufactured_at: line.manufacturedAt || null,
          expires_at: line.expiresAt || null,
          remarks: line.remarks || '',
        })),
      }
      if (form.value.receivedAt) data.received_at = form.value.receivedAt

      loading.value = true
      errors.value = []
      return backend
        .post('goods-receipts/', data)
        .then(async (response) => {
          try {
            await props.purchaseOrder.refetch()
          } catch (refetchError) {
            // The receipt was already posted; ignore refetch failures so the
            // user does not accidentally submit the same receipt twice.
          }
          onDialogOK(response?.data)
          return response
        })
        .catch((error) => {
          const messages = extractErrorMessages(error?.response?.data)
          errors.value = messages.length
            ? messages
            : [$t('ReceiveItemsError', {}, 'Unable to receive items')]
          return Promise.reject(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef,
      onDialogHide,
      onDialogOK,
      innerVal,

      marketplaceStore,
      loading,
      errors,
      form,
      resetForm,

      selectedLines,
      allLinesSelected,
      canSubmit,
      toggleSelectAll,
      lineImage,
      pendingQuantityOf,

      openDateTimePicker,
      submit,

      // utils funcs
      formatTimestampToText,
    }
  },
})
</script>
