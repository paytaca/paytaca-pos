<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">{{ $t('UpdateItems', {}, 'Update Items') }}</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form ref="form" @submit="() => submit()">
          <q-btn
            flat padding="none md"
            no-caps label="Reset"
            class="text-underline q-r-ml-lg q-mb-sm"
            @click="() => resetFormData()"
          />
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>

          <TransitionGroup name="fade">

            <div
              v-for="(orderItem, index) in formData?.items" :key="orderItem?.variant?.id"
              class="q-mb-sm"
            >
              <div class="row items-start no-wrap q-r-mx-sm">
                <div class="q-space row items-center justify-left no-wrap q-pa-xs">
                  <q-img
                    v-if="orderItem?.variant?.itemImage"
                    :src="orderItem?.variant?.itemImage"
                    width="35px"
                    ratio="1"
                    class="rounded-borders q-mr-xs"
                  />
                  <div>{{ orderItem?.variant?.itemName }}</div>
                </div>
                <q-btn
                  flat
                  :disable="loading"
                  icon="delete"
                  color="red"
                  padding="xs"
                  @click="() => formData.items = formData.items.filter(item => item !== orderItem)"
                />
              </div>
              <div class="q-pa-xs q-r-mx-sm">
                <q-input
                  dense outlined
                  :disable="loading"
                  :label="$t('Quantity')"
                  type="number"
                  v-model.number="orderItem.quantity"
                  hide-bottom-space
                  :error="Boolean(formErrors?.items?.[index]?.quantity)"
                  :error-message="formErrors?.items?.[index]?.quantity"
                  :rules="[
                    val => val > 0 || $t('Invalid'),
                  ]"
                />
              </div>
              <div class="row items-center no-wrap q-r-mx-sm">
                <div class="q-pa-xs">
                  <q-input
                    dense outlined
                    :disable="loading"
                    :label="$t('Price')"
                    :placeholder="orderItem?.variant?.price"
                    :suffix="orderCurrency"
                    type="number"
                    step="0.001"
                    v-model.number="orderItem.price"
                    :error="Boolean(formErrors?.items?.[index]?.price)"
                    :error-message="formErrors?.items?.[index]?.price"
                  />
                </div>
                <div class="q-pa-xs">
                  <q-input
                    dense outlined
                    :disable="loading"
                    :label="$t('MarkupPrice', {}, 'Markup price')"
                    :placeholder="orderItem?.variant?.markupPrice"
                    :suffix="orderCurrency"
                    type="number"
                    v-model.number="orderItem.markupPrice"
                    step="0.001"
                    :error="Boolean(formErrors?.items?.[index]?.markupPrice)"
                    :error-message="formErrors?.items?.[index]?.markupPrice"
                  />
                </div>
              </div>
              <div class="q-pa-xs q-r-mx-sm">
                <q-input
                  dense outlined
                  :disable="loading"
                  :label="$t('CutleryCost', {}, 'Cutlery cost')"
                  :suffix="orderCurrency"
                  type="number"
                  step="0.001"
                  v-model.number="orderItem.cutleryCost"
                  bottom-slots
                  :error="Boolean(formErrors?.items?.[index]?.cutleryCost)"
                  :error-message="formErrors?.items?.[index]?.cutleryCost"
                  :rules="[
                    val => val > 0 || $t('Invalid'),
                  ]"
                />
              </div>
              <q-field
                v-if="orderItem?.variant?.product?.hasCartOptions"
                dense outlined
                :label="$t('ItemOptions', {}, 'Item options')"
                :model-value="orderItem?.properties"
                bottom-slots
              >
                <template v-slot:control>
                  {{ lineItemPropertiesToText(orderItem?.properties?.data) }}
                </template>
                <template v-slot:append>
                  <q-btn
                    dense
                    flat
                    icon="edit"
                    @click="() => openItemOptionsForm(orderItem)"
                  />
                </template>
              </q-field>
            </div>
          </TransitionGroup>
          <q-btn
            no-caps
            :disable="loading"
            :label="$t('AddItem', {}, 'Add Item')"
            class="full-width"
            @click="() => showVariantSearchDialog = true"
          />

          <div class="q-mt-sm" @click="() => toggleAmountsDisplay()">
            <div class="row items-start text-subtitle2">
              <div class="q-space">{{ $t('Subtotal') }}</div>
              <div v-if="displayBch">{{ itemAmounts.subtotal.bch }} BCH</div>
              <div v-else>{{ itemAmounts.subtotal.currency }} {{ orderCurrency }}</div>
            </div>
  
            <div class="row items-start text-subtitle2">
              <div class="q-space">{{ $t('Markup') }}</div>
              <div v-if="displayBch">{{ itemAmounts.markupAmount.bch }} BCH</div>
              <div v-else>{{ itemAmounts.markupAmount.currency }} {{ orderCurrency }}</div>
            </div>
          </div>
  
          <q-separator spaced/>
  
          <q-btn
            no-caps
            :disable="loading"
            :label="$t('Update')"
            color="brandblue"
            class="full-width"
            type="submit"
          />
        </q-form>
      </q-card-section>
    </q-card>

    <VariantSearchDialog
      v-model="showVariantSearchDialog"
      @ok="onVariantSelected"
      :excludeVariantIds="formData.items.map(item => item?.variant?.id).filter(Boolean)"
      hide-scanner
      :extra-filter-args="{ storefront_id: order?.storefrontId }"
    />
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Order, Variant } from 'src/marketplace/objects'
import { errorParser, lineItemPropertiesToText } from 'src/marketplace/utils'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import VariantSearchDialog from '../sales/VariantSearchDialog.vue'
import JSONFormDataDialog from '../jsonform/JSONFormDataDialog.vue'

export default defineComponent({
  name: 'UpdateOrderItemsFormDialog',
  components: {
    VariantSearchDialog,
  },
  props: {
    modelValue: Boolean,
    order: Order,
  },
  emits: [
    'update:modelValue',
    'updated-items',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { t: $t } = useI18n()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const $q = useQuasar()

    onMounted(() => resetFormData())
    watch(innerVal, () => {
      if (!innerVal.value) return
      resetFormErrors()
      resetFormData()
    })

    const orderCurrency = computed(() => props?.order?.currency?.symbol)

    const loading = ref(false)
    const form = ref()
    function emptyItemFormData() {
      return {
        variant: Variant.parse(),
        quantity: 0,
        price: 0,
        markupPrice: 0,
        cutleryCost: 0,
        properties: undefined,
      }
    }
    const formData = ref({
      items: [].map(emptyItemFormData)
    })

    function resetFormData() {
      formData.value.items = props.order?.items?.map?.(item => {
        return {
          variant: item.variant,
          quantity: item.quantity,
          price: item.price,
          markupPrice: item.markupPrice,
          cutleryCost: item.cutleryCost,
          properties: item.properties ? Object.assign({}, item.properties) : undefined,
        }
      }) || []

      setTimeout(() => form.value?.resetValidation(), 10)
    }

    const displayBch = ref(false)
    const bchPrice = computed(() => parseFloat(props.order?.bchPrice?.price))
    watch(bchPrice, () => displayBch.value = displayBch.value && !isNaN(bchPrice.value))
    function toggleAmountsDisplay() {
      if (isNaN(bchPrice.value)) {
        displayBch.value = false
        return
      }
      displayBch.value = !displayBch.value
    }
    const itemAmounts = computed(() => {
      const data = {
        subtotal: { currency: 0, bch: 0 },
        markupSubtotal: { currency: 0, bch: 0 },
        markupAmount: { currency: 0, bch: 0 },
      }
      formData.value.items.forEach(item => {
        const quantity = parseInt(item?.quantity)
        if (!quantity) return
        const price = parseFloat(item?.price || item?.variant?.price)
        const markupPrice = parseFloat(item?.markupPrice || item?.variant?.markupPrice)
        if (price) data.subtotal.currency += quantity * price
        if (markupPrice) data.markupSubtotal.currency += quantity * markupPrice
      })
      const parseCurrency = num => Math.floor(num * 10 ** 3) / 10 ** 3
      data.markupAmount.currency = parseCurrency(data.markupSubtotal.currency - data.subtotal.currency)

      data.subtotal.currency = parseCurrency(data.subtotal.currency)
      data.markupSubtotal.currency = parseCurrency(data.markupSubtotal.currency)

      const parseBch = num => Math.floor(num * 10 ** 8) / 10 ** 8
      if (!isNaN(bchPrice.value)) {
        data.subtotal.bch = parseBch(data.subtotal.currency / bchPrice.value)
        data.markupSubtotal.bch = parseBch(data.markupSubtotal.currency / bchPrice.value)
        data.markupAmount.bch = parseBch(data.markupAmount.currency / bchPrice.value)
      } else {
        data.subtotal.bch = null
        data.markupSubtotal.bch = null
        data.markupAmount.bch = null
      }
      return data
    })

    const formErrors = ref({
      detail: [].map(String),
      items: [].map(() => {
        return {
          detail: [],
          variant_id: '',
          quantity: '',
          price: '',
          markupPrice: '',
          cutleryCost: '',
        }
      })
    })

    function resetFormErrors() {
      formErrors.value.detail = []
      formErrors.value.items = []
    }

    const showVariantSearchDialog = ref(false)
    function onVariantSelected(variant=Variant.parse()) {
      if (!variant?.id) return

      const index = formData.value.items.findIndex(item => item?.variant?.id == variant?.id)
      if (index >= 0) return

      formData.value.items.push({
        variant: variant,
        quantity: 1,
        price: variant?.price,
        markupPrice: variant?.markupPrice,
      })
    }

    function submit() {
      const orderId = props.order?.id
      const data = {
        items: formData.value.items.map(item => {
          return {
            variant_id: item?.variant?.id,
            quantity: item?.quantity,
            price: item?.price || undefined,
            markup_price: item?.markupPrice || undefined,
            cutlery_cost: item?.cutleryCost || undefined,
            properties: item?.properties,
          }
        })
      }

      loading.value = true
      return backend.patch(`connecta/orders/${orderId}/`, data)
        .finally(() => resetFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $emit('updated-items', response?.data)
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          if (!data) {
            formErrors.value.detail = [
              $t('EncounteredError'),,
              error?.message,
            ].filter(Boolean)
            return
          }
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          if (Array.isArray(data?.items)) {
            data?.items.forEach((itemError, index) => {
              formErrors.value.items[index] = {      
                variant: errorParser.firstElementOrValue(itemError?.variant_id),
                quantity: errorParser.firstElementOrValue(itemError?.quantity),
                price: errorParser.firstElementOrValue(itemError?.price),
                markupPrice: errorParser.firstElementOrValue(itemError?.markup_price),
                cutleryCost: errorParser.firstElementOrValue(itemError?.cutlery_cost),
              }
            })
          }
        })
        .finally(() => {
          loading.value = false
        })
    }

    async function openItemOptionsForm(orderItem=emptyItemFormData()) {
      if (!orderItem?.variant?.product?.hasCartOptions) return
      let schema = orderItem?.properties?.schema
      if (!schema?.length) {
        if (orderItem?.variant?.product?.cartOptions === undefined) {
          await orderItem?.variant?.product?.fetchCartOptions().catch(console.error)
        }
        schema = orderItem?.variant?.product?.cartOptions
      }

      $q.dialog({
        component: JSONFormDataDialog,
        componentProps: {
          schemaData: schema,
          schemaFormData: orderItem?.properties?.data,
        }
      }) 
        .onOk(data => {
          orderItem.properties = { schema: schema, data: data }
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      orderCurrency,
      loading,
      form,
      formData,
      resetFormData,

      displayBch,
      toggleAmountsDisplay,
      itemAmounts,

      formErrors,
      resetFormErrors,

      showVariantSearchDialog,
      onVariantSelected,

      submit,

      openItemOptionsForm,

      lineItemPropertiesToText,
    }
  },
})
</script>
<style scoped>
/* 1. declare transition */
.fade-move,
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}

/* 2. declare enter from and leave to state */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(30px, 0);
}

/* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
/* .fade-leave-active {
  position: absolute;
} */
</style>
