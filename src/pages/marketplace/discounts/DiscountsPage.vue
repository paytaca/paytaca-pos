<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)" />
          <div class="q-space">
            <div class="text-h5">{{ $t("Discounts") }}</div>
            <div class="text-grey">{{ $t("Marketplace") }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-sm no-wrap q-gutter-x-sm">
          <q-input
            dense
            outlined
            class="q-space"
            v-model="filterOpts.search"
            :placeholder="$t('SearchByName', 'Search by name')"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search" /></template>
            <template v-slot:append>
              <q-icon
                v-if="filterOpts.search"
                name="clear"
                class="cursor-pointer"
                @click="clearSearch"
              />
            </template>
          </q-input>
          <q-btn
            round
            icon="tune"
            padding="sm"
            :color="activeFilterCount > 0 ? 'brandblue' : 'grey-6'"
            flat
            @click="openFiltersDialog"
          >
            <q-badge v-if="activeFilterCount > 0" floating color="red" rounded>
              {{ activeFilterCount }}
            </q-badge>
          </q-btn>
          <q-btn
            round
            icon="add"
            padding="sm"
            color="brandblue"
            :to="{ name: 'marketplace-discount-create' }"
          />
        </div>
        <div
          v-if="activeFilterChips.length"
          class="row items-center q-gutter-x-xs q-mb-sm"
        >
          <q-chip
            v-for="chip in activeFilterChips"
            :key="chip.key"
            dense
            removable
            size="sm"
            color="blue-1"
            text-color="dark"
            @remove="removeFilter(chip.key)"
          >
            {{ chip.label }}
          </q-chip>
          <q-btn
            dense
            flat
            no-caps
            size="sm"
            color="grey-7"
            :label="$t('ClearAll', 'Clear all')"
            @click="resetFilters"
          />
        </div>
      </div>
      <q-table
        ref="table"
        row-key="id"
        binary-state-sort
        :loading="fetchingDiscounts"
        :columns="discountsTableColumns"
        :rows="discounts"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        :no-data-label="$t('NoDiscountsYet', 'No discounts yet')"
        :no-results-label="$t('NoDiscountsFound', 'No discounts found')"
        :sort-method="sortMethod"
      >
        <template v-slot:body="props">
          <q-tr
            :props="props"
            class="cursor-pointer"
            @click="navigateToEdit(props.row.id)"
          >
            <q-td key="name" :props="props">
              <div class="row items-center q-gutter-x-xs">
                <span class="text-weight-medium">{{ props.row.name }}</span>
                <q-chip
                  v-if="props.row.source"
                  dense
                  size="xs"
                  :color="props.row.source === 'custom' ? 'blue-1' : 'grey-3'"
                  text-color="dark"
                >
                  {{ props.row.source === 'custom' ? $t('Custom') : $t('Platform') }}
                </q-chip>
              </div>
            </q-td>
            <q-td key="activationCode" :props="props">
              <span v-if="props.row.activationCode" class="text-caption text-weight-medium">
                {{ props.row.activationCode }}
              </span>
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
            <q-td key="code" :props="props">
              {{ getCodeLabel(props.row.code) }}
            </q-td>
            <q-td key="scope" :props="props">
              {{ getScopeLabel(props.row.scope) }}
            </q-td>
            <q-td key="type" :props="props">
              <q-chip
                dense
                size="sm"
                :color="
                  props.row.type === DiscountType.TYPES.PCTG
                    ? 'purple-1'
                    : 'green-1'
                "
                text-color="dark"
              >
                {{ getTypeLabel(props.row.type) }}
              </q-chip>
            </q-td>
            <q-td key="value" :props="props">
              <template v-if="!Number.isFinite(props.row.value)">
                <span class="text-grey">—</span>
              </template>
              <template v-else-if="props.row?.type === DiscountType.TYPES.PCTG">
                {{ Number((props.row.value * 100).toFixed(2)) }}%
              </template>
              <template v-else>
                {{ Number(props.row.value.toFixed(2)) }}
                {{ props.row?.currency?.symbol }}
              </template>
              <div
                v-if="
                  Number.isFinite(props.row.maxAmount) && props.row.maxAmount > 0
                "
                class="text-caption text-grey"
              >
                {{ $t("Max", "max") }}
                {{ Number(props.row.maxAmount).toFixed(2) }}
                {{ props.row?.currency?.symbol }}
              </div>
            </q-td>
            <q-td key="dates" :props="props">
              <span v-if="getDateRangeText(props.row)" class="text-caption">
                {{ getDateRangeText(props.row) }}
              </span>
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
            <q-td key="conditions" :props="props" class="text-center">
              <q-chip
                v-if="getTotalConditions(props.row) > 0"
                dense
                size="sm"
                color="blue-1"
                text-color="dark"
              >
                {{ getTotalConditions(props.row) }}
              </q-chip>
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
            <q-td key="actions" :props="props" class="text-center">
              <q-btn
                flat
                round
                dense
                :icon="props.row.source === 'custom' ? 'edit' : 'visibility'"
                :color="props.row.source === 'custom' ? 'brandblue' : 'grey-6'"
                size="sm"
                @click.stop="navigateToEdit(props.row.id)"
              >
                <q-tooltip>
                  {{ props.row.source === 'custom' ? $t('Edit') : $t('View') }}
                </q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
        <template v-slot:bottom>
          <div class="row items-center full-width">
            <div class="text-caption text-grey">
              {{ discounts.length }} / {{ discountsPagination.count }}
              {{ $t("Discounts", "discounts").toLowerCase() }}
            </div>
            <q-space />
            <LimitOffsetPagination
              :pagination-props="{
                maxPages: 5,
                rounded: true,
                padding: 'sm md',
                flat: true,
                boundaryNumbers: true,
              }"
              :hide-below-pages="2"
              :modelValue="discountsPagination"
              @update:modelValue="fetchDiscounts"
            />
          </div>
        </template>
      </q-table>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from "src/marketplace/backend";
import { DiscountType } from "src/marketplace/objects";
import { formatTimestampToText } from "src/marketplace/utils";
import { useDiscountFormHelpers } from "src/composables/marketplace/discount";
import { useMarketplaceStore } from "src/stores/marketplace";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { defineComponent, onMounted, ref, computed, watch } from "vue";
import MarketplaceHeader from "src/components/marketplace/MarketplaceHeader.vue";
import LimitOffsetPagination from "src/components/LimitOffsetPagination.vue";
import DiscountFiltersDialog from "src/components/marketplace/discounts/DiscountFiltersDialog.vue";

export default defineComponent({
  name: "DiscountsPage",
  components: {
    LimitOffsetPagination,
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

    const filterOpts = ref({
      search: "",
      isActive: undefined,
      code: undefined,
      scope: undefined,
      type: undefined,
      source: undefined,
      sort: undefined,
    });

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

    const codeLabelMap = computed(() => {
      const map = {};
      discountCodeOptions.forEach((opt) => (map[opt.value] = opt.label));
      return map;
    });
    const scopeLabelMap = computed(() => {
      const map = {};
      discountScopeOptions.forEach((opt) => (map[opt.value] = opt.label));
      return map;
    });
    const typeLabelMap = computed(() => {
      const map = {};
      discountCalculationTypeOptions.forEach(
        (opt) => (map[opt.value] = opt.label)
      );
      return map;
    });

    function getCodeLabel(code) {
      return codeLabelMap.value[code] || code;
    }
    function getScopeLabel(scope) {
      return scopeLabelMap.value[scope] || scope;
    }
    function getTypeLabel(type) {
      return typeLabelMap.value[type] || type;
    }
    function getTotalConditions(discount) {
      if (!Array.isArray(discount?.conditionGroups)) return 0;
      return discount.conditionGroups.reduce(
        (sum, group) => sum + (group.conditions?.length ?? 0),
        0
      );
    }
    function clearSearch() {
      filterOpts.value.search = "";
    }
    function getDateRangeText(discount) {
      const startsAt = discount?.startsAt;
      const endsAt = discount?.endsAt;
      if (!startsAt && !endsAt) return "";
      const startText = startsAt ? formatTimestampToText(startsAt) : "";
      const endText = endsAt ? formatTimestampToText(endsAt) : "";
      if (startText && endText) return `${startText} – ${endText}`;
      return startText || endText;
    }
    function navigateToEdit(discountId) {
      $router.push({
        name: "marketplace-discount-edit",
        params: { discountId },
      });
    }

    const activeFilterCount = computed(() => {
      let count = 0;
      if (filterOpts.value.search) count++;
      if (filterOpts.value.isActive !== undefined) count++;
      if (filterOpts.value.code !== undefined) count++;
      if (filterOpts.value.scope !== undefined) count++;
      if (filterOpts.value.type !== undefined) count++;
      if (filterOpts.value.source !== undefined) count++;
      return count;
    });

    const activeFilterChips = computed(() => {
      const chips = [];
      if (filterOpts.value.isActive !== undefined) {
        const label = activeFilterOptions.find(
          (opt) => opt.value === filterOpts.value.isActive
        )?.label;
        chips.push({ key: "isActive", label: `${$t("Status")}: ${label}` });
      }
      if (filterOpts.value.code !== undefined) {
        const label = codeFilterOptions.value.find(
          (opt) => opt.value === filterOpts.value.code
        )?.label;
        chips.push({ key: "code", label: `${$t("Code")}: ${label}` });
      }
      if (filterOpts.value.scope !== undefined) {
        const label = scopeFilterOptions.value.find(
          (opt) => opt.value === filterOpts.value.scope
        )?.label;
        chips.push({ key: "scope", label: `${$t("Scope")}: ${label}` });
      }
      if (filterOpts.value.type !== undefined) {
        const label = typeFilterOptions.value.find(
          (opt) => opt.value === filterOpts.value.type
        )?.label;
        chips.push({ key: "type", label: `${$t("Type")}: ${label}` });
      }
      if (filterOpts.value.source !== undefined) {
        const label = sourceFilterOptions.find(
          (opt) => opt.value === filterOpts.value.source
        )?.label;
        chips.push({ key: "source", label: `${$t("Source")}: ${label}` });
      }
      return chips;
    });

    function removeFilter(key) {
      filterOpts.value[key] = undefined;
    }

    function resetFilters() {
      filterOpts.value.search = "";
      filterOpts.value.isActive = undefined;
      filterOpts.value.code = undefined;
      filterOpts.value.scope = undefined;
      filterOpts.value.type = undefined;
      filterOpts.value.source = undefined;
      filterOpts.value.sort = undefined;
    }

    function openFiltersDialog() {
      $q.dialog({
        component: DiscountFiltersDialog,
        componentProps: { filterOpts: filterOpts.value },
      }).onOk((newFilterOpts) => {
        Object.assign(filterOpts.value, newFilterOpts);
      });
    }

    const discounts = ref([].map(DiscountType.parse));
    const fetchingDiscounts = ref(false);
    const discountsPagination = ref({ offset: 0, limit: 0, count: 0 });
    async function fetchDiscounts(opts = { limit: 0, offset: 0 }) {
      const params = {
        s: filterOpts?.value?.search || undefined,
        shop_ids: Number(marketplaceStore.activeShopId),
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
        is_active: filterOpts.value.isActive,
        code: filterOpts.value.code,
        scope: filterOpts.value.scope,
        type: filterOpts.value.type,
        source: filterOpts.value.source,
        ordering: filterOpts.value.sort || undefined,
      };

      fetchingDiscounts.value = true;
      return backend
        .get(`discount-types/`, { params })
        .then((response) => {
          if (!Array.isArray(response?.data?.results))
            return Promise.reject({ response });
          discounts.value = response?.data?.results.map(DiscountType.parse);
          discountsPagination.value.limit = response?.data?.limit;
          discountsPagination.value.offset = response?.data?.offset;
          discountsPagination.value.count = response?.data?.count;
          return response;
        })
        .finally(() => {
          fetchingDiscounts.value = false;
        });
    }

    const discountsTableColumns = [
      {
        name: "name",
        align: "left",
        label: $t("Name"),
        field: "name",
        sortable: true,
      },
      {
        name: "activationCode",
        align: "left",
        label: $t("ActivationCode", "Activation Code"),
        field: "activationCode",
        classes: "hidden-xs",
        sortable: true,
      },
      {
        name: "code",
        align: "left",
        label: $t("Code"),
        field: "code",
        classes: "hidden-xs",
        sortable: true,
      },
      {
        name: "scope",
        align: "left",
        label: $t("Scope"),
        field: "scope",
        classes: "hidden-xs",
        sortable: true,
      },
      {
        name: "type",
        align: "left",
        label: $t("Type"),
        field: "type",
        sortable: true,
      },
      { name: "value", align: "left", label: $t("Amount"), field: "value" },
      {
        name: "dates",
        align: "left",
        label: $t("Validity", "Validity"),
        field: (row) => getDateRangeText(row),
        classes: "hidden-xs",
      },
      {
        name: "conditions",
        align: "center",
        label: $t("Conditions"),
        field: (row) => getTotalConditions(row),
        classes: "hidden-xs",
      },
      { name: "actions", align: "center", label: "", field: "id" },
    ];

    watch(filterOpts, () => fetchDiscounts(), { deep: true });

    const sortFieldNameMap = {
      activationCode: 'activation_code',
    };
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy;
      filterOpts.value.sort = (descending ? "-" : "") + fieldName;
      return rows;
    }

    async function refreshPage(done = () => {}) {
      try {
        await fetchDiscounts();
      } finally {
        done?.();
      }
    }
    onMounted(() => refreshPage());

    return {
      filterOpts,
      activeFilterOptions,
      sourceFilterOptions,
      activeFilterCount,
      activeFilterChips,
      codeFilterOptions,
      scopeFilterOptions,
      typeFilterOptions,
      discounts,
      discountsPagination,
      fetchingDiscounts,
      fetchDiscounts,
      discountsTableColumns,
      refreshPage,

      getCodeLabel,
      getScopeLabel,
      getTypeLabel,
      getTotalConditions,
      getDateRangeText,
      clearSearch,
      navigateToEdit,
      removeFilter,
      resetFilters,
      openFiltersDialog,
      sortMethod,

      DiscountType,
    };
  },
});
</script>
