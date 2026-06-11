<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">{{ $t('CreateDiscount', {}, 'Create Discount') }}</div>
          <div class="text-grey">{{ $t('Marketplace') }}</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-form ref="form" @submit="submit" class="q-mt-lg q-gutter-y-lg">
      <q-card>
        <q-card-section class="q-gutter-y-xs">
          <div class="text-subtitle1">{{ $t('Details') }}</div>
          <div>{{ $t('Name') }}*</div>
          <q-input
            dense
            outlined
            :loading="loading"
            :disable="loading"
            v-model="formData.name"
            :error="Boolean(formErrors?.name)"
            :error-message="formErrors?.name"
            :rules="[
              val => Boolean(val) || $t('Required'),
            ]"
          />
          <div>{{ $t('ActivationCode', {}, 'Activation Code') }}*</div>
          <q-input
            dense
            outlined
            :loading="loading"
            :disable="loading"
            v-model="formData.activationCode"
            :error="Boolean(formErrors?.activationCode)"
            :error-message="formErrors?.activationCode"
            :rules="[
              val => Boolean(val) || $t('Required'),
            ]"
          />
          <div>{{ $t('Code') }}*</div>
          <q-select
            dense
            outlined
            :loading="loading"
            :disable="loading"
            map-options
            emit-value
            v-model="formData.code"
            :options="discountCodeOptions"
            :error="Boolean(formErrors?.code)"
            :error-message="formErrors?.code"
            :rules="[
              val => Boolean(val) || $t('Required'),
            ]"
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
          <div>{{ $t('Scope') }}*</div>
          <q-select
            dense
            outlined
            :loading="loading"
            :disable="loading"
            map-options
            emit-value
            v-model="formData.scope"
            :options="discountScopeOptions"
            :error="Boolean(formErrors?.scope)"
            :error-message="formErrors?.scope"
            :rules="[
              val => Boolean(val) || $t('Required'),
            ]"
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
          <q-separator spaced />
          <div class="row no-wrap items-start q-gutter-xs">
            <div class="col-5">
              <div>{{ $t('Type') }}*</div>
              <q-select
                dense
                outlined
                :loading="loading"
                :disable="loading"
                map-options
                emit-value
                v-model="formData.type"
                :options="discountCalculationTypeOptions"
                :error="Boolean(formErrors?.type)"
                :error-message="formErrors?.type"
                :rules="[
                  val => Boolean(val) || $t('Required'),
                ]"
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
            <div class="q-space">
              <div>{{ $t('Value') }}*</div>
              <q-input
                dense
                outlined
                :loading="loading"
                :disable="loading"
                v-model.number="formData.value"
                :error="Boolean(formErrors?.value)"
                :error-message="formErrors?.value"
                :suffix="formData.type === 'percentage' ? '%' : marketplaceStore?.currency"
                :rules="[
                  val => Boolean(val) || $t('Required'),
                  val => val > 0 || $t('Invalid'),
                ]"
              />
            </div>
          </div>
          <div>{{ $t('MaxAmount', {}, 'Max Amount') }}*</div>
          <q-input
            dense
            outlined
            :loading="loading"
            :disable="loading"
            :placeholder="$t('Optional')"
            v-model.number="formData.maxValue"
            :error="Boolean(formErrors?.maxValue)"
            :error-message="formErrors?.maxValue"
            :suffix="marketplaceStore?.currency"
            :rules="[
              val => !val || val > 0 || $t('Invalid'),
            ]"
          />
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section>
          <div class="text-subtitle1">{{ $t('Conditions') }}</div>
          <q-banner
            v-if="formErrors?.rootConditionGroup"
            class="bg-red text-white rounded-borders"
          >
            <div class="q-my-sm">{{  $t('ConditionsErrorMessage', 'Encountered errors in conditions logic') }}</div>
            <q-tree :nodes="formErrors.rootConditionGroup" node-key="key" color="white"/>
          </q-banner>
          <div v-if="!formData.rootConditionGroup" class="text-center">
            <q-btn
              no-caps label="Add conditions"
              color="brandblue"
              class="full-width q-my-sm"
              @click="formData.rootConditionGroup = { logic: 'AND', children: [], conditions: [] }"
            />
          </div>
          <DiscountConditionGroupForm
            v-else
            v-model="formData.rootConditionGroup"
            :current-depth="1"
            :max-depth="3"
            @remove="formData.rootConditionGroup = null"
          />
        </q-card-section>
      </q-card>

      <div class="q-pa-md sticky-bottom">
        <q-btn
          no-caps
          :label="$t('Create')"
          color="brandblue"
          class="full-width"
          type="submit"
        />
      </div>
    </q-form>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend';
import { useDiscountFormHelpers } from 'src/composables/marketplace/discount'
import { useMarketplaceStore } from 'src/stores/marketplace';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { defineComponent, ref } from "vue";
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import DiscountConditionGroupForm from 'src/components/marketplace/discounts/DiscountConditionGroupForm.vue'
import { errorParser } from 'src/marketplace/utils';

export default defineComponent({
  name: 'DiscountFormPage',
  components: {
    MarketplaceHeader,
    DiscountConditionGroupForm,
  },
  props: {
    discountId: Number,
  },
  setup() {
    const $q = useQuasar();
    const $router = useRouter();
    const {
      discountCodeOptions,
      discountScopeOptions,
      discountCalculationTypeOptions,
    } = useDiscountFormHelpers();
    const marketplaceStore = useMarketplaceStore();

    const loading = ref(false);
    const formData = ref({
      name: '',
      activationCode: '',
      code: '',
      scope: '',
      type: '',
      value: 10,
      maxValue: null,
      rootConditionGroup: null,
    })

    const formErrors = ref({
      name: '',
      activationCode: '',
      code: '',
      scope: '',
      type: '',
      value: '',
      maxValue: '',
      rootConditionGroup: null,
    })
    function resetFormErrors() {
      formErrors.value = {
        name: '',
        activationCode: '',
        code: '',
        scope: '',
        type: '',
        value: '',
        maxValue: '',
        rootConditionGroup: null,
      }
    }

    function parseErrorResponse(error) {
      const data = error?.response?.data;
      formErrors.value.name = errorParser.firstElementOrValue(data?.name);
      formErrors.value.activationCode = errorParser.firstElementOrValue(data?.activation_code);
      formErrors.value.code = errorParser.firstElementOrValue(data?.code);
      formErrors.value.scope = errorParser.firstElementOrValue(data?.scope);
      formErrors.value.type = errorParser.firstElementOrValue(data?.type);
      formErrors.value.value = errorParser.firstElementOrValue(data?.value);
      formErrors.value.maxValue = errorParser.firstElementOrValue(data?.max_value);
      formErrors.value.rootConditionGroup = errorParser.errorsToQTreeNodes(data?.root_condition_group);
    }

    function normalizeCondition(conditionData) {
      return {
        rule_type: conditionData?.ruleType,
        operator: conditionData?.operator,
        value: conditionData?.value,
      };
    }

    function normalizeGroup(groupData) {
      return {
        ...groupData,
        logic: groupData?.logic,
        conditions: Array.isArray(groupData?.conditions) ? groupData?.conditions.map(normalizeCondition) : groupData?.conditions,
        children: Array.isArray(groupData?.children) ? groupData?.children.map(normalizeGroup) : groupData?.children,
      }
    }

    function submit() {
      const data = {
        name: formData.value.name,
        activation_code: formData.value.activationCode,
        code: formData.value.code,
        scope: formData.value.scope,
        type: formData.value.type,
        value: formData.value.type === 'percentage' ? formData.value.value / 100 : formData.value.value,
        max_value: formData.value.maxValue,
        root_condition_group: formData.value.rootConditionGroup ? normalizeGroup(formData.value.rootConditionGroup) : undefined,
        shop_id: marketplaceStore.shopData?.id,
      }

      loading.value = true
      return backend.post('discount-types/', data)
        .finally(() => resetFormErrors())
        .then(response => {
          $q.dialog({
            title: 'Success',
            message: 'Discount Created!',
            ok: { color: 'brandblue' },
          }).onDismiss(() => $router.go(-1));
          return response;
        })
        .catch(error => parseErrorResponse(error))
        .finally(() => {
          loading.value = false
        })
    }


    return {
      discountCodeOptions,
      discountScopeOptions,
      discountCalculationTypeOptions,
      marketplaceStore,

      loading,
      formData,
      formErrors,
      submit,
    }
  }
})
</script>
<style scoped lang="scss">
.sticky-bottom {
  position: sticky;
  left: 0;
  right: 0;
  bottom: env(safe-area-inset-bottom);
}
</style>
