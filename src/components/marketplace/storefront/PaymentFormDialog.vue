<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Add Payment</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form ref="form" @submit="() => savePayment()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>

          <div class="row items-center">
            <div class="q-space">Amount</div>
            <q-btn
              v-if="order?.totalPayable"
              flat no-caps padding="none"
              @click="() => formData.amount = order?.totalPayable"
            >
              Total {{ order?.totalPayable }} {{ order?.currency?.symbol }}
            </q-btn>
          </div>
          <q-input
            dense
            outlined
            :readonly="formData.useEscrow"
            :disable="loading"
            class="q-mb-md"
            type="numeric"
            v-model.number="formData.amount"
            :placeholder="isFinite(order?.totalPayable) ? order?.totalPayable : ''"
            :suffix="order?.currency?.symbol"
            :error="Boolean(formErrors?.amount)"
            :error-message="formErrors?.amount"
            :rules="[
              val => !Boolean(val) ||  val > 0 || 'Must be greater than zero',
            ]"
          />

          <div>Status</div>
          <q-select
            dense
            outlined
            :readonly="formData.useEscrow"
            :disable="loading"
            v-model="formData.status"
            :options="statuses"
            map-options
            emit-value
            :error="Boolean(formErrors?.status)"
            :error-message="formErrors?.status"
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <q-checkbox
            :disable="loading"
            v-model="formData.useEscrow"
            label="Escrow"
          />
          <div class="q-mt-md">
            <q-btn
              no-caps
              :disable="loading"
              :loading="loading"
              label="Add Payment"
              type="submit"
              color="brandblue"
              class="full-width"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Order, Payment } from 'src/marketplace/objects'
import { errorParser } from 'src/marketplace/utils'
import { useDialogPluginComponent } from 'quasar'
import { capitalize, defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'PaymentFormDialog',
  props: {
    modelValue: Boolean,
    initial: Object,
    order: Order,
  },
  emits: [
    'update:modelValue',
    'saved',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const loading = ref(false)
    const statuses = [
      'pending',
      'sent', 
      'received',
      'refunded',
    ].map(status => Object({ label: capitalize(status), value: status }))
    const form = ref()
    const formData = ref({
      amount: 0,
      status: '',
      useEscrow: false,
    })
    watch(() => [formData.value.useEscrow], () => {
      if (!formData.value.useEscrow) return
      formData.value.amount = null
      formData.value.status = 'pending'
    })

    onMounted(() => resetForm())
    watch(innerVal, () => resetForm())
    function resetForm() {
      formData.value = {
        amount: props?.initial?.amount || null,
        status: props?.initial?.status,
        useEscrow: false,
      }
      setTimeout(() => form.value?.resetValidation?.(), 10)
    }

    const formErrors = ref({
      detail: [],
      amount: '',
      status: '',
    })
    function resetFormErrors() {
      formErrors.value.detail = []
      formErrors.value.amount = ''
      formErrors.value.status = ''
    }

    function savePayment() {
      const data = {
        order_id: props?.order?.id,
        amount: formData.value.amount || undefined,
        status: formData.value.status || undefined,
        escrow: !formData.value.useEscrow ? undefined : {},
      }

      loading.value = true
      return backend.post('connecta/payments/', data)
        .finally(() => resetFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $emit('saved', Payment.parse(response?.data))
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          if (!data) {
            formErrors.value.detail = ['Encountered errors in saving payment']
            return Promise.reject(error)
          }

          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.amount = errorParser.firstElementOrValue(data?.amount)
          formErrors.value.status = errorParser.firstElementOrValue(data?.status)

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]
          if (data?.detail) formErrors.value.detail = errorParser.toArray(data?.order_id)

          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered errors in saving payment']
          }

          return Promise.reject(error)
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
      statuses,

      formErrors,

      savePayment,
    }
  },
})
</script>
