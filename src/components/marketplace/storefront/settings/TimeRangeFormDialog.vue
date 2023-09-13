<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="q-space">
            <div class="text-h5">{{ title || 'Time range' }}</div>
            <div class="text-caption"> {{ subtitle }}</div>
          </div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form @submit="() => submit()">
          <div class="row items-center no-wrap">
            <q-select
              dense
              outlined
              label="Start time"
              :options="timeOpts"
              v-model="formData.startTime"
              map-options
              emit-value
              reactive-rules
              :rules="[
                () => isValidRange, 
              ]"
              class="full-width"
            >
              <template v-slot:before-options>
                <q-item
                  clickable
                  v-close-popup
                  @click="() => formData.startTime = null"
                >
                  <q-item-section>
                    <q-item-label class="text-grey italic">--- Remove ---</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <q-select
              dense
              outlined
              label="End time"
              :options="timeOpts"
              v-model="formData.endTime"
              map-options
              emit-value
              reactive-rules
              :rules="[
                () => isValidRange, 
              ]"
              class="full-width"
            >
              <template v-slot:before-options>
                <q-item
                  clickable
                  v-close-popup
                  @click="() => formData.endTime = null"
                >
                  <q-item-section>
                    <q-item-label class="text-grey italic">--- Remove ---</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
          <div class="row items-center q-mt-sm">
            <q-btn
              no-caps
              label="Set"
              color="brandblue"
              class="full-width"
              type="submit"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { time } from 'src/marketplace/utils'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, ref, watch } from 'vue'

export default defineComponent({
  name: 'TimeRangeFormDialog',
  props: {
    modelValue: Boolean,
    title: String,
    subtitle: String,
    initialValue: {
      default: () => {
        return {
          startTime: '',
          endTime: '',
        }
      }
    },
  },
  emits: [
    'update:modelValue',
    'submit',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const formData = ref({
      startTime: props.initialValue?.startTime,
      endTime: props.initialValue?.endTime,
    })

    const isValidRange = computed(() => {
      const start = time.toInteger(formData.value?.startTime)
      const end = time.toInteger(formData.value?.endTime)
      if (isNaN(start) || isNaN(end)) return true
      return start <= end
    })

    const timeOpts = new Array(24 * 4).fill().map((e, index) => {
      const value = time.fromInteger(index * 15)
      return {
        value: value,
        label: time.to12Hour(value),
      }
    })

    function submit() {
      onDialogOK(formData.value)
      $emit('submit', formData.value)
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      formData,
      isValidRange,
      timeOpts,
      submit,
    }

  },
})
</script>
