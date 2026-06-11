<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card style="min-height:calc(75vh)">
      <div class="q-px-md q-pt-md">
        <div class="text-h5">Discount Condition</div>
      </div>
      <!-- <q-tabs v-if="formData.ruleType" v-model="activeTabPanel">
        <q-tab label="Rule" name="rule-type-operator"/>
        <q-tab label="Value" name="rule-value"/>
      </q-tabs> -->
      <q-tab-panels v-model="activeTabPanel" animated keep-alive>
        <q-tab-panel name="rule-type-operator">
          <div class="text-subtitle1">Select Condition</div>
          <q-list separator>
            <q-item
              v-for="(ruleTypeOpt, index) in ruleTypeOptions" :key="index"
              clickable v-ripple
              @click="selectRuleType(ruleTypeOpt)"
            >
              <q-item-section>
                <q-item-label>{{ ruleTypeOpt.label }}</q-item-label>
                <q-item-label caption>{{ ruleTypeOpt.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-tab-panel>
        <q-tab-panel name="rule-value">
          <div class="row items-center q-r-ml-lg">
            <q-btn
              flat round
              icon="arrow_back" padding="sm"
              @click="activeTabPanel = 'rule-type-operator'"
            />
            <div class="text-subtitle1">{{ selectedRuleType?.label }}</div>
          </div>
          <ProductSearchPanel v-if="formData.ruleType === 'product'" v-model="formData.value"/>
          <q-option-group
            v-else-if="formData.ruleType === 'category'"
            v-model="formData.value"
            type="checkbox"
            color="brandblue"
            :options="productCategoriesOptions"
          ></q-option-group>
          <q-input
            v-else-if="formData.ruleType === 'subtotal'"
            dense
            outlined
            v-model.number="formData.value"
            :suffix="marketplaceStore.currency"
            bottom-slots
          />
          <template v-else>
            <div></div>
            <q-input dense outlined v-model="formData.value" bottom-slots/>
          </template>
          <q-btn
            color="brandblue"
            no-caps
            :label="$t('OK')"
            class="full-width q-mt-md"
            @click="onSubmit"
          />
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-dialog>
</template>
<script>
import { useDiscountConditionHelpers, useDiscountRuleTypesAndConditionsMap } from 'src/composables/marketplace/discount'
import { useMarketplaceStore } from 'src/stores/marketplace';
import { useDialogPluginComponent } from 'quasar';
import { defineComponent, ref, computed } from 'vue';
import ProductSearchPanel from 'src/components/marketplace/ProductSearchPanel.vue';

export default defineComponent({
  name: 'DiscountConditionFormDialog',
  components: {
    ProductSearchPanel,
  },
  emits: [
    ...useDialogPluginComponent.emits,
  ],
  props: {
    initialValue: {
      default() {
        return {
          ruleType: '',
          operator: '',
          value: null,
        }
      }
    }
  },
  setup(props) {
    const { dialogRef, onDialogOK, onDialogCancel, onDialogHide, } = useDialogPluginComponent()
    const { productCategoriesOptions, updateProductCategories } = useDiscountConditionHelpers();    
    const { getDiscountConditionText } = useDiscountRuleTypesAndConditionsMap();
    const marketplaceStore = useMarketplaceStore();
    const activeTabPanel = ref('rule-type-operator');

    const ruleTypeOptions = [
      { ruleType: 'product', operator: 'in' },
      { ruleType: 'category', operator: 'in' },
      { ruleType: 'subtotal', operator: 'gte' },
    ].map(partialCondition => {
      const text = getDiscountConditionText(partialCondition.ruleType, partialCondition.operator);
      return {
        ...partialCondition,
        label: text.title,
        description: text.description,
      }
    })

    const selectedRuleType = computed(() => {
      return ruleTypeOptions.find(ruleTypeOpt => ruleTypeOpt.ruleType === formData.value.ruleType)
    })

    function selectRuleType(ruleTypeOpt) {
      formData.value.ruleType = ruleTypeOpt.ruleType
      formData.value.operator = ruleTypeOpt.operator
      activeTabPanel.value = 'rule-value'
      if (formData.value.ruleType === 'product') {
        if (!Array.isArray(formData.value.value)) formData.value.value = []
      }

      if (formData.value.ruleType === 'category') {
        updateProductCategories()
        if (!Array.isArray(formData.value.value)) formData.value.value = []
      }
      if (formData.value.ruleType === 'subtotal') {
        if (typeof formData.value.value !== 'number') formData.value.value = 0
      }
    }

    const formData = ref({
      ruleType: '',
      operator: '',
      value: null,
      ...props.initialValue,
    })

    function normalizedConditionValue() {
      const { ruleType, operator, value } = formData.value;
      if (ruleType === 'product' && operator === 'in') {
        return value.map(val => val?.id ?? val)
      }
      return value;
    }

    function onSubmit() {
      console.log('normalizedConditionValue', normalizedConditionValue());
      onDialogOK({
        ...formData.value,
        value: normalizedConditionValue(),
      })
    }

    return {
      dialogRef,
      onDialogHide,
      productCategoriesOptions,
      updateProductCategories,
      marketplaceStore,
      activeTabPanel,
      ruleTypeOptions,
      selectedRuleType,
      selectRuleType,
      formData,
      onSubmit,
    }
  },
})
</script>
