<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="rounded-borders column no-wrap" style="width:100%;max-width:560px;max-height:85vh;">
      <div class="q-pa-md row items-center no-wrap">
        <div class="text-h6 q-space">
          {{ program?.name || $t('BenefitProgram', 'Benefit program') }}
        </div>
        <q-btn flat icon="close" padding="sm" v-close-popup />
      </div>

      <q-separator />

      <div class="q-pa-md col overflow-auto">
        <div v-if="loading" class="text-center q-pa-md">
          <q-spinner color="brandblue" />
        </div>
        <div v-else class="q-gutter-y-sm">
          <div
            v-if="program?.description"
            ref="descriptionEl"
            class="text-body2 text-grey-8 cursor-pointer"
            :class="{ 'description-clamped': !showFullDescription }"
            :title="showFullDescription ? undefined : $t('ClickToExpand', 'Click to view full description')"
            @click="showFullDescription = !showFullDescription"
          >
            {{ program.description }}
          </div>
          <div
            v-if="program?.description && isDescriptionLong"
            class="text-caption text-blue cursor-pointer q-mb-xs"
            @click="showFullDescription = !showFullDescription"
          >
            {{ showFullDescription ? $t('ShowLess', 'Show less') : $t('ShowMore', 'Show more') }}
          </div>

          <div v-if="program?.countryCode" class="row items-center">
            <div class="text-grey q-space">{{ $t('Country', 'Country') }}</div>
            <div>{{ program.countryCode }}</div>
          </div>
          <div v-if="program?.source" class="row items-center">
            <div class="text-grey q-space">{{ $t('Source') }}</div>
            <div>{{ program.source === 'custom' ? $t('Custom') : $t('Platform') }}</div>
          </div>

          <template v-if="program?.beneficiaryCategoryCodes?.length">
            <div class="text-subtitle2 q-mt-sm">{{ $t('BeneficiaryCategories', 'Beneficiary categories') }}</div>
            <div class="row q-gutter-xs">
              <q-chip
                v-for="code in program.beneficiaryCategoryCodes"
                :key="code"
                dense
                size="sm"
                color="blue-1"
                text-color="dark"
              >
                {{ code }}
              </q-chip>
            </div>
          </template>

          <div v-if="program?.taxType" class="row items-center q-mt-sm">
            <div class="text-grey q-space">{{ $t('TaxType', 'Tax type') }}</div>
            <div>{{ taxTypeLabel(program.taxType) }}</div>
          </div>

          <template v-if="program?.discounts?.length">
            <div class="text-subtitle2 q-mt-sm">{{ $t('Discounts') }}</div>
            <q-list dense>
              <q-item v-for="(discount, index) in program.discounts" :key="index">
                <q-item-section>
                  <q-item-label>{{ discount.name }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ getDiscountCodeLabel(discount.code) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  {{ formatDiscountValue(discount) }}
                </q-item-section>
              </q-item>
            </q-list>
          </template>
        </div>
      </div>

      <template v-if="$slots.actions">
        <q-separator />
        <div class="q-pa-md actions-footer">
          <slot name="actions" :benefit-program="program" />
        </div>
      </template>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { BenefitProgram } from 'src/marketplace/objects'
import { useTaxTypeHelpers } from 'src/composables/marketplace/taxTypesForm'
import { useDiscountTypeHelpers } from 'src/composables/marketplace/discount'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'BenefitProgramDetailDialog',
  props: {
    modelValue: Boolean,
    benefitProgram: Object,
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
    const { taxTypeLabel } = useTaxTypeHelpers()
    const { getDiscountCodeLabel, formatDiscountValue } = useDiscountTypeHelpers()

    // Start from the (partial) regime payload, then enrich with the full
    // program when the retrieve endpoint responds.
    const program = ref(props.benefitProgram)
    const loading = ref(false)

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => (innerVal.value = props.modelValue))
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    // Long descriptions are clamped to 3 lines; clicking them expands/collapses
    // the text. The "Show more/less" hint is only rendered when the text is
    // actually long enough to be clamped.
    const showFullDescription = ref(false)
    const descriptionEl = ref(null)
    const isDescriptionLong = ref(false)

    async function checkDescriptionLength() {
      await nextTick()
      const el = descriptionEl.value
      isDescriptionLong.value = Boolean(el && el.scrollHeight > el.clientHeight + 1)
    }

    watch([program, loading], () => {
      showFullDescription.value = false
      isDescriptionLong.value = false
      if (loading.value !== true && program.value?.description) checkDescriptionLength()
    })
    watch(showFullDescription, () => {
      if (showFullDescription.value === false) checkDescriptionLength()
    })
    onMounted(() => checkDescriptionLength())

    function fetchProgram() {
      if (!props.benefitProgram?.id) return Promise.resolve()
      loading.value = true
      return backend.get(`benefit-programs/${props.benefitProgram.id}/`)
        .then(response => {
          if (response?.data?.id) program.value = BenefitProgram.parse(response.data)
          return response
        })
        .catch(() => {})
        .finally(() => {
          loading.value = false
        })
    }

    onMounted(() => fetchProgram())
    watch(() => [props.benefitProgram?.id], () => {
      program.value = props.benefitProgram
      fetchProgram()
    })

    return {
      dialogRef,
      onDialogHide,
      innerVal,
      program,
      loading,
      showFullDescription,
      descriptionEl,
      isDescriptionLong,
      getDiscountCodeLabel,
      formatDiscountValue,
      taxTypeLabel,
    }
  },
})
</script>
<style scoped>
.description-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
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
