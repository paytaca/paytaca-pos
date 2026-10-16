<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-pa-md rounded-borders" style="width:100%;max-width:560px;max-height:85vh;overflow:auto;">
      <div class="row items-center no-wrap q-mb-sm">
        <div class="text-h6 q-space">
          {{ program?.name || $t('BenefitProgram', 'Benefit program') }}
        </div>
        <q-btn flat icon="close" padding="sm" v-close-popup />
      </div>

      <div v-if="loading" class="text-center q-pa-md">
        <q-spinner color="brandblue" />
      </div>
      <div v-else class="q-gutter-y-sm">
        <div v-if="program?.description" class="text-body2 text-grey-8">
          {{ program.description }}
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
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { BenefitProgram } from 'src/marketplace/objects'
import { useTaxTypeHelpers } from 'src/composables/marketplace/taxTypesForm'
import { useDiscountTypeHelpers } from 'src/composables/marketplace/discount'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'BenefitProgramDetailDialog',
  props: {
    benefitProgram: Object,
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props) {
    const { t: $t } = useI18n()
    const { dialogRef, onDialogHide } = useDialogPluginComponent()
    const { taxTypeLabel } = useTaxTypeHelpers()
    const { getDiscountCodeLabel, formatDiscountValue } = useDiscountTypeHelpers()

    // Start from the (partial) regime payload, then enrich with the full
    // program when the retrieve endpoint responds.
    const program = ref(props.benefitProgram)
    const loading = ref(false)

    onMounted(() => {
      if (!props.benefitProgram?.id) return
      loading.value = true
      backend.get(`benefit-programs/${props.benefitProgram.id}/`)
        .then(response => {
          if (response?.data?.id) program.value = BenefitProgram.parse(response.data)
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
      program,
      loading,
      getDiscountCodeLabel,
      formatDiscountValue,
      taxTypeLabel,
    }
  },
})
</script>
