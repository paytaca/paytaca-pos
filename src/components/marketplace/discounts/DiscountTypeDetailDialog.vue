<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-pa-md rounded-borders" style="width:100%;max-width:560px;max-height:85vh;overflow:auto;">
      <div class="row items-center no-wrap q-mb-sm">
        <div class="text-h6 q-space">
          {{ discount?.name || $t('Discount', 'Discount') }}
        </div>
        <q-btn flat icon="close" padding="sm" v-close-popup />
      </div>

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
      </div>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { DiscountType } from 'src/marketplace/objects'
import { useDiscountTypeHelpers } from 'src/composables/marketplace/discount'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'DiscountTypeDetailDialog',
  props: {
    discountType: Object,
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props) {
    const { t: $t } = useI18n()
    const { dialogRef, onDialogHide } = useDialogPluginComponent()
    const {
      getDiscountCodeLabel,
      getDiscountScopeLabel,
      getDiscountTypeLabel,
      getDiscountCurrencySymbol,
      formatDiscountValue,
      getDiscountDateRangeText,
    } = useDiscountTypeHelpers()

    // Start from the (partial) regime payload, then enrich with the full
    // discount when the retrieve endpoint responds.
    const discount = ref(props.discountType)
    const loading = ref(false)

    onMounted(() => {
      if (!props.discountType?.id) return
      loading.value = true
      backend.get(`discount-types/${props.discountType.id}/`)
        .then(response => {
          if (response?.data?.id) discount.value = DiscountType.parse(response.data)
          return response
        })
        .catch(() => {})
        .finally(() => {
          loading.value = false
        })
    })

    return {
      dialogRef,
      onDialogHide,
      discount,
      loading,
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
