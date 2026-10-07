<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)" />
        <div class="q-space">
          <div class="text-h5">
            {{ $t("CreateBenefitProgram", {}, "Create Benefit Program") }}
          </div>
          <div class="text-grey">{{ $t("Marketplace") }}</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-form ref="form" @submit="submit">
      <q-banner
        v-if="formErrors?.detail?.length"
        class="bg-red text-white rounded-borders q-mb-md"
      >
        <div v-if="formErrors.detail.length === 1">
          {{ formErrors.detail[0] }}
        </div>
        <ul v-else class="q-pl-md q-my-none">
          <li v-for="(err, index) in formErrors.detail" :key="index">{{ err }}</li>
        </ul>
      </q-banner>

      <q-tabs
        v-model="currentStep"
        dense
        no-caps
        stretch
        narrow-indicator
        class="text-grey text-weight-medium"
        active-color="brandblue"
        indicator-color="brandblue"
      >
        <q-tab name="details">
          <div class="row items-center no-wrap q-gutter-x-xs">
            <div>{{ $t('Details') }}</div>
            <q-icon
              v-if="stepErrors.details"
              name="error"
              color="negative"
              size="1.1em"
            />
          </div>
        </q-tab>
        <q-tab name="tax">
          <div class="row items-center no-wrap q-gutter-x-xs">
            <div>{{ $t('Tax', {}, 'Tax') }}</div>
            <q-icon
              :name="formData.applyTaxType ? 'check_circle' : 'radio_button_unchecked'"
              :color="formData.applyTaxType ? 'green' : 'grey-5'"
              size="1.1em"
            />
            <q-icon
              v-if="stepErrors.tax"
              name="error"
              color="negative"
              size="1.1em"
            />
          </div>
        </q-tab>
        <q-tab name="discounts">
          <div class="row items-center no-wrap q-gutter-x-xs">
            <div>{{ $t('Discounts') }}</div>
            <q-badge
              v-if="formData.discountTypes.length"
              color="brandblue"
              :label="formData.discountTypes.length"
            />
            <q-icon
              v-if="stepErrors.discounts"
              name="error"
              color="negative"
              size="1.1em"
            />
          </div>
        </q-tab>
      </q-tabs>

      <q-tab-panels
        v-model="currentStep"
        animated
        keep-alive
        class="q-mt-md"
        style="background: none"
      >
        <q-tab-panel name="details" class="q-pa-none">
          <div data-step="details">
            <q-card>
              <q-card-section class="q-gutter-y-xs">
                <div class="text-subtitle1">{{ $t("Details") }}</div>
                <div>{{ $t("Name") }}*</div>
                <q-input
                  dense
                  outlined
                  :loading="loading"
                  :disable="loading"
                  v-model="formData.name"
                  :error="Boolean(formErrors?.name)"
                  :error-message="formErrors?.name"
                  :rules="[(val) => Boolean(val) || $t('Required')]"
                />
                <div>{{ $t('Description') }}*</div>
                <q-input
                  dense
                  outlined
                  :loading="loading"
                  :disable="loading"
                  type="textarea"
                  v-model="formData.description"
                  :error="Boolean(formErrors?.description)"
                  :error-message="formErrors?.description"
                  :rules="[(val) => Boolean(val) || $t('Required')]"
                />
                <div>
                  {{ $t('BeneficiaryCategories', {}, 'Beneficiary Categories') }}*
                </div>
                <q-select
                  dense
                  outlined
                  multiple
                  use-chips
                  :loading="loading || fetchingBeneficiaryCategories"
                  :disable="loading"
                  v-model="formData.beneficiaryCategoryCodes"
                  :options="beneficiaryCategoryOptions"
                  option-value="code"
                  option-label="name"
                  emit-value
                  :error="Boolean(formErrors?.beneficiaryCategoryCodes)"
                  :error-message="formErrors?.beneficiaryCategoryCodes"
                  :rules="[
                    (val) => (Array.isArray(val) && val.length > 0) || $t('Required'),
                  ]"
                >
                  <template v-slot:option="ctx">
                    <q-item v-bind="ctx.itemProps">
                      <q-item-section>
                        <q-item-label>{{ ctx.opt.name }}</q-item-label>
                        <q-item-label caption>{{ ctx.opt.code }}</q-item-label>
                        <q-item-label v-if="ctx.opt.description" caption>
                          {{ ctx.opt.description }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </q-card-section>
            </q-card>
          </div>
        </q-tab-panel>

        <q-tab-panel name="tax" class="q-pa-none">
          <div data-step="tax">
            <q-card>
              <q-card-section class="q-gutter-y-xs">
                <div class="row items-center">
                  <div class="text-subtitle1 q-space">{{ $t('TaxType') }}</div>
                  <q-toggle
                    v-model="formData.applyTaxType"
                    color="brandblue"
                    :disable="loading"
                  />
                </div>
                <template v-if="formData.applyTaxType">
                  <div>{{ $t('Name') }}*</div>
                  <q-input
                    dense
                    outlined
                    :loading="loading"
                    :disable="loading"
                    v-model="formData.taxType.name"
                    :error="Boolean(formErrors?.taxType)"
                    :error-message="formErrors?.taxType"
                    :rules="[(val) => Boolean(val) || $t('Required')]"
                  />
                  <div>{{ $t('Code') }}*</div>
                  <q-select
                    dense
                    outlined
                    map-options
                    emit-value
                    :loading="loading"
                    :disable="loading"
                    v-model="formData.taxType.code"
                    :options="taxCodeOptions"
                    :rules="[(val) => Boolean(val) || $t('Required')]"
                  >
                    <template v-slot:option="ctx">
                      <q-item v-bind="ctx.itemProps">
                        <q-item-section>
                          <q-item-label>{{ ctx.opt.label }}</q-item-label>
                          <q-item-label caption>{{ ctx.opt.description }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                  <div>{{ $t('Rate', {}, 'Rate') }}</div>
                  <q-input
                    dense
                    outlined
                    type="number"
                    suffix="%"
                    :loading="loading"
                    :disable="loading || isTaxValueDisabled"
                    v-model.number="formData.taxType.value"
                    :hint="
                      isTaxValueDisabled
                        ? $t('TaxRateNotApplicable', 'Rate is not applicable for this tax code')
                        : ''
                    "
                    :rules="[
                      (val) => isTaxValueDisabled || Number(val) >= 0 || $t('Invalid'),
                    ]"
                  />
                </template>
                <div v-else class="text-grey">
                  {{ $t('NoTaxType', {}, 'No tax type') }}
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-tab-panel>

        <q-tab-panel name="discounts" class="q-pa-none">
          <div data-step="discounts">
            <q-card>
              <q-card-section class="q-gutter-y-xs">
                <div class="row items-center">
                  <div class="text-subtitle1 q-space">
                    {{ $t('DiscountTypes', {}, 'Discount Types') }}
                  </div>
                  <q-btn
                    flat
                    round
                    dense
                    icon="add"
                    color="brandblue"
                    :disable="loading"
                    @click="addDiscountType"
                  />
                </div>
                <div
                  v-if="!formData.discountTypes.length"
                  class="text-grey text-center q-py-md"
                >
                  {{ $t('NoDiscountTypes', {}, 'No discount types added') }}
                </div>
                <div
                  v-for="(discount, index) in formData.discountTypes"
                  :key="index"
                  class="q-pa-sm rounded-borders bg-grey-2"
                >
                  <div class="row items-center">
                    <div class="text-weight-medium q-space">
                      {{ $t('Discount', {}, 'Discount') }} {{ index + 1 }}
                    </div>
                    <q-btn
                      flat
                      round
                      dense
                      icon="delete"
                      color="red"
                      :disable="loading"
                      @click="() => removeDiscountType(index)"
                    />
                  </div>
                  <div
                    v-if="formErrors?.discountTypes?.[index]"
                    class="text-negative text-caption q-mb-xs"
                  >
                    {{ formErrors.discountTypes[index] }}
                  </div>
                  <div>{{ $t('Name') }}*</div>
                  <q-input
                    dense
                    outlined
                    :loading="loading"
                    :disable="loading"
                    v-model="discount.name"
                    :rules="[(val) => Boolean(val) || $t('Required')]"
                  />
                  <div class="row no-wrap items-start q-gutter-xs q-mt-xs">
                    <div class="col-6">
                      <div>{{ $t('Code') }}*</div>
                      <q-select
                        dense
                        outlined
                        map-options
                        emit-value
                        :loading="loading"
                        :disable="loading"
                        v-model="discount.code"
                        :options="discountCodeOptions"
                        :rules="[(val) => Boolean(val) || $t('Required')]"
                      >
                        <template v-slot:option="ctx">
                          <q-item v-bind="ctx.itemProps">
                            <q-item-section>
                              <q-item-label>{{ ctx.label }}</q-item-label>
                              <q-item-label v-if="ctx.opt?.description" caption>
                                {{ ctx.opt?.description }}
                              </q-item-label>
                            </q-item-section>
                          </q-item>
                        </template>
                      </q-select>
                    </div>
                    <div class="col-6">
                      <div>{{ $t('Scope') }}*</div>
                      <q-select
                        dense
                        outlined
                        map-options
                        emit-value
                        :loading="loading"
                        :disable="loading"
                        v-model="discount.scope"
                        :options="discountScopeOptions"
                        :rules="[(val) => Boolean(val) || $t('Required')]"
                      />
                    </div>
                  </div>
                  <div class="row no-wrap items-start q-gutter-xs q-mt-xs">
                    <div class="col-6">
                      <div>{{ $t('Type') }}*</div>
                      <q-select
                        dense
                        outlined
                        map-options
                        emit-value
                        :loading="loading"
                        :disable="loading"
                        v-model="discount.type"
                        :options="discountCalculationTypeOptions"
                        :rules="[(val) => Boolean(val) || $t('Required')]"
                      />
                    </div>
                    <div class="col-6">
                      <div>{{ $t('Value') }}*</div>
                      <q-input
                        dense
                        outlined
                        type="number"
                        :loading="loading"
                        :disable="loading"
                        v-model.number="discount.value"
                        :suffix="discount.type === 'percentage' ? '%' : marketplaceStore?.currency"
                        :rules="[(val) => Number(val) > 0 || $t('Invalid')]"
                      />
                    </div>
                  </div>
                  <div>{{ $t('MaxAmount', {}, 'Max Amount') }}</div>
                  <q-input
                    dense
                    outlined
                    type="number"
                    :placeholder="$t('Optional')"
                    :loading="loading"
                    :disable="loading"
                    v-model.number="discount.maxAmount"
                    :suffix="marketplaceStore?.currency"
                    :rules="[(val) => !val || Number(val) > 0 || $t('Invalid')]"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-tab-panel>
      </q-tab-panels>

      <div class="fixed-bottom q-pa-md">
        <q-btn
          v-if="!isLastStep"
          no-caps
          color="brandblue"
          class="full-width"
          :label="$t('Next', {}, 'Next')"
          :disable="loading"
          @click="goNext"
        />
        <q-btn
          v-else
          no-caps
          color="brandblue"
          class="full-width"
          type="submit"
          :loading="loading"
          :disable="loading"
          :label="$t('Create', {}, 'Create')"
        />
      </div>
    </q-form>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend';
import { errorParser } from 'src/marketplace/utils';
import {
  taxCodeOptions,
  zeroValueTaxCodes,
} from 'src/composables/marketplace/taxTypesForm';
import { useDiscountFormHelpers } from 'src/composables/marketplace/discount';
import { useMarketplaceStore } from 'src/stores/marketplace';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { defineComponent, onMounted, ref, computed, watch } from 'vue';
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue';

export default defineComponent({
  name: 'BenefitFormPage',
  components: {
    MarketplaceHeader,
  },
  setup() {
    const { t: $t } = useI18n();
    const $q = useQuasar();
    const $router = useRouter();
    const marketplaceStore = useMarketplaceStore();
    const {
      discountCodeOptions,
      discountScopeOptions,
      discountCalculationTypeOptions,
    } = useDiscountFormHelpers();

    const loading = ref(false);
    const form = ref();
    const formData = ref({
      name: '',
      description: '',
      beneficiaryCategoryCodes: [],

      applyTaxType: false,
      taxType: { name: '', code: 'tax_exclusive', value: 0 },
      discountTypes: [],
    });

    const formErrors = ref(createEmptyFormErrors());
    function createEmptyFormErrors() {
      return {
        detail: [],
        name: '',
        description: '',
        beneficiaryCategoryCodes: '',
        taxType: '',
        discountTypes: [],
      };
    }
    function resetFormErrors() {
      formErrors.value = createEmptyFormErrors();
    }

    // --- Multi-step navigation ---
    const stepOrder = ['details', 'tax', 'discounts'];
    const currentStep = ref(stepOrder[0]);
    const isLastStep = computed(
      () => currentStep.value === stepOrder[stepOrder.length - 1]
    );
    function advanceStep() {
      const index = stepOrder.indexOf(currentStep.value);
      if (index > -1 && index < stepOrder.length - 1) {
        currentStep.value = stepOrder[index + 1];
      }
    }
    function getValidationComponents() {
      return form.value?.getValidationComponents?.() || [];
    }
    function componentStep(component) {
      return component.$el
        ?.closest?.('[data-step]')
        ?.getAttribute?.('data-step');
    }
    function validateCurrentStep() {
      const step = currentStep.value;
      const components = getValidationComponents().filter(
        (component) => componentStep(component) === step
      );
      return Promise.all(
        components.map((component) => component.validate())
      ).then((results) => results.every((result) => result === true));
    }
    function goNext() {
      return validateCurrentStep().then((valid) => {
        if (valid) advanceStep();
      });
    }

    // Error indicators shown on the tabs. Server errors are derived from
    // `formErrors` while client-side validation errors are read straight from
    // the mounted fields' `hasError` state.
    const stepErrors = computed(() => {
      // Also depend on the step and discount count so fields that mount later
      // are picked up on the next evaluation.
      void currentStep.value;
      void formData.value.discountTypes.length;

      const errors = { details: false, tax: false, discounts: false };

      if (
        formErrors.value.name ||
        formErrors.value.description ||
        formErrors.value.beneficiaryCategoryCodes
      ) {
        errors.details = true;
      }
      if (formErrors.value.taxType) errors.tax = true;
      if (formErrors.value.discountTypes.some(Boolean)) errors.discounts = true;

      const components = getValidationComponents();
      components.forEach((component) => {
        if (!component.hasError) return;
        const step = componentStep(component);
        if (step && step in errors) errors[step] = true;
      });

      return errors;
    });

    onMounted(() => fetchBeneficiaryCategories());
    const beneficiaryCategoryOptions = ref([]);
    const fetchingBeneficiaryCategories = ref(false);
    function fetchBeneficiaryCategories() {
      fetchingBeneficiaryCategories.value = true;
      return backend
        .get('beneficiary-categories/')
        .then((response) => {
          if (!Array.isArray(response?.data?.results))
            return Promise.reject({ response });
          beneficiaryCategoryOptions.value = response.data.results;
          return response;
        })
        .finally(() => {
          fetchingBeneficiaryCategories.value = false;
        });
    }

    // Tax type helpers
    const isTaxValueDisabled = computed(() =>
      zeroValueTaxCodes.includes(formData.value.taxType.code)
    );
    watch(
      () => formData.value.taxType.code,
      (code) => {
        if (zeroValueTaxCodes.includes(code)) formData.value.taxType.value = 0;
      }
    );
    // Default the tax type name to the benefit program name, while still
    // allowing it to be overridden manually.
    watch(
      () => formData.value.name,
      (name, oldName) => {
        const taxTypeName = formData.value.taxType.name;
        if (!taxTypeName || taxTypeName === oldName)
          formData.value.taxType.name = name;
      }
    );

    function addDiscountType() {
      formData.value.discountTypes.push({
        name: '',
        code: 'with_tax',
        scope: 'line_item',
        type: 'fixed',
        value: null,
        maxAmount: null,
      });
    }
    function removeDiscountType(index) {
      formData.value.discountTypes.splice(index, 1);
    }

    function deepFirstError(value) {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) {
        for (const item of value) {
          const message = deepFirstError(item);
          if (message) return message;
        }
        return '';
      }
      if (typeof value === 'object') {
        if (value.detail) return deepFirstError(value.detail);
        for (const key of Object.keys(value)) {
          const message = deepFirstError(value[key]);
          if (message) return message;
        }
        return '';
      }
      return '';
    }

    function parseErrorResponse(error) {
      resetFormErrors();
      const data = error?.response?.data;
      if (!data) {
        formErrors.value.detail = [
          $t('CreateBenefitProgramError', 'Encountered errors in creating benefit program'),
        ];
        return;
      }
      formErrors.value.detail = errorParser.toArray(data?.non_field_errors);
      if (data?.detail) formErrors.value.detail = errorParser.toArray(data?.detail);
      formErrors.value.name = errorParser.firstElementOrValue(data?.name);
      formErrors.value.description = errorParser.firstElementOrValue(
        data?.description
      );
      formErrors.value.beneficiaryCategoryCodes = errorParser.firstElementOrValue(
        data?.beneficiary_category_codes
      );
      formErrors.value.taxType = deepFirstError(data?.tax_type);
      if (Array.isArray(data?.discount_types)) {
        formErrors.value.discountTypes = data.discount_types.map(deepFirstError);
      } else if (data?.discount_types) {
        formErrors.value.discountTypes = [deepFirstError(data.discount_types)];
      }

      const hasFieldError =
        formErrors.value.name ||
        formErrors.value.description ||
        formErrors.value.beneficiaryCategoryCodes ||
        formErrors.value.taxType ||
        formErrors.value.discountTypes.length;
      if (!formErrors.value.detail.length && !hasFieldError) {
        formErrors.value.detail = [
          $t('CreateBenefitProgramError', 'Encountered errors in creating benefit program'),
        ];
      }
    }

    function submit() {
      resetFormErrors();

      const data = {
        shop_id: marketplaceStore.activeShopId,
        name: formData.value.name,
        description: formData.value.description,
        beneficiary_category_codes: formData.value.beneficiaryCategoryCodes,
        tax_type: formData.value.applyTaxType
          ? {
              name: formData.value.taxType.name?.trim(),
              code: formData.value.taxType.code,
              value: isTaxValueDisabled.value
                ? 0
                : parseFloat(formData.value.taxType.value) || 0,
            }
          : null,
        discount_types: formData.value.discountTypes.map((discount) => {
          return {
            name: discount.name?.trim(),
            code: discount.code,
            scope: discount.scope,
            type: discount.type,
            value:
              discount.type === 'percentage'
                ? (parseFloat(discount.value) || 0) / 100
                : parseFloat(discount.value) || 0,
            max_amount: discount.maxAmount || null,
          };
        }),
      };

      loading.value = true;
      return backend
        .post('benefit-programs/', data)
        .then((response) => {
          $q.dialog({
            title: $t('Success'),
            message: $t('BenefitProgramCreated', 'Benefit program created!'),
            ok: { color: 'brandblue' },
          }).onDismiss(() => $router.go(-1));
          return response;
        })
        .catch(parseErrorResponse)
        .finally(() => {
          loading.value = false;
        });
    }

    return {
      marketplaceStore,
      loading,
      form,
      formData,
      formErrors,

      currentStep,
      isLastStep,
      stepErrors,
      goNext,

      beneficiaryCategoryOptions,
      fetchingBeneficiaryCategories,

      taxCodeOptions,
      isTaxValueDisabled,

      discountCodeOptions,
      discountScopeOptions,
      discountCalculationTypeOptions,

      addDiscountType,
      removeDiscountType,

      submit,
    };
  },
});
</script>
<style scoped lang="scss">
.sticky-bottom {
  position: sticky;
  left: 0;
  right: 0;
  bottom: env(safe-area-inset-bottom);
}
</style>
