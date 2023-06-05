<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Escrow</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        
        <div
          class="q-mb-sm rounded-borders"
          style="position:relative;" v-ripple
          @click="copyToClipboard(escrowContract?.address)"
        >
          <div class="text-caption text-grey top">Address</div>
          <div style="word-break: break-all;">
            {{ escrowContract?.address }}
            <q-icon name="content_copy"/>
          </div>
        </div>
        
        <div
          class="q-mb-sm rounded-borders"
          style="position:relative;" v-ripple
          @click="copyToClipboard(escrowContract?.sellerAddress)"
        >
          <div class="text-caption text-grey top">Recipient</div>
          <div style="word-break: break-all;">
            {{ escrowContract?.sellerAddress }}
            <q-icon name="content_copy"/>
          </div>
        </div>

        <div
          class="q-mb-sm rounded-borders"
          style="position:relative;" v-ripple
          @click="copyToClipboard(escrowContract?.deliveryServiceAddress)"
        >
          <div class="text-caption text-grey top">Delivery fee receipient</div>
          <div v-if="escrowContract?.deliveryServiceAddress" style="word-break: break-all;">
            {{ escrowContract?.deliveryServiceAddress }}
            <q-icon name="content_copy"/>
          </div>
          <div v-else class="text-grey">
            None
          </div>
        </div>

        <q-separator spaced/>
        <div class="q-mb-sm">
          <div class="row items-start">
            <div class="text-grey q-space">Amount</div>
            <div>{{ escrowContract?.bchAmounts?.amount }} BCH</div>
          </div>
          <div class="q-pl-sm">
            <div class="row items-start">
              <div class="text-grey q-space">Delivery fee</div>
              <div>{{ escrowContract?.bchAmounts?.deliveryFee }} BCH</div>
            </div>
    
            <div class="row items-start">
              <div class="text-grey q-space">Service fee</div>
              <div>{{ escrowContract?.bchAmounts?.serviceFee }} BCH</div>
            </div>
    
            <div class="row items-start">
              <div class="text-grey q-space">Arbitration fee</div>
              <div>{{ escrowContract?.bchAmounts?.arbitrationFee }} BCH</div>
            </div>
          </div>

          <div class="row items-start">
            <div class="text-grey q-space">Total</div>
            <div>{{ escrowContract?.bchAmounts?.total }} BCH</div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { EscrowContract } from 'src/marketplace/objects'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { defineComponent, ref, watch } from 'vue'

export default defineComponent({
  name: 'EscrowContractDialog',
  props: {
    modelValue: Boolean,
    escrowContract: EscrowContract,
  },
  emits: [
    'update:modelValue',

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
    }
  },
})
</script>
