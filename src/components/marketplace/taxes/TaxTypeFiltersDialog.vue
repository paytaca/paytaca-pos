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
          <div class="text-caption text-grey q-mb-xs">{{ $t("Code") }}</div>
          <q-option-group
            v-model="tempFilterOpts.code"
            size="sm"
            type="radio"
            color="brandblue"
            :options="codeFilterOptions"
          />
        </div>
        <div>
          <div class="text-caption text-grey q-mb-xs">{{ $t("Source") }}</div>
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
          :label="$t('Reset')"
          @click="resetTempFilters"
        />
        <q-btn
          no-caps
          color="brandblue"
          :label="$t('Apply')"
          @click="applyFilters"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
<script>
import { taxCodeOptions } from "src/composables/marketplace/taxTypesForm";
import { useDialogPluginComponent } from "quasar";
import { useI18n } from "vue-i18n";
import { defineComponent, ref, computed } from "vue";

export default defineComponent({
  name: "TaxTypeFiltersDialog",
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

    const codeFilterOptions = computed(() => [
      { label: $t("All"), value: undefined },
      ...taxCodeOptions.map((opt) => ({ label: opt.label, value: opt.value })),
    ]);
    const sourceFilterOptions = computed(() => [
      { label: $t("All"), value: undefined },
      { label: $t("Platform", "Platform"), value: "platform" },
      { label: $t("Custom", "Custom"), value: "custom" },
    ]);

    function createDefaultFilterOpts() {
      return {
        code: undefined,
        source: undefined,
      };
    }

    const tempFilterOpts = ref({
      code: props.filterOpts?.code,
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
      codeFilterOptions,
      sourceFilterOptions,

      resetTempFilters,
      applyFilters,
    };
  },
});
</script>
