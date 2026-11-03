<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="rounded-borders column no-wrap" style="width:100%;max-width:560px;max-height:85vh;">
      <div class="q-pa-md row items-center no-wrap">
        <div class="text-h6 q-space">
          {{ discount?.name || $t('Discount', 'Discount') }}
        </div>
        <q-btn flat icon="close" padding="sm" v-close-popup />
      </div>

      <q-separator />

      <div class="q-pa-md col overflow-auto">
        <div v-if="loading" class="text-center q-pa-md">
          <q-spinner color="brandblue" />
        </div>
        <div v-else class="q-gutter-y-md">
          <div class="q-gutter-y-sm">
            <div class="text-subtitle2">{{ $t('Details') }}</div>
            <div class="row items-center">
              <div class="text-grey q-space">{{ $t('Code') }}</div>
              <div>{{ getDiscountCodeLabel(discount?.code) }}</div>
            </div>
            <div class="row items-center">
              <div class="text-grey q-space">{{ $t('Scope', 'Scope') }}</div>
              <div>{{ getDiscountScopeLabel(discount?.scope) }}</div>
            </div>
            <div class="row items-center">
              <div class="text-grey q-space">{{ $t('Type', 'Type') }}</div>
              <div class="row items-center q-gutter-x-xs">
                <span>{{ getDiscountTypeLabel(discount?.type) }}</span>
                <q-chip
                  v-if="isPerUnitDiscount(discount)"
                  dense
                  size="sm"
                  color="teal-1"
                  text-color="dark"
                >
                  {{ $t('PerUnit', 'Per unit') }}
                </q-chip>
              </div>
            </div>
            <div class="row items-center">
              <div class="text-grey q-space">{{ $t('Value', 'Value') }}</div>
              <div>{{ formatDiscountValue(discount, { includeMax: false }) }}</div>
            </div>
            <div v-if="Number.isFinite(discount?.maxAmount)" class="row items-center">
              <div class="text-grey q-space">{{ $t('MaxAmount', 'Max amount') }}</div>
              <div>{{ Number(discount.maxAmount.toFixed(2)) }} {{ getDiscountCurrencySymbol(discount) }}</div>
            </div>
            <div v-if="discount?.source" class="row items-center">
              <div class="text-grey q-space">{{ $t('Source') }}</div>
              <div>{{ discount.source === 'custom' ? $t('Custom') : $t('Platform') }}</div>
            </div>
          </div>

          <template v-if="hasUsageInfo">
            <q-separator />
            <div class="q-gutter-y-sm">
              <div class="text-subtitle2">
                {{ $t('UsageAndValidity', 'Usage & Validity') }}
              </div>
              <div v-if="discount?.activationCode" class="row items-center">
                <div class="text-grey q-space">{{ $t('ActivationCode', 'Activation code') }}</div>
                <div>{{ discount.activationCode }}</div>
              </div>
              <div v-if="redemptionLimitsText" class="row items-center">
                <div class="text-grey q-space">{{ $t('RedemptionLimits', 'Redemption limits') }}</div>
                <div>{{ redemptionLimitsText }}</div>
              </div>
              <div v-if="redeemableAmountsText" class="row items-center">
                <div class="text-grey q-space">{{ $t('MaxRedeemableAmount', 'Max redeemable amount') }}</div>
                <div>{{ redeemableAmountsText }}</div>
              </div>
              <div v-if="getDiscountDateRangeText(discount)" class="row items-center">
                <div class="text-grey q-space">{{ $t('Valid', 'Valid') }}</div>
                <div>{{ getDiscountDateRangeText(discount) }}</div>
              </div>
            </div>
          </template>

          <template v-if="showReport">
            <q-separator />
            <div class="q-gutter-y-sm">
              <div class="row items-center">
                <div class="text-subtitle2 q-space">
                  {{ $t('DiscountReport', {}, 'Discount report') }}
                </div>
                <q-btn
                  v-if="report && !reportLoading"
                  flat
                  dense
                  round
                  icon="refresh"
                  size="sm"
                  :aria-label="$t('Refresh', {}, 'Refresh')"
                  @click="fetchReport"
                />
              </div>

              <div class="row items-center q-gutter-x-sm">
                <q-btn-dropdown
                  outline
                  no-caps
                  color="brandblue"
                  padding="xs sm"
                  icon="date_range"
                  :label="reportRangeLabel"
                  :disable="reportLoading"
                >
                  <q-list>
                    <q-item
                      v-for="option in reportRangeOptions"
                      :key="option.value"
                      clickable
                      v-close-popup
                      :active="reportRangeKey === option.value"
                      @click="selectReportRange(option.value)"
                    >
                      <q-item-section>
                        <q-item-label>{{ option.label }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>

              <div v-if="reportLoading" class="text-center q-pa-md">
                <q-spinner color="brandblue" />
              </div>

              <div v-else-if="reportError" class="text-center q-pa-sm">
                <div class="text-body2 text-grey">{{ reportError }}</div>
                <q-btn
                  outline
                  no-caps
                  color="brandblue"
                  class="q-mt-sm"
                  :label="$t('Retry', {}, 'Retry')"
                  @click="fetchReport"
                />
              </div>

              <DiscountReport v-else-if="report" :report="report" />

              <div v-else class="text-center q-pa-sm text-grey">
                {{ $t('NoReportData', {}, 'No report data available.') }}
              </div>
            </div>
          </template>

          <template v-if="conditionCount > 0">
            <q-separator />
            <div>
              <div
                class="row items-center cursor-pointer"
                role="button"
                tabindex="0"
                :aria-expanded="showConditions ? 'true' : 'false'"
                @click="showConditions = !showConditions"
                @keydown.enter.prevent="showConditions = !showConditions"
                @keydown.space.prevent="showConditions = !showConditions"
              >
                <div class="text-subtitle2 q-space">{{ $t('Conditions') }}</div>
                <q-chip dense size="sm" color="blue-1" text-color="dark">
                  {{ conditionCount }}
                </q-chip>
                <q-icon
                  :name="showConditions ? 'keyboard_arrow_up' : 'keyboard_arrow_down'"
                  size="20px"
                  color="grey-7"
                />
              </div>
              <div v-if="showConditions" class="q-mt-sm">
                <DiscountConditionGroupForm
                  :key="conditionsKey"
                  :model-value="conditionGroupsData"
                  :current-depth="1"
                  :max-depth="3"
                  readonly
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <template v-if="$slots.actions">
        <q-separator />
        <div class="q-pa-md actions-footer">
          <slot name="actions" :discount-type="discount" />
        </div>
      </template>
    </q-card>

    <q-dialog v-model="showReportCustomRange">
      <q-card style="width: 100%; max-width: 360px;">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ $t('CustomRange', {}, 'Custom range') }}</div>
          <q-space />
          <q-btn flat round icon="close" padding="sm" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-pa-md">
          <DateRangeWheelPicker v-model="reportCustomRangeDraft" />
        </q-card-section>
        <q-separator />
        <q-card-actions align="right">
          <q-btn flat no-caps :label="$t('Cancel')" v-close-popup />
          <q-btn
            no-caps
            color="brandblue"
            :label="$t('Apply', {}, 'Apply')"
            :disable="!isReportCustomRangeComplete"
            @click="applyReportCustomRange"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { DiscountType } from 'src/marketplace/objects'
import { useDiscountFormHelpers, useDiscountTypeHelpers } from 'src/composables/marketplace/discount'
import DiscountConditionGroupForm from 'src/components/marketplace/discounts/DiscountConditionGroupForm.vue'
import DiscountReport from 'src/components/marketplace/discounts/DiscountReport.vue'
import DateRangeWheelPicker from 'src/components/DateRangeWheelPicker.vue'
import { useDiscountReportHelpers } from 'src/composables/marketplace/discountReport'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { formatDateToText } from 'src/marketplace/utils'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'DiscountTypeDetailDialog',
  components: {
    DiscountConditionGroupForm,
    DiscountReport,
    DateRangeWheelPicker,
  },
  props: {
    modelValue: Boolean,
    discountType: Object,
    // Opt-in historical report for this discount.
    showReport: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { t: $t } = useI18n()
    const { dialogRef, onDialogHide } = useDialogPluginComponent()
    const { parseReportError } = useDiscountReportHelpers()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => (innerVal.value = props.modelValue))
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    const {
      getDiscountCodeLabel,
      getDiscountScopeLabel,
      getDiscountTypeLabel,
      getDiscountCurrencySymbol,
      isPerUnitDiscount,
      formatDiscountValue,
      getDiscountDateRangeText,
    } = useDiscountTypeHelpers()

    // Start from the (partial) list payload, then enrich with the full
    // discount when the retrieve endpoint responds.
    const discount = ref(props.discountType)
    const loading = ref(false)

    // Historical report, fetched only while the dialog is open and the
    // showReport prop is enabled.
    const marketplaceStore = useMarketplaceStore()
    const shopId = computed(
      () => marketplaceStore.shopData?.id || marketplaceStore.activeShopId,
    )
    const report = ref(null)
    const reportLoading = ref(false)
    const reportError = ref('')
    let reportRequestId = 0

    const reportRangeKey = ref('last30')
    const reportRangeOptions = computed(() => [
      { value: 'today', label: $t('Today', {}, 'Today') },
      { value: 'yesterday', label: $t('Yesterday', {}, 'Yesterday') },
      { value: 'last7', label: $t('Last7Days', {}, 'Last 7 days') },
      { value: 'last30', label: $t('Last30Days', {}, 'Last 30 days') },
      { value: 'last90', label: $t('Last90Days', {}, 'Last 90 days') },
      { value: 'thisMonth', label: $t('ThisMonth', {}, 'This month') },
      { value: 'custom', label: $t('CustomRange', {}, 'Custom range') },
    ])
    const reportRangeLabel = computed(() => {
      if (reportRangeKey.value === 'custom') {
        const from = reportCustomRange.value?.from
        const to = reportCustomRange.value?.to
        if (from && to) {
          const fromText = formatDateToText(new Date(`${from}T00:00:00`))
          const toText = formatDateToText(new Date(`${to}T00:00:00`))
          return `${fromText} – ${toText}`
        }
        return $t('CustomRange', {}, 'Custom range')
      }
      return (
        reportRangeOptions.value.find(
          (option) => option.value === reportRangeKey.value,
        )?.label || $t('Last30Days', {}, 'Last 30 days')
      )
    })
    const reportCustomRange = ref({ from: '', to: '' })
    const reportCustomRangeDraft = ref({ from: '', to: '' })
    const showReportCustomRange = ref(false)
    const isReportCustomRangeComplete = computed(() =>
      Boolean(
        reportCustomRangeDraft.value?.from &&
          reportCustomRangeDraft.value?.to,
      ),
    )

    // Collapsible "Conditions" section. The list/detail payload carries flat
    // condition groups (parentId linked) which get converted to the nested
    // shape the (readonly) condition group form expects.
    const { convertFlatConditionGroupsToFormData } = useDiscountFormHelpers()
    const showConditions = ref(false)
    const conditionsKey = ref(0)
    const conditionCount = computed(() => {
      if (!Array.isArray(discount.value?.conditionGroups)) return 0
      return discount.value.conditionGroups.reduce(
        (total, group) => total + (Array.isArray(group?.conditions) ? group.conditions.length : 0),
        0,
      )
    })
    const conditionGroupsData = computed(() =>
      convertFlatConditionGroupsToFormData(discount.value?.conditionGroups),
    )

    // Usage & validity values. Limits are rendered on a single row so the total
    // and the per-customer cap read as one setting instead of two look-alike
    // rows with the same "Per customer" label.
    function formatAmountValue(value, discountType) {
      const amount = Number(value)
      if (!Number.isFinite(amount)) return ''
      const currency = getDiscountCurrencySymbol(discountType)
      const text = String(Number(amount.toFixed(2)))
      return currency ? `${text} ${currency}` : text
    }

    function formatLimitValue(total, perCustomer, formatValue) {
      const format = typeof formatValue === 'function' ? formatValue : (value) => String(value)
      const hasTotal = total !== null && total !== undefined && total !== ''
      const hasPerCustomer =
        perCustomer !== null && perCustomer !== undefined && perCustomer !== ''
      if (!hasTotal && !hasPerCustomer) return ''
      if (!hasTotal) {
        return $t(
          'PerCustomerLimitValue',
          { value: format(perCustomer) },
          '{value} per customer',
        )
      }
      const totalText = format(total)
      if (!hasPerCustomer) return totalText
      return $t(
        'TotalAndPerCustomerLimitValue',
        { total: totalText, perCustomer: format(perCustomer) },
        '{total} ({perCustomer} per customer)',
      )
    }

    const redemptionLimitsText = computed(() =>
      formatLimitValue(
        discount.value?.maxRedemptions,
        discount.value?.maxRedemptionsPerCustomer,
      ),
    )
    const redeemableAmountsText = computed(() =>
      formatLimitValue(
        discount.value?.maxRedeemableAmount,
        discount.value?.maxRedeemableAmountPerCustomer,
        (value) => formatAmountValue(value, discount.value),
      ),
    )
    const hasUsageInfo = computed(() =>
      Boolean(
        discount.value?.activationCode ||
          redemptionLimitsText.value ||
          redeemableAmountsText.value ||
          getDiscountDateRangeText(discount.value),
      ),
    )

    function toDateInput(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    function resolveReportRange() {
      if (reportRangeKey.value === 'custom') {
        const from = reportCustomRange.value?.from
        const to = reportCustomRange.value?.to
        if (!from || !to) return null
        return {
          from: new Date(`${from}T00:00:00`),
          to: new Date(`${to}T23:59:59.999`),
        }
      }

      const now = new Date()
      const to = new Date(now)
      to.setHours(23, 59, 59, 999)
      const from = new Date(now)

      switch (reportRangeKey.value) {
        case 'today':
          from.setHours(0, 0, 0, 0)
          break
        case 'yesterday':
          from.setDate(from.getDate() - 1)
          from.setHours(0, 0, 0, 0)
          to.setDate(to.getDate() - 1)
          to.setHours(23, 59, 59, 999)
          break
        case 'last7':
          from.setDate(from.getDate() - 6)
          from.setHours(0, 0, 0, 0)
          break
        case 'last90':
          from.setDate(from.getDate() - 89)
          from.setHours(0, 0, 0, 0)
          break
        case 'thisMonth':
          from.setDate(1)
          from.setHours(0, 0, 0, 0)
          break
        case 'last30':
        default:
          from.setDate(from.getDate() - 29)
          from.setHours(0, 0, 0, 0)
          break
      }

      return { from, to }
    }

    function selectReportRange(value) {
      if (value === 'custom') {
        openReportCustomRange()
        return
      }
      reportRangeKey.value = value
      fetchReport()
    }

    function openReportCustomRange() {
      const range = resolveReportRange()
      const from = range?.from || new Date()
      const to = range?.to || new Date()
      if (!range) {
        from.setDate(from.getDate() - 29)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
      }
      reportCustomRangeDraft.value = {
        from: toDateInput(from),
        to: toDateInput(to),
      }
      showReportCustomRange.value = true
    }

    function applyReportCustomRange() {
      if (!isReportCustomRangeComplete.value) return
      const { from, to } = reportCustomRangeDraft.value
      reportCustomRange.value = { from, to }
      reportRangeKey.value = 'custom'
      showReportCustomRange.value = false
      fetchReport()
    }

    function fetchReport() {
      const range = resolveReportRange()
      if (
        !props.showReport ||
        !discount.value?.id ||
        !shopId.value ||
        !range ||
        Number.isNaN(range.from.getTime()) ||
        Number.isNaN(range.to.getTime())
      ) {
        report.value = null
        reportError.value = ''
        reportLoading.value = false
        return Promise.resolve()
      }

      const requestId = ++reportRequestId
      reportLoading.value = true
      reportError.value = ''
      return backend
        .post('reports/discount-types/forecast/', {
          discount_id: discount.value.id,
          shop_id: shopId.value,
          mode: 'history',
          timezone: new Date().getTimezoneOffset() * 60,
          timestamp_from: range.from.toISOString(),
          timestamp_to: range.to.toISOString(),
        })
        .then((response) => {
          if (requestId !== reportRequestId) return
          const data = response?.data
          if (!data || !Array.isArray(data.summaries)) {
            return Promise.reject({ response })
          }
          report.value = data
        })
        .catch((error) => {
          if (requestId !== reportRequestId) return
          report.value = null
          reportError.value = parseReportError(error, { mode: 'history' })
        })
        .finally(() => {
          if (requestId === reportRequestId) reportLoading.value = false
        })
    }

    // The form reads its model on setup only, so remount it whenever the
    // discount record is replaced, and collapse it when moving to another row.
    watch(discount, () => { conditionsKey.value += 1 })
    watch(() => props.discountType?.id, () => { showConditions.value = false })

    function fetchDiscount() {
      if (!props.discountType?.id) return Promise.resolve()
      loading.value = true
      return backend.get(`discount-types/${props.discountType.id}/`)
        .then(response => {
          if (response?.data?.id) discount.value = DiscountType.parse(response.data)
          return response
        })
        .catch(() => {})
        .finally(() => {
          loading.value = false
        })
    }

    onMounted(() => fetchDiscount())
    watch(() => [props.discountType?.id], () => {
      discount.value = props.discountType
      fetchDiscount()
    })

    watch(
      () => [props.showReport, innerVal.value, discount.value?.id, shopId.value],
      () => {
        if (!props.showReport || !innerVal.value) {
          reportRequestId += 1
          report.value = null
          reportError.value = ''
          reportLoading.value = false
          return
        }
        fetchReport()
      },
      { immediate: true },
    )

    return {
      dialogRef,
      onDialogHide,
      innerVal,
      discount,
      loading,
      showConditions,
      conditionsKey,
      conditionCount,
      conditionGroupsData,
      hasUsageInfo,
      redemptionLimitsText,
      redeemableAmountsText,
      report,
      reportLoading,
      reportError,
      reportRangeKey,
      reportRangeOptions,
      reportRangeLabel,
      reportCustomRangeDraft,
      showReportCustomRange,
      isReportCustomRangeComplete,
      selectReportRange,
      applyReportCustomRange,
      fetchReport,
      getDiscountCodeLabel,
      getDiscountScopeLabel,
      getDiscountTypeLabel,
      getDiscountCurrencySymbol,
      isPerUnitDiscount,
      formatDiscountValue,
      getDiscountDateRangeText,
    }
  },
})
</script>
<style scoped>
.actions-footer {
  width: 100%;
  max-width: 350px;
  margin-left: auto;
  margin-right: auto;
}
.actions-footer :deep(.q-btn-dropdown--split) {
  width: 100%;
}
.actions-footer :deep(.q-btn-dropdown--split > .q-btn-item) {
  flex: 1 1 auto;
  min-width: 0;
}
.actions-footer :deep(.q-btn-dropdown--split > .q-btn-dropdown__arrow-container) {
  flex: 0 0 auto;
}
</style>
