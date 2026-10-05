<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-pa-md rounded-borders" style="width:100%;max-width:480px;">
      <div class="row items-center no-wrap q-mb-sm">
        <div class="text-h6 q-space">
          {{ isEditing ? $t('EditTaxType', 'Edit tax type') : $t('CreateTaxType', 'Create tax type') }}
        </div>
        <q-btn flat icon="close" padding="sm" v-close-popup />
      </div>

      <q-form @submit="() => submit()">
        <q-banner
          v-if="formErrors.detail.length"
          class="bg-red text-white rounded-borders q-mb-sm"
        >
          <div v-if="formErrors.detail.length === 1">{{ formErrors.detail[0] }}</div>
          <ul v-else class="q-pl-md q-my-none">
            <li v-for="(err, index) in formErrors.detail" :key="index">{{ err }}</li>
          </ul>
        </q-banner>

        <q-input
          dense
          outlined
          :label="$t('Name')"
          v-model="formData.name"
          :disable="loading"
          counter
          maxlength="50"
          :error="Boolean(formErrors.name)"
          :error-message="formErrors.name"
          :rules="[val => Boolean(val) || $t('Required')]"
        />

        <q-select
          dense
          outlined
          class="q-mt-sm"
          :label="$t('Code')"
          v-model="formData.code"
          :options="taxCodeOptions"
          :disable="loading"
          emit-value
          map-options
          :error="Boolean(formErrors.code)"
          :error-message="formErrors.code"
          :rules="[val => Boolean(val) || $t('Required')]"
        >
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>{{ scope.opt.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-input
          dense
          outlined
          class="q-mt-sm"
          type="number"
          :label="$t('Rate', 'Rate')"
          suffix="%"
          v-model.number="formData.value"
          :disable="loading || isValueDisabled"
          :hint="isValueDisabled ? $t('TaxRateNotApplicable', 'Rate is not applicable for this tax code') : ''"
          :error="Boolean(formErrors.value)"
          :error-message="formErrors.value"
          :rules="[val => isValueDisabled || (val >= 0) || $t('Invalid')]"
        />

        <q-btn
          no-caps
          type="submit"
          color="brandblue"
          class="full-width q-mt-md"
          :loading="loading"
          :disable="loading"
          :label="isEditing ? $t('Update') : $t('Create')"
        />
      </q-form>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { TaxType } from 'src/marketplace/objects'
import { taxCodeOptions, zeroValueTaxCodes } from 'src/composables/marketplace/taxTypesForm'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'TaxTypeFormDialog',
  props: {
    modelValue: Boolean,
    taxType: Object,
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const { t: $t } = useI18n()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const isEditing = computed(() => Boolean(props.taxType?.id))
    const formData = ref({ name: '', code: 'tax_exclusive', value: 0 })
    const isValueDisabled = computed(() => zeroValueTaxCodes.includes(formData.value.code))

    watch(() => formData.value.code, (code) => {
      if (zeroValueTaxCodes.includes(code)) formData.value.value = 0
    })

    const loading = ref(false)
    const formErrors = ref({ detail: [], name: '', code: '', value: '' })
    function clearFormErrors() {
      formErrors.value = { detail: [], name: '', code: '', value: '' }
    }

    function syncFormData() {
      formData.value = {
        name: props.taxType?.name || '',
        code: props.taxType?.code || 'tax_exclusive',
        value: Number.isFinite(props.taxType?.value) ? props.taxType.value : 0,
      }
      if (isValueDisabled.value) formData.value.value = 0
      clearFormErrors()
    }
    onMounted(() => syncFormData())
    watch(() => [props.taxType?.id], () => syncFormData())

    function handleError(error) {
      clearFormErrors()
      const data = error?.response?.data
      if (!data) {
        formErrors.value.detail = [$t('SaveTaxTypeError', 'Encountered errors in saving tax type')]
        return
      }
      formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
      formErrors.value.name = errorParser.firstElementOrValue(data?.name)
      formErrors.value.code = errorParser.firstElementOrValue(data?.code)
      formErrors.value.value = errorParser.firstElementOrValue(data?.value)
      if (data?.detail) formErrors.value.detail = errorParser.toArray(data?.detail)
      if (!formErrors.value.detail?.length) {
        formErrors.value.detail = [$t('SaveTaxTypeError', 'Encountered errors in saving tax type')]
      }
    }

    function submit() {
      const data = {
        name: formData.value.name?.trim(),
        code: formData.value.code,
        value: isValueDisabled.value ? 0 : (parseFloat(formData.value.value) || 0),
      }

      loading.value = true
      const request = isEditing.value
        ? backend.patch(`tax-types/${props.taxType.id}/`, data)
        : backend.post(`tax-types/`, { ...data, shop_id: marketplaceStore.activeShopId })

      return request
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          onDialogOK(TaxType.parse(response.data))
          return response
        })
        .catch(handleError)
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,
      marketplaceStore,
      isEditing,
      formData,
      isValueDisabled,
      taxCodeOptions,
      loading,
      formErrors,
      submit,
    }
  },
})
</script>