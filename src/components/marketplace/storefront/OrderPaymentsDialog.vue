<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">

    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">{{ $t('Payments') }}</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <slot name="before"></slot>
        <q-list v-if="payments?.length" class="q-r-mx-md" separator style="max-height:65vh;overflow:auto;">
          <q-item v-for="payment in payments" :key="payment?.id" clickable v-ripple>
            <q-item-section top>
              <q-item-label>
                {{ capitalize(payment?.status).replaceAll('_', ' ') }}
              </q-item-label>
              <q-item-label caption>
                {{ formatDateRelative(payment?.createdAt) }}
              </q-item-label>
            </q-item-section>
            <q-item-section avatar top>
              <q-item-label>
                {{ payment?.totalAmount }} {{ payment?.currency?.symbol }}
              </q-item-label>
              <q-item-label caption>
                {{ payment?.bchTotalAmount }} BCH
              </q-item-label>
            </q-item-section>
            <q-item-section side top style="padding-left:4px;">
              <template v-if="payment?.isEscrow || payment?.canReceive || payment?.canRefund">
                <q-icon name="more_vert"/>
                <q-menu class="text-left q-py-xs">
                  <q-list separator>
                    <q-item
                      v-if="!payment?.isEscrow && payment?.canReceive"
                      clickable v-ripple
                      v-close-popup
                      @click="() => updatePaymentStatus({ payment, status: 'received' })"
                    >
                      <q-item-section>
                        <q-item-label>{{ $t('MarkReceived', {}, 'Mark received') }}</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      v-if="payment?.canRefund && payment?.hasRefundableAmount"
                      clickable v-ripple
                      v-close-popup
                      @click="() => openRefundFormDialog(payment)"
                    >
                      <q-item-section>
                        <q-item-label>{{ $t('AddRefund', {}, 'Add Refund')}}</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      v-if="payment?.totalRefunded"
                      clickable v-ripple
                      v-close-popup
                      @click="() => displayPaymentRefunds(payment)"
                    >
                      <q-item-section>
                        <q-item-label>{{ $t('Refunds') }}</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      v-if="payment.isEscrow"
                      clickable v-ripple
                      v-close-popup
                      @click="() => displayPaymentEscrowContract(payment)"
                    >
                      <q-item-section>
                        <q-item-label style="white-space: nowrap;">{{ $t('ViewEscrow', {}, 'View escrow') }}</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      v-if="payment.isEscrow && payment.status === 'pending'"
                      clickable v-ripple
                      v-close-popup
                      @click="() => updateEscrowFundingPrompt(payment)"
                    >
                      <q-item-section>
                        <q-item-label>{{ $t('UpdateEscrowPayment',{} , 'Update escrow payment')}}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </template>
              <q-icon v-else/>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-center text-grey q-my-md">
          {{ $t('NoPayments', {}, 'No payments') }}
        </div>
      </q-card-section>
      <EscrowContractDialog
        v-model="escrowContractDialog.show"
        :escrow-contract="escrowContractDialog.escrowContract"
        :bch-price="escrowContractDialog.bchPrice"
        :token-prices="escrowContractDialog.tokenPrices"
        :currency="escrowContractDialog.currency"
      />

      <RefundFormDialog
        v-model="refundFormDialog.show"
        :payment="refundFormDialog.payment"
        @created="() => {
          refundFormDialog.show = false
          $emit('updated')
        }"
      />
      <PaymentRefundsDialog
        v-model="paymentRefundsDialog.show"
        :payment="paymentRefundsDialog.payment"
        @updated="() => $emit('updated')"
      />
    </q-card>
  </q-dialog>
</template>
<script>
import { BchPrice, EscrowContract, Payment } from 'src/marketplace/objects'
import { errorParser, formatDateRelative } from 'src/marketplace/utils'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { capitalize, computed, defineComponent, ref, watch } from 'vue'
import { backend } from 'src/marketplace/backend'
import EscrowContractDialog from './EscrowContractDialog.vue'
import RefundFormDialog from './RefundFormDialog.vue'
import PaymentRefundsDialog from './PaymentRefundsDialog.vue'

export default defineComponent({
  name: 'OrderPaymentsDialog',
  components: {
    EscrowContractDialog,
    RefundFormDialog,
    PaymentRefundsDialog,
  },
  props: {
    modelValue: Boolean,
    payments: Array,
  },
  emits: [
    'update:modelValue',
    'updated',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const $q = useQuasar()

    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    function _updatePaymentStatus(opts={payment: Payment.parse(), status: null, force: false }) {
      if (!opts?.payment?.id) return Promise.reject('No payment provided')
      if (opts?.payment?.status === opts?.status && !opts?.force) return Promise.resolve(opts?.payment)

      const data = { status: opts?.status }

      return backend.patch(`connecta/payments/${opts?.payment?.id}/`, data)
        .then(response => {
          if (opts?.payment?.id != response?.data?.id) return Promise.reject({ response })
          return Payment.parse(response?.data)
        })
    }

    function updatePaymentStatus(opts={payment: Payment.parse(), status: null, force: false }) {
      const dialog = $q.dialog({
        title: 'Updating payment',
        progress: true,
        persistent: true,
        ok: false,
      })
      return _updatePaymentStatus(opts)
        .then(payment => {
          $emit('updated', payment)
          if (opts?.payment) opts.payment.raw = payment?.raw
          dialog.hide()
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMessage = errorParser.firstElementOrValue(data?.non_field_errors) ||
                            errorParser.firstElementOrValue(data?.status) ||
                            data?.detail
          if (!errorMessage && Array.isArray(data)) errorMessage = data[0]
          if (!errorMessage && typeof error === 'string') errorMessage = error
          if (!errorMessage) errorMessage = 'Unable to update status'
          dialog.update({ title: 'Error', message: errorMessage })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue' }})
        })
    }

    function updateEscrowFundingPrompt(payment=Payment.parse(), ) {
      $q.dialog({
        title: 'Escrow payment transaction',
        message: 'Enter Transaction ID',
        prompt: {
          placeholder: '84c3d..2df4',
          color: 'brandblue',
        },
        position: 'bottom',
        cancel: { flat: true, color: 'grey', noCaps: true },
        ok: { color: 'brandblue' },
      }).onOk(txid => updateEscrowFunding(payment, txid))
    }

    function updateEscrowFunding(payment=Payment.parse(), txid='') {
      if (!payment?.escrowContractAddress) return
      const data = { funding_txid: txid }
      const path = `connecta/escrow/${payment?.escrowContractAddress}/` +
                    (txid ? 'set_funding_transaction/' : 'resolve_funding_transaction/')

      const dialog = $q.dialog({
        title: 'Updating payment',
        progress: true,
        persistent: true,
        ok: false,
        cancel: false,
      })

      return backend.post(path, data)
        .then(response => {
          payment.refetch()
          if (!payment.escrowContract) payment.escrowContract = EscrowContract.parse(response?.data)
          else payment.escrowContract.raw = response?.data

          $emit('updated', payment)
          dialog.hide()
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMessage = errorParser.firstElementOrValue(data?.non_field_errors) ||
                            errorParser.firstElementOrValue(data?.status) ||
                            data?.detail
          if (!errorMessage && Array.isArray(data)) errorMessage = data[0]
          if (!errorMessage && typeof error === 'string') errorMessage = error
          if (!errorMessage) errorMessage = 'Unable to update payment transaction'
          dialog.update({ title: 'Error', message: errorMessage })
        })
        .finally(() => {
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue' }})
        })
    }

    const escrowContractDialog = ref({
      show: false,
      escrowContract: EscrowContract.parse(),
      bchPrice: BchPrice.parse(),
      tokenPrices: [].map(BchPrice.parse),
      currency: '',
    })
    async function displayPaymentEscrowContract(payment=Payment.parse()) {
      if (!payment.escrowContractAddress) return

      if (!payment.escrowContract) await payment.fetchEscrowContract()

      escrowContractDialog.value.escrowContract = payment.escrowContract
      escrowContractDialog.value.bchPrice = payment.bchPrice
      escrowContractDialog.value.tokenPrices = payment.tokenPrices
      escrowContractDialog.value.currency = payment.currency.symbol
      escrowContractDialog.value.show = true
    }

    const refundFormDialog = ref({ show: false, payment: Payment.parse() })
    function openRefundFormDialog(payment=Payment.parse()) {
      refundFormDialog.value.payment = payment
      refundFormDialog.value.show = true
    }

    const paymentRefundsDialog = ref({ show: false, payment: Payment.parse() })
    function displayPaymentRefunds(payment=Payment.parse()) {
      paymentRefundsDialog.value.payment = payment
      paymentRefundsDialog.value.show = true
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      updatePaymentStatus,
      updateEscrowFundingPrompt,

      escrowContractDialog,
      displayPaymentEscrowContract,

      refundFormDialog,
      openRefundFormDialog,

      paymentRefundsDialog,
      displayPaymentRefunds,

      // utils funcs
      formatDateRelative, capitalize,
    }
  },
})
</script>
