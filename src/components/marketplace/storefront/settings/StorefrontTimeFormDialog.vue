<template>
  <q-dialog ref="dialogRef" v-model="innerVal" position="bottom" @hide="onDialogHide">
    <q-card>
      <q-card-section>
        <div class="row items-center no-wrap q-mb-md">
          <div class="q-space">
            <div class="text-h5">{{ title }}</div>
            <div class="text-caption"> {{ subtitle }}</div>
          </div>
          <q-space/>
          <q-btn flat icon="close" padding="sm"/>
        </div>
        <q-form
          ref="form"
          @submit="onSubmit"
          @reset="() => displayManualErrors = false"
        >
          <q-banner
            v-if="manualErrors?.length && displayManualErrors"
            class="bg-red text-white rounded-borders q-mb-md"
          >
            <div v-if="manualErrors?.length === 1">
              {{ manualErrors[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in manualErrors" :key="index">
                {{ err }}
              </li>
            </ul>
          </q-banner>
          <div v-if="!hideWeekdays" class="row items-center justify-center q-gutter-md q-mb-md">
            <q-btn
              v-for="(weekday, index) in weekdays" :key="weekday"
              no-caps :label="weekday"
              rounded
              :color="formData.weekdays.includes(index) ? 'brandblue' : ''"
              @click="() => toggleWeekday(index)"
            />
          </div>
          <div class="row items-center no-wrap q-mb-md">
            <q-input
              dense
              outlined
              label="Start time"
              mask="##:## AM"
              v-model="formData.startTime"
              lazy-rules
              :rules="[
                val => Boolean(val) || 'Required',
                val => Boolean(validateTimeStr(val)) || 'Invalid time',
              ]"
            />
            <q-input
              dense
              outlined
              label="End time"
              mask="##:## AM"
              v-model="formData.endTime"
              lazy-rules
              :rules="[
                val => Boolean(val) || 'Required',
                val => Boolean(validateTimeStr(val)) || 'Invalid time',
              ]"
            /> 
          </div>
          <q-btn no-caps :label="$t('OK')" color="brandblue" class="full-width" type="submit"/>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { time } from 'src/marketplace/utils';
import { useDialogPluginComponent } from 'quasar';
import { defineComponent, ref, computed, watch, onMounted } from 'vue';


export default defineComponent({
  name: 'StorefrontTimeFormDialog',
  emits: [
    ...useDialogPluginComponent.emits,
    'update:modelValue',
  ],
  props: {
    modelValue: Boolean,
    title: {
      type: String,
      default: 'Select days and hours',
    },
    subtitle: String,
    hideWeekdays: Boolean,
    existingTimeslots: {
      default() {
        return [].map(() => {
          return { weekday: -1, startTime: '', endTime: '' }
        })
      }
    },
    initialValue: {
      default: () => {
        return {
          weekdays: [],
          startTime: '',
          endTime: '',
        }
      }
    }
  },
  setup(props, { emit: $emit }) {
    
    const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } = useDialogPluginComponent();
    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    watch(() => props.modelValue, () => innerVal.value = props.modelValue)


    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const form = ref()
    const formData = ref({
      weekdays: [].map(Number),
      startTime: '',
      endTime: '',
    })

    const displayManualErrors = ref(false)
    const conflictingSchedules = computed(() => {
      if (!Array.isArray(props.existingTimeslots) || !props.existingTimeslots.length) return []

      const startTimeInt = time.toInteger(formData.value.startTime)
      const endTimeInt = time.toInteger(formData.value.endTime)
      if (Number.isNaN(startTimeInt) || Number.isNaN(endTimeInt)) return []

      const conflicts = []

      formData.value.weekdays.forEach(weekday => {
        const timeslots = props.existingTimeslots
          .filter(timeslot => {
            if (timeslot?.weekday !== weekday) return false
            return time.isConflict(formData.value, timeslot)
          })

        conflicts.push(...timeslots)
      })

      return conflicts
    })
    const manualErrors = computed(() => {
      const errors = []
      if (!Array.isArray(formData.value.weekdays) || !formData.value.weekdays.length && !props.hideWeekdays) {
        errors.push('Select days of week')
      }

      const startTimeInt = time.toInteger(formData.value.startTime)
      const endTimeInt = time.toInteger(formData.value.endTime)
      if (startTimeInt >= endTimeInt) {
        errors.push('Start time must be before end time')
      }

      if (conflictingSchedules.value.length) {
        const conflictingSchedulesText = conflictingSchedules.value.map(timeslot => {
          return `(${weekdays[timeslot.weekday]}) ${time.to12Hour(timeslot?.startTime)} - ${time.to12Hour(timeslot?.endTime)}`
        }).join(', ')
        errors.push(`Time selected is conflict with: ${conflictingSchedulesText}`)
      }
      return errors
    })

    function resetFormData () {
      formData.value.weekdays = [...props.initialValue.weekdays],
      formData.value.startTime = time.to12Hour(props.initialValue.startTime)
      formData.value.endTime = time.to12Hour(props.initialValue.endTime)
      setTimeout(() => {
        form.value?.resetValidation?.()
      }, 100)
    }

    onMounted(() => resetFormData())
    watch(innerVal, () => {
      if (innerVal.value) resetFormData()
    })

    /**
     * @param {String | Number} weekday 
     */
    function toggleWeekday(weekday) {
      if (typeof weekday === 'string') weekday = weekdays.indexOf(weekday)
      if (weekday < 0 || weekday >= weekdays.length) return

      const index = formData.value.weekdays.indexOf(weekday)
      if (index >= 0) formData.value.weekdays.splice(index, 1)
      else formData.value.weekdays.push(weekday)
    }

    function validateTimeStr(timeStr) {
      const val = time.toInteger(timeStr)
      return val >= 0 && val < 24 * 60
    }

    function onSubmit() {
      if (manualErrors.value.length) {
        displayManualErrors.value = true
        return
      }
      onDialogOK(formData.value)
    }

    return {
      dialogRef, onDialogCancel, onDialogHide, onDialogOK,

      innerVal,

      weekdays,
      form,
      formData,
      displayManualErrors,
      manualErrors,
      toggleWeekday,
      validateTimeStr,

      onSubmit,
    }
  },
})
</script>