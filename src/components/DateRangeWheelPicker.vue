<template>
  <div class="date-range-wheel-picker">
    <div class="row no-wrap items-start">
      <div class="date-range-wheel-picker__column">
        <div class="date-range-wheel-picker__label">
          {{ $t('From', {}, 'From') }}
        </div>
        <WheelColumn v-model="fromValue" :items="dateItems" />
      </div>
      <div class="date-range-wheel-picker__column">
        <div class="date-range-wheel-picker__label">
          {{ $t('To', {}, 'To') }}
        </div>
        <WheelColumn v-model="toValue" :items="dateItems" />
      </div>
    </div>

    <div v-if="showDayCount" class="date-range-wheel-picker__days">
      {{ dayCountText }}
    </div>
  </div>
</template>

<script>
import { computed, defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import WheelColumn from 'src/components/WheelColumn.vue'

const DAY_MS = 24 * 60 * 60 * 1000
const AVAILABLE_DAYS = 365

export default defineComponent({
  name: 'DateRangeWheelPicker',
  components: {
    WheelColumn,
  },
  props: {
    modelValue: {
      type: Object,
      default: () => ({ from: '', to: '' }),
    },
    showDayCount: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const { t: $t } = useI18n()
    const locale = navigator.language || 'en-US'

    const dateFormatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    function toDateInput(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    function parseDateInput(value) {
      if (!value) return null
      const date = new Date(`${value}T00:00:00`)
      return Number.isNaN(date.getTime()) ? null : date
    }

    const dateItems = computed(() => {
      const items = []
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      for (let offset = 0; offset < AVAILABLE_DAYS; offset += 1) {
        const date = new Date(today)
        date.setDate(today.getDate() - offset)
        items.push({
          value: toDateInput(date),
          label: dateFormatter.format(date),
        })
      }

      return items
    })

    const fromValue = computed({
      get: () => props.modelValue?.from || '',
      set: (value) => {
        const to = props.modelValue?.to
        emit('update:modelValue', {
          from: value,
          to: !to || value > to ? value : to,
        })
      },
    })

    const toValue = computed({
      get: () => props.modelValue?.to || '',
      set: (value) => {
        const from = props.modelValue?.from
        emit('update:modelValue', {
          from: !from || value < from ? value : from,
          to: value,
        })
      },
    })

    const dayCount = computed(() => {
      const from = parseDateInput(props.modelValue?.from)
      const to = parseDateInput(props.modelValue?.to)
      if (!from || !to) return 0
      return Math.max(Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1, 0)
    })

    const dayCountText = computed(() => {
      const count = dayCount.value
      if (count === 1) return $t('OneDay', {}, '1 day')
      return $t('NumberOfDays', { count }, '{count} days')
    })

    return {
      dateItems,
      fromValue,
      toValue,
      dayCountText,
    }
  },
})
</script>

<style scoped>
.date-range-wheel-picker__column {
  flex: 1 1 0;
  min-width: 0;
}
.date-range-wheel-picker__column + .date-range-wheel-picker__column {
  margin-left: 8px;
}
.date-range-wheel-picker__label {
  margin-bottom: 4px;
  color: #757575;
  font-size: 12px;
  text-align: center;
}
.date-range-wheel-picker__days {
  margin-top: 8px;
  color: #757575;
  font-size: 13px;
  text-align: center;
}
body.body--dark .date-range-wheel-picker__label,
body.body--dark .date-range-wheel-picker__days {
  color: rgba(255, 255, 255, 0.7);
}
</style>
