<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" transition-show="slide-up" transition-hide="slide-down">
    <q-card class="q-dialog-plugin" style="position:relative;">
      <div class="confetti-container">
        <ConfettiExplosion
          v-if="showConfetti"
          :particleCount="200"
          :force="0.4"
          :duration="8000"
          :shouldDestroyAfterDone="true"
        />
      </div>
      <div class="row no-wrap items-start q-pl-md q-pt-md q-pb-sm q-pr-md">
        <div class="col">
          <div v-if="merchantName" class="text-h6">{{ merchantName }}</div>
          <div v-if="posName" class="text-caption text-grey">{{ posName }}</div>
        </div>
        <q-btn
          flat
          padding="sm"
          icon="close"
          class="text-brandblue"
          v-close-popup
        />
      </div>
      <q-card-section class="q-py-md">
        <div class="text-h6 text-center">
          {{ $t('RECEIVED') }}
        </div>
        <div class="text-h6 text-center q-mt-sm">
          <q-icon name="arrow_downward" class="record-type-icon"/>
        </div>
      </q-card-section>
      <q-card-section class="q-mt-xs">
        <q-item clickable v-ripple @click="copyText(String(amount))">
          <q-item-section v-if="logo" side>
            <img
              v-if="logo && logo !== 'bch-logo.png'"
              height="35"
              :src="logo"
              @error="onImgErrorIpfsSrc"
            />
            <img v-else-if="logo === 'bch-logo.png'" src="~assets/bch-logo.webp" height="30"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-h5">
              {{ amount }} {{ tokenCurrency }}
            </q-item-label>
            <q-item-label v-if="fiatReferenceAmount && fiatReferenceCurrency" class="text-body1 text-grey">
              {{ fiatReferenceAmount }} {{ fiatReferenceCurrency }}
            </q-item-label>
            <q-item-label v-else-if="marketValue && marketValueCurrency" caption>
              {{ marketValue }} {{ marketValueCurrency }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable v-ripple @click="copyText(currentDate)">
          <q-item-section>
            <q-item-label class="text-grey" caption>{{ $t('Date') }}</q-item-label>
            <q-item-label>{{ currentDate }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="txid" clickable v-ripple @click="copyText(hexToRef(txid.substring(0, 6)))" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('ReferenceID') }}</q-item-label>
            <q-item-label>{{ hexToRef(txid.substring(0, 6)) }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="txid" clickable v-ripple @click="copyText(txid)" style="overflow-wrap: anywhere;">
          <q-item-section>
            <q-item-label caption class="text-grey">{{ $t('TransactionID') }}</q-item-label>
            <q-item-label>{{ txid }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { hexToRef } from 'src/utils/reference-id-utils'
import { useI18n } from 'vue-i18n'
import { defineComponent, ref, onMounted, inject, computed } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import ConfettiExplosion from "vue-confetti-explosion"

export default defineComponent({
  name: 'ReceiveUpdateDialog',
  components: {
    ConfettiExplosion,
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    txid: String,
    address: String,
    amount: [String, Number],
    tokenCurrency: String,
    marketValue: [String, Number],
    marketValueCurrency: String,
    logo: [String, null],
    expectedAmount: [String, Number],
    fiatReferenceAmount: [String, Number],
    fiatReferenceCurrency: String,
    senders: Array,
    tokenName: String,
    tokenId: String,
    tokenDecimals: Number,
    merchantName: String,
    posName: String,
  },
  setup(props) {
    const $q = useQuasar()
    const { t } = useI18n()

    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    
    const showConfetti = ref(false)
    const $copyText = inject('$copyText')
    
    const currentDate = computed(() => {
      return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date())
    })
    
    function concatenate (array) {
      if (!Array.isArray(array)) return ''
      let addresses = array
        .map(item => item?.[0])
        .filter(Boolean)
        .filter((e, i , s) => s.indexOf(e) === i)

      return addresses.join(', ')
    }
    
    function copyText(value, message='') {
      $copyText(value).then(() => {
        $q.notify({
          message: message || t('Copied to clipboard'),
          timeout: 800,
          icon: 'mdi-clipboard-check',
          color: 'blue-9'
        })
      })
      .catch(() => {})
    }
    
    onMounted(() => {
      // Trigger confetti after the slide-up animation completes (400ms)
      setTimeout(() => {
        showConfetti.value = true
      }, 400)
    })

    function onOk() {
      if (!props.expectedAmount) return onDialogOK()

      const expectedAmount = parseFloat(props.expectedAmount)
      const amount = parseFloat(props?.amount)
      const errorAmount = Math.abs(expectedAmount - amount)
      const allowedErrorAmount = 1000 / 10 ** 8
      if (errorAmount > allowedErrorAmount ) {
        $q.dialog({
          title: t('AmountErrTitle'),
          message: t('AmountErrMsg'),
          ok: { color: 'brandblue' },
          cancel: true,
        }).onOk(() => onDialogOK())
          .onDismiss(() => onDialogHide())
      } else {
        onDialogOK()
      }
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      onOk,
      showConfetti,
      currentDate,
      concatenate,
      copyText,
      hexToRef,
      onImgErrorIpfsSrc,
      $q,
    }
  },
})
</script>
<style lang="scss" scoped>
.confetti-container {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 1;
}

.record-type-icon {
  /* color: #3b7bf6; */
  color: white;
  font-size: 30px;
  background: $brandblue;
  border-radius: 20px;
  padding: 4px;
}
</style>
