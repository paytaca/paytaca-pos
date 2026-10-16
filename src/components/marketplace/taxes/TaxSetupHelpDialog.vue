<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card
      class="rounded-borders"
      style="width:100%;max-width:560px;max-height:85vh;overflow:auto;"
    >
      <div class="row items-center no-wrap q-pa-md">
        <q-icon name="help_outline" color="brandblue" size="1.6em" class="q-mr-sm" />
        <div class="text-h6 q-space">
          {{ $t('TaxSetupHelpTitle', 'About tax setups') }}
        </div>
        <q-btn flat round dense icon="close" color="grey-7" v-close-popup />
      </div>

      <q-separator />

      <q-stepper v-model="step" flat animated header-nav class="bg-transparent">
        <q-step
          :name="1"
          icon="info"
          :title="$t('TaxSetupHelpWhatTitle', 'What is it?')"
          :done="step > 1"
        >
          <div class="text-body2">
            {{
              $t(
                'TaxSetupHelpWhat',
                'A tax setup is a ready-made bundle of tax types, discounts and benefit programs for your country, put together by the platform.',
              )
            }}
          </div>
        </q-step>

        <q-step
          :name="2"
          icon="touch_app"
          :title="$t('TaxSetupHelpDoTitle', 'What to do')"
          :done="step > 2"
        >
          <div class="text-body2">
            {{
              $t(
                'TaxSetupHelpDo',
                'Pick the setup that fits your shop and review exactly what it adds. Tap any tax type, discount or benefit program to see its details.',
              )
            }}
          </div>
        </q-step>

        <q-step
          :name="3"
          icon="play_circle"
          :title="$t('TaxSetupHelpHappensTitle', 'What happens')"
        >
          <div class="text-body2">
            {{
              $t(
                'TaxSetupHelpHappens',
                'Applying a setup adds those items to your shop. Nothing you already set up is removed, and your existing default tax type is kept. You can change or add to it later.',
              )
            }}
          </div>
        </q-step>
      </q-stepper>
    </q-card>
  </q-dialog>
</template>
<script>
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'TaxSetupHelpDialog',
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup() {
    const { dialogRef, onDialogHide } = useDialogPluginComponent()
    const step = ref(1)

    return {
      dialogRef,
      onDialogHide,
      step,
    }
  },
})
</script>
