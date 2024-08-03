<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" :persistent="loading">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">{{ $t('Refund') }}</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form ref="form" @submit="() => saveRefund()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-md">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>
          <div class="row items-end">
            <div>{{ $t('RefundAmount', {}, 'Refund amount') }}</div>
            <q-space/>
            <q-btn
              flat round
              icon="mdi-restart"
              padding="xs"
              @click="() => resetFormData()"
            />
          </div>
          <div @click="() => formData.expandAmounts = !formData.expandAmounts">
            <q-input
              dense
              outlined
              readonly
              :model-value="computedFormData.total"
              :suffix="payment?.currency?.symbol"
            />
            <div class="row items-center justify-center q-my-sm">
              <q-icon :name="formData.expandAmounts ? 'expand_less': 'expand_more'" size="1.5em"/>
            </div>
          </div>
          <q-slide-transition>
            <div v-if="formData.expandAmounts">
              <div>{{ $t('Amount') }}</div>
              <q-input
                dense
                outlined
                :disable="loading"
                type="numeric"
                v-model.number="formData.amount"
                :placeholder="payment.refundableAmount || ''"
                :suffix="payment?.currency?.symbol"
                :error="Boolean(formErrors?.amount)"
                :error-message="formErrors?.amount"
                :rules="[
                  val => !Boolean(val) ||  val > 0 || 'Must be greater than zero',
                ]"
              />
    
              <div>{{ $t('DeliveryFee', {}, 'Delivery fee') }}</div>
              <q-input
                dense
                outlined
                :disable="loading"
                type="numeric"
                v-model.number="formData.deliveryFee"
                :placeholder="payment.refundableDeliveryFee || ''"
                :suffix="payment?.currency?.symbol"
                :error="Boolean(formErrors?.deliveryFee)"
                :error-message="formErrors?.deliveryFee"
                :rules="[
                  val => !Boolean(val) ||  val > 0 || 'Must be greater than zero',
                ]"
              />
    
              <div>{{ $t('MarkupAmount', {}, 'Markup amount') }}</div>
              <q-input
                dense
                outlined
                :disable="loading"
                type="numeric"
                v-model.number="formData.markupAmount"
                :placeholder="payment.refundableMarkupAmount || ''"
                :suffix="payment?.currency?.symbol"
                :error="Boolean(formErrors?.markupAmount)"
                :error-message="formErrors?.markupAmount"
                :rules="[
                  val => !Boolean(val) ||  val > 0 || 'Must be greater than zero',
                ]"
              />
            </div>
          </q-slide-transition>
          <q-separator spaced />
          <q-btn
            :disable="loading"
            :loading="loading"
            no-caps :label="$t('Refund')"
            color="brandblue"
            class="full-width"
            type="submit"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { Payment } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'

export default defineComponent({
  name: 'RefundFormDialog',
  props: {
    modelValue: Boolean,
    initial: Object,
    payment: Payment,
  },
  emits: [
    'update:modelValue',
    'created',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    onMounted(() => resetFormData())
    watch(innerVal, () => innerVal.value ? resetFormData() : null)

    onMounted(() => updateRecommendedAmounts())
    watch(() => [props.payment?.orderId], () => updateRecommendedAmounts())

    const recommendedAmounts = ref({ amount: 0, deliveryFee: 0, markupAmount: 0 })
    function updateRecommendedAmounts() {
      const orderId = props.payment?.orderId
      if (!orderId) return Promise.resolve()

      loading.value = true
      return backend.get(`connecta/orders/${orderId}/remaining_payments/`)
        .then(response => {
          const subtotal = parseFloat(response?.data?.subtotal) * -1
          const deliveryFee = parseFloat(response?.data?.delivery_fee) * -1
          const markupAmount = parseFloat(response?.data?.markup_amount) * -1
          if (Number.isNaN(subtotal) || Number.isNaN(deliveryFee) || Number.isNaN(markupAmount)) {
            return Promise.reject({ response })
          }

          recommendedAmounts.value.amount = subtotal
          recommendedAmounts.value.deliveryFee = deliveryFee
          recommendedAmounts.value.markupAmount = markupAmount
          resetFormData()
          return response
        })
        .catch(console.error)
        .finally(() => {
          loading.value = false
        })
    }

    const loading = ref(false)
    const form = ref()
    const formData = ref({
      amount: 0,
      deliveryFee: 0,
      markupAmount: 0,

      expandAmounts: false,
    })

    const computedFormData = computed(() => {
      const data = { total: 0 }
      data.total = formData.value.amount +
                   formData.value.deliveryFee +
                   formData.value.markupAmount
      return data
    })

    function resetFormData() {
      const payment = props.payment
      formData.value.amount = Math.min(payment?.refundableAmount || 0, recommendedAmounts.value.amount)
      formData.value.deliveryFee = Math.min(payment?.refundableDeliveryFee || 0, recommendedAmounts.value.deliveryFee)
      formData.value.markupAmount = Math.min(payment?.refundableMarkupAmount || 0, recommendedAmounts.value.markupAmount)
      formData.value.expandAmounts = false

      setTimeout(() => form.value?.resetValidation?.(), 10)
    }

    const formErrors = ref({
      detail: [],
      amount: '',
      deliveryFee: '',
      markupAmount: '',
    })
    function resetFormErrors() {
      formErrors.value = {
        detail: [],
        amount: '',
        deliveryFee: '',
        markupAmount: '',
      }
    }

    function saveRefund() {
      const data = {
        payment_id: props.payment?.id,
        amount: formData.value.amount,
        delivery_fee: formData.value.deliveryFee,
        markup_amount: formData.value.markupAmount,
      }

      loading.value = true
      return backend.post(`connecta/refunds/`, data)
        .finally(() => resetFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $emit('created', response?.data)
          props.payment.refetch()
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.amount = errorParser.firstElementOrValue(data?.amount)
          formErrors.value.deliveryFee = errorParser.firstElementOrValue(data?.delivery_fee)
          formErrors.value.markupAmount = errorParser.firstElementOrValue(data?.markup_amount)
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      loading,
      form,
      formData,
      computedFormData,
      resetFormData,

      formErrors,
      saveRefund,
    }
  },
})
</script>
