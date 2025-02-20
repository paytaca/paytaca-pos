<template>
  <div>
    <q-card class="q-mb-md">
      <q-card-section>
        <q-form @submit="() => saveStorefrontHours()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-md">
            <div v-for="(errorMsg, index) in formErrors?.detail" :key="index" class="banner-error">
              {{ errorMsg }}
            </div>
          </q-banner>
          <div class="text-subtitle1">Status</div>
          <q-field
            dense
            borderless
            v-model="formData.openStatus"
            :error="Boolean(formErrors?.openStatus)"
            :error-message="formErrors?.openStatus"
          >
            <template v-slot:control>
              <div class="full-width">
                <q-btn-toggle
                  :push="$q.dark.isActive"
                  no-caps
                  spread
                  :disable="loading"
                  v-model="formData.openStatus"
                  toggle-color="brandblue"
                  :options="[
                    {label: 'Open', value: 'open'},
                    {label: 'Closed', value: 'closed'},
                    {label: 'Auto', value: 'auto'},
                  ]"
                />
              </div>
            </template>
          </q-field>
          <div :class="[disableHours ? 'text-grey' : '']">
            <div class="row items-center">
              <div class="text-subtitle1">Hours</div>
              <q-space/>
              <q-btn flat round :disable="disableHours" icon="add" padding="sm" @click="() => openTimeForm()"/>
            </div>
            <q-banner v-if="deviceOffsetHours" rounded class="bg-cyan text-white q-my-xs">
              <template v-slot:avatar>
                <q-icon name="info"  size="1.5rem"/>
              </template>
              <template v-if="deviceOffsetHours > 0">
                {{
                  $t(
                    'ShopTimezoneOffsetAhead', { hours: deviceOffsetHours },
                    `You are ${deviceOffsetHours} hours ahead of the shop address' timezone`
                  )
                }}
              </template>
              <template v-else-if="deviceOffsetHours < 0">
                {{
                  $t(
                    'ShopTimezoneOffsetBehind', { hours: deviceOffsetHours },
                    `You are ${deviceOffsetHours * -1} hour/s behind of shop address' timezone`
                  )
                }}
              </template>
            </q-banner>
            <table class="full-width">
              <colgroup>
                <col span="1" style="width: 15%;">
                <col span="1" style="width: 85%;">
              </colgroup>
              <tr v-for="(weekday, index) in weekdays" :key="index">
                <td style="vertical-align:top;">
                  <q-field
                    dense
                    borderless
                    v-model="formData.openStatus"
                    :error="Boolean(formErrors?.weekdays?.[index])"
                    :error-message="formErrors?.weekdays?.[index]"
                  >
                    <template v-slot:control>
                      <div class="text-subtitle2">{{ weekday.substring(0, 3) }}</div>
                    </template>
                  </q-field>
                </td>
                <td style="vertical-align: top;">
                  <div class="text-center text-grey q-py-sm q-mt-xs visible-only-child"> No hours set </div>
                  <div
                    v-for="(weeklyHour, index) in formData.weeklyHours.filter(e => e?.weekday == index)"
                    :key="index"
                    class="row items-center no-wrap"
                  >
                    <q-btn
                      :disable="disableHours || loading"
                      flat no-caps padding="sm"
                      class="q-space"
                      @click="() => editWeeklyHour(weeklyHour)"
                    >
                      <div>{{ weeklyHourToText(weeklyHour) }}</div>
                      <q-icon name="edit" class="q-ml-xs"/>
                    </q-btn>
                    <q-separator vertical inset spaced/>
                    <q-btn
                      :disable="disableHours || loading"
                      flat icon="close" padding="sm" color="red"
                      @click="() => formData.weeklyHours = formData.weeklyHours.filter(e => e !== weeklyHour)"
                    />
                  </div>
                </td>
              </tr>
            </table>
          </div>
          <div class="q-mt-sm">
            <q-btn
              no-caps label="Save"
              color="brandblue"
              class="full-width"
              type="submit"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </div>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { errorParser, time } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, ref } from 'vue'
import StorefrontTimeFormDialog from './StorefrontTimeFormDialog.vue'

export default defineComponent({
  name: 'StorefrontHoursForm',
  emits: [
    'saved',
  ],
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    onMounted(async () => {
      if (marketplaceStore.storefrontHoursData?.id != marketplaceStore?.storefrontData?.id) {
        loading.value = true
        await marketplaceStore.fetchStorefrontHours()
          .finally(() => {
            loading.value = false
          })
      }
      resetFormData()
    })

    const deviceOffset = computed(() => {
      const utcOffset = marketplaceStore.shopData?.location?.utc_offset / 60
      if (!Number.isSafeInteger(utcOffset)) return null
      const deviceUTCOffset = new Date().getTimezoneOffset()
      return utcOffset - deviceUTCOffset
    })
    const deviceOffsetHours = computed(() => {
      if (Number.isNaN(deviceOffset.value)) return null

      const MIN_PRECISION = 15 // minutes
      const rounded = MIN_PRECISION * Math.round(deviceOffset.value / MIN_PRECISION)
      return rounded / 60
    })

    const weekdays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]

    let weeklyHourCtr = 0
    function createEmptyWeeklyHour() {
      return {
        _index: ++weeklyHourCtr,
        weekday: -1,
        startTime: '',
        endTime: '',
      }
    }

    const loading = ref(false)
    const formData = ref({
      openStatus: '',
      weeklyHours: [].map(() => createEmptyWeeklyHour()),
    })
    const disableHours = computed(() => formData.value.openStatus != 'auto')
    const hasConflictingTimeslots = computed(() => {
      return weekdays.map((weekday, index) => {
        return formData.value.weeklyHours
          .filter(weeklyHour => weeklyHour?.weekday == index)
          .some((weeklyHour1, index, list) => {
            const sublist = list.slice(index+1)
            return sublist.some(weeklyHour2 => time.isConflict(weeklyHour1, weeklyHour2))
          })
      })
    })

    function resetFormData() {
      formData.value.openStatus = marketplaceStore.storefrontHoursData?.open_status
      formData.value.weeklyHours = marketplaceStore.storefrontHoursData?.weekly_hours.map(weeklyHourData => {
        const weeklyHour = createEmptyWeeklyHour()
        weeklyHour.weekday = weeklyHourData?.weekday
        weeklyHour.startTime = time.to24Hour(weeklyHourData?.start_time)
        weeklyHour.endTime = time.to24Hour(weeklyHourData?.end_time)
        return weeklyHour
      })
    }

    function reorderWeeklyHours() {
      formData.value.weeklyHours.sort((slot1, slot2) => {
        if (slot1.weekday !== slot2.weekday) return slot1.weekday - slot2.weekday

        const start1 = time.toInteger(slot1.startTime)
        const start2 = time.toInteger(slot2.startTime)
        return start1 - start2
      })
    }

    function createEmptyFormErrors() {
      return { detail: [], openStatus: '', weekdays: [] }
    }
    const formErrors = ref(createEmptyFormErrors())
    function resetFormErrors() {
      formErrors.value = createEmptyFormErrors()
    }

    const timeOpts = new Array(24 * 4).fill().map((e, index) => {
      const value = time.fromInteger(index * 15)
      return {
        value: value,
        label: time.to12Hour(value),
      }
    })

    /**
     * @param {Object} weeklyHour
     * @param {Number} weeklyHour.weekday
     * @param {String} weeklyHour.startTime
     * @param {String} weeklyHour.endTime
     */
    function weeklyHourToText(weeklyHour) {
      if (!weeklyHour) return ''
      return `${time.to12Hour(weeklyHour?.startTime)} - ${time.to12Hour(weeklyHour?.endTime)}`
    }

    /**
     * @param {Object} weeklyHour
     * @param {Number} weeklyHour.weekday
     * @param {String} weeklyHour.startTime
     * @param {String} weeklyHour.endTime
     */
    function editWeeklyHour(weeklyHour) {
      if (!weeklyHour) return

      const weekdayStr = weekdays[weeklyHour?.weekday]
      if (!weekdayStr) return


      $q.dialog({
        component: StorefrontTimeFormDialog,
        componentProps: {
          title: weekdayStr,
          subtitle: weeklyHourToText(weeklyHour),
          hideWeekdays: true,
          existingTimeslots: formData.value.weeklyHours
            .filter(slot => slot?.weekday === weeklyHour.weekday)
            .filter(slot => slot?._index !== weeklyHour._index),
          initialValue: {
            weekdays: [weeklyHour.weekday],
            startTime: weeklyHour?.startTime,
            endTime: weeklyHour?.endTime,
          }
        },
      }).onOk(payload => {
        weeklyHour.startTime = time.to24Hour(payload?.startTime)
        weeklyHour.endTime = time.to24Hour(payload?.endTime)
        reorderWeeklyHours()
      })
    }

    function openTimeForm() {
      $q.dialog({
        component: StorefrontTimeFormDialog,
        componentProps: {
          existingTimeslots: formData.value.weeklyHours,
        },
      }).onOk(value => {
        const weekdays = value?.weekdays
        if (!Array.isArray(weekdays)) return

        const startTimeInt = time.toInteger(value?.startTime)
        const endTimeInt = time.toInteger(value?.endTime)
        if (Number.isNaN(startTimeInt) || Number.isNaN(endTimeInt)) return
        if (startTimeInt > endTimeInt) return

        const parsedStartTime = time.to24Hour(value.startTime)
        const parsedEndTime = time.to24Hour(value.endTIme)
        const weeklyHours = weekdays.map(weekday => {
          const weeklyHour = createEmptyWeeklyHour()
          weeklyHour.weekday = weekday
          weeklyHour.startTime = parsedStartTime
          weeklyHour.endTime = parsedEndTime
          return weeklyHour
        })

        formData.value.weeklyHours.push(...weeklyHours)
        reorderWeeklyHours()
      })
    }

    function saveStorefrontHours() {
      const storefrontId = marketplaceStore?.storefrontData?.id
      const data = {
        open_status: formData.value.openStatus,
        weekly_hours: disableHours.value ? undefined : formData.value.weeklyHours.map(weeklyHour => {
          return {
            weekday: weeklyHour?.weekday,
            start_time: weeklyHour?.startTime,
            end_time: weeklyHour?.endTime,
          }
        })
      }

      loading.value = true
      return backend.post(`connecta/storefronts/${storefrontId}/weekly_hours/`, data)
        .finally(() => resetFormErrors())
        .then(response => {
          marketplaceStore.setStorefrontHoursData(response?.data)
          $emit('saved')
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.openStatus = errorParser.firstElementOrValue(data?.open_status)
          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]
          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered error in updating storefront hours']
          }
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      marketplaceStore,
      deviceOffsetHours,
      weekdays,
      loading,
      formData,
      disableHours,
      hasConflictingTimeslots,
      formErrors,
      timeOpts,
      weeklyHourToText,
      editWeeklyHour,
      openTimeForm,
      saveStorefrontHours,
      time,
    }
  },
})
</script>
<style lang="scss" scoped>
.q-banner .banner-error:not(:only-child) {
  display: list-item;
  margin-left: 0.75em;
}

.visible-only-child:not(:only-child) {
  display: none;
}
</style>