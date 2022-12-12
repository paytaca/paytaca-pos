<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-dialog-plugin">
      <div class="row no-wrap items-center justify-center q-pl-md q-py-sm">
        <div class="text-h5 q-space q-mt-sm"> Received </div>
        <q-btn
          flat
          padding="sm"
          icon="close"
          v-close-popup
        />
      </div>
      <q-card-section>
        <div class="row items-center justify-center q-gutter-x-sm q-mb-md">
          <div class="text-h5">
            {{ amount }} {{ tokenCurrency }}
          </div>
          <img v-if="logo" :src="logo" height="30"/>
        </div>
        <div class="text-grey" style="margin-bottom:-0.5em;">Transaction ID</div>
        <div class="row items-center no-wrap text-subtitle1">
          <div class="ellipsis">{{txid}}</div>
          <div class="row no-wrap">
            <q-btn
              rounded
              padding="xs"
              icon="content_copy"
              @click="copyText(txid, 'Transaction ID copied')"
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
        <q-separator class="q-my-md"/>
        <div class="q-mt-sm">
          <q-btn
            no-caps
            label="Okay"
            color="brandblue"
            class="full-width"
            @click="onDialogOK()"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent } from 'vue'
import { useDialogPluginComponent } from 'quasar'

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
    logo: [String, null],
  },
  methods: {
    copyText(value, message='Copied address') {
      this.$copyText(value)
        .then(() => {
          this.$q.notify({
            message: message || 'Copied to clipboard',
            timeout: 800,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        })
        .catch(() => {})
    }
  },
  setup() {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
    }
  },
})
</script>
