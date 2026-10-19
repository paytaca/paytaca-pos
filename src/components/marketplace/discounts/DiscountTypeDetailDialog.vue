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
        <div v-else class="q-gutter-y-sm">
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
            <div>{{ getDiscountTypeLabel(discount?.type) }}</div>
          </div>
          <div class="row items-center">
            <div class="text-grey q-space">{{ $t('Value', 'Value') }}</div>
            <div>{{ formatDiscountValue(discount, { includeMax: false }) }}</div>
          </div>
          <div v-if="discount?.source" class="row items-center">
            <div class="text-grey q-space">{{ $t('Source') }}</div>
            <div>{{ discount.source === 'custom' ? $t('Custom') : $t('Platform') }}</div>
          </div>
          <div v-if="discount?.activationCode" class="row items-center">
            <div class="text-grey q-space">{{ $t('ActivationCode', 'Activation code') }}</div>
            <div>{{ discount.activationCode }}</div>
          </div>
          <div v-if="Number.isFinite(discount?.maxAmount)" class="row items-center">
            <div class="text-grey q-space">{{ $t('MaxAmount', 'Max amount') }}</div>
            <div>{{ Number(discount.maxAmount.toFixed(2)) }} {{ getDiscountCurrencySymbol(discount) }}</div>
          </div>
          <div v-if="discount?.maxRedemptions != null" class="row items-center">
            <div class="text-grey q-space">{{ $t('MaxRedemptions', 'Max redemptions') }}</div>
            <div>{{ discount.maxRedemptions }}</div>
          </div>
          <div v-if="getDiscountDateRangeText(discount)" class="row items-center">
            <div class="text-grey q-space">{{ $t('Valid', 'Valid') }}</div>
            <div>{{ getDiscountDateRangeText(discount) }}</div>
          </div>

          <div v-if="conditionCount > 0">
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
        </div>
      </div>

      <template v-if="$slots.actions">
        <q-separator />
        <div class="q-pa-md actions-footer">
          <slot name="actions" :discount-type="discount" />
        </div>
      </template>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { DiscountType } from 'src/marketplace/objects'
import { useDiscountFormHelpers, useDiscountTypeHelpers } from 'src/composables/marketplace/discount'
import DiscountConditionGroupForm from 'src/components/marketplace/discounts/DiscountConditionGroupForm.vue'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'DiscountTypeDetailDialog',
  components: {
    DiscountConditionGroupForm,
  },
  props: {
    modelValue: Boolean,
    discountType: Object,
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

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => (innerVal.value = props.modelValue))
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    const {
      getDiscountCodeLabel,
      getDiscountScopeLabel,
      getDiscountTypeLabel,
      getDiscountCurrencySymbol,
      formatDiscountValue,
      getDiscountDateRangeText,
    } = useDiscountTypeHelpers()

    // Start from the (partial) list payload, then enrich with the full
    // discount when the retrieve endpoint responds.
    const discount = ref(props.discountType)
    const loading = ref(false)

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
      getDiscountCodeLabel,
      getDiscountScopeLabel,
      getDiscountTypeLabel,
      getDiscountCurrencySymbol,
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
