<template>
  <q-dialog ref="dialogRef"  v-model="innerVal" position="bottom" @hide="onDialogHide">
    <q-card>
      <q-card-section>
        <div class="row items-center">
          <div class="text-h6">{{ title }}</div>
          <q-space/>
          <q-btn v-close-popup flat icon="close" class="q-r-mr-sm"/>
        </div>

        <JSONFormPreview
          v-model="innerSchemaFormData"
          v-model:formDataErrors="schemaFormErrors"
          :schemaData="schemaData"
        />
        <q-btn
          no-caps
          label="OK"
          color="brandblue"
          class="full-width"
          @click="() => submit()"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, ref, watch } from 'vue'
import JSONFormPreview from './JSONFormPreview.vue'

export default defineComponent({
  name: 'JSONFormDataDialog',
  components: {
    JSONFormPreview,
  },
  emits: [
    'update:modelValue',
    'update:schemaData',
    'update:schemaFormData',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    title: { type: String, required: false, default: 'JSON Form' },
    schemaData: Array,
    schemaFormData: Object,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props?.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    watch(() => [props.schemaData], () => resetSchemaFormData(), { deep: true })
    watch(() => [props.schemaFormData], () => resetSchemaFormData(), { deep: true })
    const innerSchemaFormData = ref(props.schemaFormData || {})
    function resetSchemaFormData() {
      cartOptionsFormData.value = props.schemaFormData || {}
    }

    const schemaFormErrors = ref([])
    const schemaFormHasErrors = computed(() => Boolean(schemaFormErrors.value?.length))
    watch(() => [props.cartItem], () => schemaFormErrors.value=[], { deep: true })

    function submit() {
      if (schemaFormHasErrors.value) return
      onDialogOK(innerSchemaFormData.value)
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      innerSchemaFormData,
      schemaFormErrors,
      submit,
    }  
  },
})
</script>
