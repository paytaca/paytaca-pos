<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-dialog-plugin">
      <div class="row no-wrap items-center justify-center q-pl-md q-py-sm">
        <div class="text-h5 text-brandblue q-space q-mt-sm"> {{ $t('Received') }} </div>
        <q-btn
          flat
          padding="sm"
          icon="close"
          class="text-brandblue"
          v-close-popup
        />
      </div>
      <q-card-section>
        <div class="q-mb-md">
          <div class="row items-center justify-center q-gutter-x-sm">
            <div class="text-h5">
              {{ amount }} {{ tokenCurrency }}
            </div>
            <img v-if="logo" :src="logo" height="30"/>
          </div>
          <div v-if="marketValue && marketValueCurrency" class="text-center text-body2">
            {{ marketValue }} {{ marketValueCurrency }}
          </div>
        </div>
        <div class="text-grey text-center" style="margin-bottom:-0.5em;">{{ $t('ReferenceID') }}</div>
        <p class="text-center" style="font-size: 22px; margin-top: 7px;">
          {{ txid.substring(0, 6).toUpperCase() }}
        </p>

        <div class="text-grey text-center" style="margin-bottom:-0.5em;">{{ $t('TransactionID') }}</div>
        <div class="row items-center no-wrap text-subtitle1" style="margin-top: 7px;">
          <div class="ellipsis">{{txid}}</div>
          <div class="row no-wrap">
            <q-btn
              rounded
              padding="xs"
              icon="content_copy"
              @click="copyText(txid, $t('TransactionIdCopied'))"
            />
            <q-btn
              rounded
              padding="xs"
              icon="open_in_new"
              :href="`https://blockchair.com/bitcoin-cash/transaction/${txid}/`"
              target="_blank"
            />
          </div>
        </div>
        <!--
        <q-separator class="q-my-md"/>
        <div class="q-mt-sm">
          <q-btn
            no-caps
            :label="$t('Okay')"
            color="brandblue"
            class="full-width"
            @click="onOk()"
          />
        </div>
        -->
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { useI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'

export default defineComponent({
  name: 'ReceiveUpdateDialog',
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
  },
  methods: {
    copyText(value, message='Copied address') {
      this.$copyText(value)
        .then(() => {
          this.$q.notify({
            message: message || this.$t('CopiedToClipboard'),
            timeout: 800,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        })
        .catch(() => {})
    }
  },
  setup(props) {
    const $q = useQuasar()
    const { t } = useI18n()

    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

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
    }
  },
})
</script>
