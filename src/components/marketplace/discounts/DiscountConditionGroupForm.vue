<template>
  <div class="condition-group" :class="`depth-${currentDepth}`">
    <!-- Header -->
    <div class="group-header row items-center q-mb-sm">
      <div class="text-body2">
        <span class="text-grey-7">{{
          currentDepth === 1
            ? $t("DiscountAppliesWhen", "Discount applies when")
            : $t("When", "When")
        }}</span>
        <q-btn-dropdown
          flat
          dense
          no-caps
          :label="
            formData.logic === 'AND' ? $t('All', 'All') : $t('Any', 'Any')
          "
          color="primary"
          class="q-mx-xs text-weight-bold"
        >
          <q-list>
            <q-item clickable v-close-popup @click="formData.logic = 'AND'">
              <q-item-section>
                <q-item-label class="text-weight-bold">{{
                  $t("All", "All")
                }}</q-item-label>
                <q-item-label caption>{{
                  $t("EveryConditionMustMatch", "Every condition must match")
                }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="formData.logic = 'OR'">
              <q-item-section>
                <q-item-label class="text-weight-bold">{{
                  $t("Any", "Any")
                }}</q-item-label>
                <q-item-label caption>{{
                  $t("AtLeastOneMustMatch", "At least one must match")
                }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
        <span class="text-grey-7">{{
          $t("OfTheseAreTrue", "of these are true:")
        }}</span>
      </div>
      <q-space />
      <q-btn
        v-if="hasRemovedListener"
        flat
        round
        dense
        icon="close"
        color="red"
        size="sm"
        @click="$emit('remove')"
      />
    </div>

    <!-- Body -->
    <div class="group-body" :class="{ 'is-empty': !hasItems }">
      <!-- Empty State -->
      <div v-if="!hasItems" class="empty-state text-center q-py-lg">
        <q-icon
          name="rule_folder"
          size="2.5rem"
          color="grey-4"
          class="q-mb-sm"
        />
        <div class="text-grey-6 text-weight-medium">
          {{ $t("NoConditionsYet", "No conditions yet") }}
        </div>
        <div class="text-caption text-grey-5 q-mt-xs">
          {{
            $t(
              "AddConditionOrGroupToGetStarted",
              "Add a condition or group to get started"
            )
          }}
        </div>
      </div>

      <!-- Unified Items List -->
      <template v-for="item in displayItems" :key="item.key">
        <!-- Combinator -->
        <div
          v-if="item.type === 'combinator'"
          class="combinator row justify-center q-py-xs"
        >
          <q-chip
            dense
            size="sm"
            class="bg-grey-3 text-grey-8 text-weight-bold text-uppercase"
          >
            {{ item.value === "AND" ? $t("And", "AND") : $t("Or", "OR") }}
          </q-chip>
        </div>

        <!-- Condition -->
        <div
          v-else-if="item.type === 'condition'"
          class="condition-row row items-start no-wrap q-gutter-x-sm q-pa-sm rounded-borders"
        >
          <div class="condition-content row items-center q-gutter-x-xs col">
            <template v-if="conditionTitle(item.data)">
              <span class="text-weight-medium">{{
                conditionTitle(item.data)
              }}</span>
            </template>
            <template v-else>
              <span class="text-weight-medium">{{
                getRuleTypeText(item.data?.ruleType)
              }}</span>
              <span class="text-grey-7">{{
                getOperatorText(item.data?.operator)
              }}</span>
            </template>
            <div class="condition-value">
              <DiscountConditionValue v-bind="item.data" />
            </div>
          </div>
          <div class="row items-center q-gutter-x-xs">
            <q-btn
              flat
              round
              dense
              icon="edit"
              color="grey-6"
              size="sm"
              @click="editCondition(item.originalIndex)"
            />
            <q-btn
              flat
              round
              dense
              icon="close"
              color="red"
              size="sm"
              @click="removeCondition(item.originalIndex)"
            />
          </div>
        </div>

        <!-- Group -->
        <div v-else-if="item.type === 'group'" class="group-row">
          <DiscountConditionGroupForm
            v-model="formData.children[item.originalIndex]"
            :max-depth="maxDepth"
            :current-depth="currentDepth + 1"
            @remove="removeChild(item.originalIndex)"
          />
        </div>
      </template>
    </div>

    <!-- Footer / Add Actions -->
    <div
      v-if="currentDepth < maxDepth || true"
      class="group-footer row q-gutter-x-sm q-mt-sm"
    >
      <q-btn
        flat
        no-caps
        dense
        color="primary"
        icon="add"
        :label="$t('AddCondition', 'Add condition')"
        @click="addCondition"
      />
      <q-btn
        v-if="currentDepth < maxDepth"
        flat
        no-caps
        dense
        color="primary"
        icon="add"
        :label="$t('AddGroup', 'Add group')"
        @click="addChild"
      />
    </div>
  </div>
</template>

<script>
import { useDiscountRuleTypesAndConditionsMap } from "src/composables/marketplace/discount";
import { useQuasar } from "quasar";
import { getCurrentInstance, defineComponent, ref, computed, watch } from "vue";
import DiscountConditionFormDialog from "src/components/marketplace/discounts/DiscountConditionFormDialog.vue";
import DiscountConditionValue from "src/components/marketplace/discounts/DiscountConditionValue.vue";

export default defineComponent({
  name: "DiscountConditionGroupForm",
  components: {
    DiscountConditionValue,
  },
  emits: ["remove", "update:modelValue"],
  props: {
    maxDepth: Number,
    currentDepth: Number,
    modelValue: Object,
  },
  setup(props, { emit: $emit }) {
    const $q = useQuasar();
    const { getDiscountConditionText, getRuleTypeText, getOperatorText } =
      useDiscountRuleTypesAndConditionsMap();
    const hasRemovedListener = computed(() => {
      return !!getCurrentInstance().vnode.props?.onRemove;
    });

    const formData = ref({
      logic: props?.modelValue?.logic ?? "AND",
      children: props?.modelValue?.children ?? [],
      conditions: props?.modelValue?.conditions ?? [],
    });

    function emitUpdateModelValue() {
      $emit("update:modelValue", formData.value);
    }

    // Ensure all nested changes bubble up to the root
    watch(formData, emitUpdateModelValue, { deep: true });

    const hasItems = computed(() => {
      return (
        formData.value.conditions?.length > 0 ||
        formData.value.children?.length > 0
      );
    });

    const displayItems = computed(() => {
      const items = [];
      let displayIndex = 0;

      (formData.value.conditions || []).forEach((data, originalIndex) => {
        if (displayIndex > 0) {
          items.push({
            type: "combinator",
            value: formData.value.logic,
            key: `comb-c-${originalIndex}`,
          });
        }
        items.push({
          type: "condition",
          data,
          originalIndex,
          key: `cond-${originalIndex}-${data?.ruleType}-${data?.operator}`,
        });
        displayIndex++;
      });

      (formData.value.children || []).forEach((data, originalIndex) => {
        if (displayIndex > 0) {
          items.push({
            type: "combinator",
            value: formData.value.logic,
            key: `comb-g-${originalIndex}`,
          });
        }
        items.push({
          type: "group",
          data,
          originalIndex,
          key: `group-${originalIndex}-${data?.logic}`,
        });
        displayIndex++;
      });

      return items;
    });

    function conditionTitle(condition) {
      const text = getDiscountConditionText(
        condition?.ruleType,
        condition?.operator
      );
      return text?.title;
    }

    function removeChild(indexToRemove) {
      formData.value.children = formData.value.children.filter((_, index) => {
        return index !== indexToRemove;
      });
    }

    function addChild() {
      if (props.currentDepth >= props.maxDepth) return;
      formData.value.children.push({
        logic: "AND",
        children: [],
        conditions: [],
      });
    }

    function removeCondition(indexToRemove) {
      formData.value.conditions = formData.value.conditions.filter(
        (_, index) => {
          return index !== indexToRemove;
        }
      );
    }

    function addCondition() {
      $q.dialog({
        component: DiscountConditionFormDialog,
      }).onOk((data) => {
        formData.value.conditions.push(data);
      });
    }

    function editCondition(index) {
      const condition = formData.value.conditions[index];
      $q.dialog({
        component: DiscountConditionFormDialog,
        componentProps: {
          initialValue: { ...condition },
        },
      }).onOk((data) => {
        formData.value.conditions[index] = data;
      });
    }

    return {
      hasRemovedListener,
      formData,
      hasItems,
      displayItems,
      conditionTitle,
      removeChild,
      addChild,
      removeCondition,
      addCondition,
      editCondition,

      getRuleTypeText,
      getOperatorText,
    };
  },
});
</script>

<style scoped>
.condition-group {
  position: relative;
}

/* ── Group Body Indent Rail ───────────────────────────── */
.group-body {
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  border-left: 2px solid #e0e0e0;
  /* the rail stretches only as tall as its content */
}

/* depth-specific rail colours (only the *direct* body of this group) */
.condition-group.depth-1 > .group-body {
  border-left-color: #1976d2; /* blue */
}
.condition-group.depth-2 > .group-body {
  border-left-color: #26a69a; /* teal */
}
.condition-group.depth-3 > .group-body {
  border-left-color: #9c27b0; /* purple */
}

/* empty groups get a dashed, semi-transparent rail */
.group-body.is-empty {
  border-left-style: dashed;
  opacity: 0.6;
}

/* ── Empty State ────────────────────────────────────────── */
.empty-state {
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  /* stays inside the 1.5rem indent so it belongs to this group */
}

/* ── Condition Row ──────────────────────────────────────── */
.condition-row {
  border: 1px solid #e0e0e0;
  transition: background 0.15s ease;
}

.condition-content {
  min-width: 0;
}

.condition-value {
  min-width: 0;
  overflow: hidden;
}

/* ── Nested Group ───────────────────────────────────────── */
/* no negative margin – nested groups naturally sit inside
   the parent group-body padding, so their header is indented
   exactly like sibling conditions in the parent */
.group-row {
  margin-left: 0;
}

/* give nested groups a subtle background so they read as a single unit */
.condition-group.depth-2 {
  background: rgba(38, 166, 154, 0.04);
  border-radius: 4px;
  padding: 0.25rem 0.5rem 0.25rem 0;
}
.condition-group.depth-3 {
  background: rgba(156, 39, 176, 0.04);
  border-radius: 4px;
  padding: 0.25rem 0.5rem 0.25rem 0;
}
</style>
