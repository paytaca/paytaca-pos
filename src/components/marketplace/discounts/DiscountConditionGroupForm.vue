<template>
  <div class="q-pa-sm rounded-borders shadow-3">
    <div class="row items-start">
      <q-option-group
        v-model="formData.logic"
        inline
        :options="[ { value: 'AND', label: $t('All') }, { value: 'OR', label: $t('Any') } ]"
      />
      <q-space/>
      <q-btn icon="add" padding="sm" flat>
        <q-menu>
          <q-list>
            <q-item clickable v-ripple v-close-popup @click="addCondition">
              <q-item-section>
                <q-item-label>Add condition</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              v-if="currentDepth < maxDepth"
              clickable v-ripple v-close-popup
              @click="addChild"
            >
              <q-item-section>
                <q-item-label>Add group condition</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <q-btn
        v-if="hasRemovedListener"
        flat
        icon="close"
        padding="sm"
        color="red"
        @click="$emit('remove')"
      />
    </div>
    <div
      v-if="Array.isArray(formData.conditions) && formData?.conditions?.length"
      class="q-pl-md q-my-sm q-gutter-y-sm"
    >
      <div v-for="(condition, index) in formData.conditions" :key="index" class="row items-start no-wrap q-gutter-x-sm">
        <div class="q-space">
          <div v-if="conditionTexts?.[index]?.title">
            {{ conditionTexts?.[index]?.title }}
          </div>
          <div v-else class="row items-center q-gutter-sm">
            <div>{{ getRuleTypeText(condition?.ruleType) }}</div>
            <div>{{ getOperatorText(condition?.operator) }}</div>
          </div>
          <DiscountConditionValue v-bind="condition"/>
        </div>
        <q-btn
          flat
          icon="close"
          padding="sm"
          color="red"
          @click="removeCondition(index)"
        />
      </div>
    </div>
    <div v-if="Array.isArray(formData.children) && formData.children?.length" class="q-pl-md q-my-sm q-gutter-y-sm">
      <DiscountConditionGroupForm
        v-for="(_, index) in formData.children" :key="index"
        v-model="formData.children[index]"
        :max-depth="maxDepth"
        :current-depth="currentDepth+1"
        @remove="removeChild(index)"
      />
    </div>
  </div>
</template>
<script>
import { useDiscountRuleTypesAndConditionsMap } from "src/composables/marketplace/discount";
import { useQuasar } from "quasar";
import { getCurrentInstance, defineComponent, ref, computed } from "vue";
import DiscountConditionFormDialog from 'src/components/marketplace/discounts/DiscountConditionFormDialog.vue'
import DiscountConditionValue from 'src/components/marketplace/discounts/DiscountConditionValue.vue'

export default defineComponent({
  name: 'DiscountConditionGroupForm',
  components: {
    DiscountConditionValue,
  },
  emits: [
    'remove',
    'update:modelValue',
  ],
  props: {
    maxDepth: Number,
    currentDepth: Number,
    modelValue: Object,
  },
  setup(props, { emit: $emit }) {
    const $q = useQuasar();
    const { getDiscountConditionText, getRuleTypeText, getOperatorText } = useDiscountRuleTypesAndConditionsMap();
    const hasRemovedListener = computed(() => {
      return !!getCurrentInstance().vnode.props?.onRemove
    })

    const formData = ref({
      logic: props?.modelValue?.logic ?? 'AND',
      children: props?.modelValue?.children ?? [],
      conditions: props?.modelValue?.conditions ?? [],
    });
    function emitUpdateModelValue() {
      $emit('update:modelValue', formData.value);
    }

    const conditionTexts = computed(() => {
      if (!Array.isArray(formData.value.conditions)) {
        console.warn('Invalid conditions in form data', formData.value.conditions);
        return []
      }

      return formData.value.conditions.map(condition=> {
        const text = getDiscountConditionText(condition?.ruleType, condition?.operator)
        return text
      })
    })

    function removeChild(indexToRemove) {
      formData.value.children = formData.value.children.filter((_, index) => {
        return index !== indexToRemove;
      })
      emitUpdateModelValue()
    }

    function addChild() {
      if (props.currentDepth >= props.maxDepth) return
      formData.value.children.push({ logic: 'AND', children: [], conditions: [] })
      emitUpdateModelValue()
    }

    function removeCondition(indexToRemove) {
      formData.value.conditions = formData.value.conditions.filter((_, index) => {
        return index !== indexToRemove;
      })
      emitUpdateModelValue()
    }

    function addCondition() {
      $q.dialog({
        component: DiscountConditionFormDialog
      }).onOk(data => {
        formData.value.conditions.push(data)
        emitUpdateModelValue()
      })
    }

    return {
      hasRemovedListener,
      formData,
      emitUpdateModelValue,
      conditionTexts,
      removeChild,
      addChild,
      removeCondition,
      addCondition,

      getRuleTypeText,
      getOperatorText,
    }
  }
})
</script>
<style scoped>
.bordered {
  border: 1px solid black;
}
</style>