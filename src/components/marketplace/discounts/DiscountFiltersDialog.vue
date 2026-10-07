<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="rounded-borders" style="width: 100%; max-width: 480px;">
      <div class="row items-center no-wrap q-px-md q-py-sm">
        <div class="text-h6 q-space">{{ $t("Filters", "Filters") }}</div>
        <q-btn flat round icon="close" padding="sm" v-close-popup />
      </div>
      <q-separator />
      <q-card-section
        class="q-gutter-y-md"
        style="max-height: 70vh; overflow: auto;"
      >
        <div>
          <div class="text-caption text-grey q-mb-xs">
            {{ $t("Status") }}
          </div>
          <q-btn-toggle
            v-model="tempFilterOpts.isActive"
            spread
            no-caps
            dense
            toggle-color="brandblue"
            color="white"
            text-color="grey-8"
            :options="activeFilterOptions"
          />
        </div>
        <div>
          <div class="text-caption text-grey q-mb-xs">
            {{ $t("Code") }}
          </div>
          <q-btn-toggle
            v-model="tempFilterOpts.code"
            spread
            no-caps
            dense
            toggle-color="brandblue"
            color="white"
            text-color="grey-8"
            :options="codeFilterOptions"
          />
        </div>
        <div>
          <div class="text-caption text-grey q-mb-xs">
            {{ $t("Scope") }}
          </div>
          <q-btn-toggle
            v-model="tempFilterOpts.scope"
            spread
            no-caps
            dense
            toggle-color="brandblue"
            color="white"
            text-color="grey-8"
            :options="scopeFilterOptions"
          />
        </div>
        <div>
          <div class="text-caption text-grey q-mb-xs">
            {{ $t("Type") }}
          </div>
          <q-btn-toggle
            v-model="tempFilterOpts.type"
            spread
            no-caps
            dense
            toggle-color="brandblue"
            color="white"
            text-color="grey-8"
            :options="typeFilterOptions"
          />
        </div>
        <div>
          <div class="text-caption text-grey q-mb-xs">
            {{ $t("Source") }}
          </div>
          <q-btn-toggle
            v-model="tempFilterOpts.source"
            spread
            no-caps
            dense
            toggle-color="brandblue"
            color="white"
            text-color="grey-8"
            :options="sourceFilterOptions"
          />
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="between" class="q-px-md q-py-sm">
        <q-btn
          flat
          no-caps
          color="grey-7"
          :label="$t('Reset', 'Reset')"
          @click="resetTempFilters"
        />
        <q-btn
          no-caps
          color="brandblue"
          :label="$t('Apply', 'Apply')"
          @click="applyFilters"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
<script>
import { useDiscountFormHelpers } from "src/composables/marketplace/discount";
import { useDialogPluginComponent } from "quasar";
import { useI18n } from "vue-i18n";
import { defineComponent, ref, computed } from "vue";

export default defineComponent({
  name: "DiscountFiltersDialog",
  props: {
    filterOpts: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props) {
    const { t: $t } = useI18n();
    const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
    const {
      discountCodeOptions,
      discountScopeOptions,
      discountCalculationTypeOptions,
    } = useDiscountFormHelpers();

    const activeFilterOptions = [
      { label: $t("All"), value: undefined },
      { label: $t("Active"), value: true },
      { label: $t("Inactive"), value: false },
    ];
    const sourceFilterOptions = [
      { label: $t("All"), value: undefined },
      { label: $t("Custom", "Custom"), value: "custom" },
      { label: $t("Platform", "Platform"), value: "platform" },
    ];
    const codeFilterOptions = computed(() => [
      { label: $t("All"), value: undefined },
      ...discountCodeOptions,
    ]);
    const scopeFilterOptions = computed(() => [
      { label: $t("All"), value: undefined },
      ...discountScopeOptions,
    ]);
    const typeFilterOptions = computed(() => [
      { label: $t("All"), value: undefined },
      ...discountCalculationTypeOptions,
    ]);

    function createDefaultFilterOpts() {
      return {
        isActive: undefined,
        code: undefined,
        scope: undefined,
        type: undefined,
        source: undefined,
      };
    }

    const tempFilterOpts = ref({
      isActive: props.filterOpts?.isActive,
      code: props.filterOpts?.code,
      scope: props.filterOpts?.scope,
      type: props.filterOpts?.type,
      source: props.filterOpts?.source,
    });

    function resetTempFilters() {
      tempFilterOpts.value = createDefaultFilterOpts();
    }

    function applyFilters() {
      onDialogOK({ ...tempFilterOpts.value });
    }

    return {
      dialogRef,
      onDialogHide,

      tempFilterOpts,
      activeFilterOptions,
      sourceFilterOptions,
      codeFilterOptions,
      scopeFilterOptions,
      typeFilterOptions,

      resetTempFilters,
      applyFilters,
    };
  },
});
</script>
