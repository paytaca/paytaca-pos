<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: min(500px, 90vw);">
      <q-card-section class="q-pb-none">
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Cancel order</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
      </q-card-section>
      <q-form @submit="() => submit()">
        <q-card-section class="q-px-sm q-pt-none">
          <div class="text-subtitle1 q-mx-sm">Reason for cancel:</div>
          <div v-for="(opt, index) in opts" :key="index">
            <q-radio
              v-model="selected"
              :val="opt"
              :label="opt"
            />
          </div>
          <q-slide-transition>
            <div v-if="selected === 'Other'" class="q-mx-sm">
              <q-input
                dense
                outlined
                label="Specify reason"
                v-model="customReason"
                :rules="[
                  val => Boolean(val) || 'Required',
                ]"
              />
            </div>
          </q-slide-transition>
          <div class="row items-center justify-end q-mt-sm">
            <q-btn
              no-caps
              label="Cancel Order"
              color="red"
              padding="sm lg"
              type="submit"
            />
          </div>
        </q-card-section>
      </q-form>
    </q-card>
  </q-dialog>
</template>
<script>
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'CancelReasonFormDialog',
  props: {
    modelValue: Boolean,
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const innerVal = ref(props.modelValue)

    const selected = ref('')
    const customReason = ref('')
    const opts = [
      'Item unavailable',
      'Invalid order',
      'Other',
    ]

    function submit() {
      if (selected.value === 'Other') onDialogOK(customReason.value)
      else onDialogOK(selected.value)
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      opts,
      selected,
      customReason,
      submit,
    }
  },
})
</script>
