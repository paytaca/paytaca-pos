<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-pa-md rounded-borders">
      <div class="row items-center">
        <div class="text-h6">{{ title }}</div>
        <q-space/>
        <q-btn
          flat
          icon="close"
          padding="sm"
          v-close-popup
        />
      </div>
      <AddonsInfoPanel :addons="addons" :currency="currency"/>
    </q-card>
  </q-dialog>
</template>
<script>
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import AddonsInfoPanel from './AddonsInfoPanel.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export default defineComponent({
  name: 'AddonsInfoDialog',
  components: {
    AddonsInfoPanel,
  },
  emits: [
    'update:modelValue',
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    addons: Array,
    currency: String,
    title: {
      type: String,
      default: t('AddonOptions'),
    },
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } = useDialogPluginComponent()
    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    watch(() => props.modelValue, () => innerVal.value = props.modelValue)
    
    return {
      dialogRef, onDialogCancel, onDialogHide, onDialogOK,
      innerVal
    }
  }
})
</script>
