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
        <div class="row items-end q-mb-md no-wrap q-gutter-x-sm">
          <q-input
            dense
            outlined
            class="q-space"
            v-model="filterOpts.search"
            :placeholder="$t('SearchByName', 'Search by name')"
            debounce="500"
            @update:model-value="fetchDiscounts"
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
            icon="filter_list"
            padding="sm"
            :color="activeFilterCount > 0 ? 'brandblue' : 'grey-6'"
            flat
          >
            <q-badge v-if="activeFilterCount > 0" floating color="red" rounded>
              {{ activeFilterCount }}
            </q-badge>
            <q-menu anchor="bottom right" self="top right" :offset="[0, 8]">
              <q-card style="min-width: 260px">
                <q-card-section class="q-py-sm">
                  <div class="text-subtitle2">
                    {{ $t("Filters", "Filters") }}
                  </div>
                </q-card-section>
                <q-separator />
                <q-card-section class="q-gutter-y-md">
                  <q-select
                    dense
                    outlined
                    emit-value
                    map-options
                    v-model="filterOpts.isActive"
                    :options="activeFilterOptions"
                    :label="$t('Status')"
                  />
                </q-card-section>
                <q-separator />
                <q-card-actions align="between" class="q-px-md q-py-sm">
                  <q-btn
                    flat
                    no-caps
                    color="grey-7"
                    :label="$t('Reset', 'Reset')"
                    @click="resetFilters"
                  />
                  <q-btn
                    v-close-popup
                    no-caps
                    color="brandblue"
                    :label="$t('Apply', 'Apply')"
                    @click="applyFilters"
                  />
                </q-card-actions>
              </q-card>
            </q-menu>
          </q-btn>
          <q-btn
            round
            icon="add"
            padding="sm"
            color="brandblue"
            :to="{ name: 'marketplace-discount-create' }"
          />
        </div>
      </div>
      <q-table
        ref="table"
        row-key="id"
        :loading="fetchingDiscounts"
        :columns="discountsTableColumns"
        :rows="discounts"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        :no-data-label="$t('NoDiscountsYet', 'No discounts yet')"
        :no-results-label="$t('NoDiscountsFound', 'No discounts found')"
      >
        <template v-slot:body="props">
          <q-tr
            :props="props"
            class="cursor-pointer"
            @click="navigateToEdit(props.row.id)"
          >
            <q-td key="name" :props="props">
              <div class="text-weight-medium">{{ props.row.name }}</div>
              <div v-if="props.row.activationCode" dense class="text-caption text-grey">
                {{ props.row.activationCode }}
              </div>
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
                :color="props.row.type === DiscountType.TYPES.PCTG ? 'purple-1' : 'green-1'"
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
                v-if="Number.isFinite(props.row.maxValue) && props.row.maxValue > 0"
                class="text-caption text-grey"
              >
                {{ $t("Max", "max") }}
                {{ Number(props.row.maxValue).toFixed(2) }}
                {{ props.row?.currency?.symbol }}
              </div>
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
                icon="edit"
                color="brandblue"
                size="sm"
                @click.stop="navigateToEdit(props.row.id)"
              />
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
import { useDiscountFormHelpers } from "src/composables/marketplace/discount";
import { useMarketplaceStore } from "src/stores/marketplace";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { defineComponent, onMounted, ref, computed } from "vue";
import MarketplaceHeader from "src/components/marketplace/MarketplaceHeader.vue";
import LimitOffsetPagination from "src/components/LimitOffsetPagination.vue";

export default defineComponent({
  name: "DiscountsPage",
  components: {
    LimitOffsetPagination,
    MarketplaceHeader,
  },
  setup() {
    const { t: $t } = useI18n();
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
    });

    const activeFilterOptions = [
      { label: $t("All"), value: undefined },
      { label: $t("Active"), value: true },
      { label: $t("Inactive"), value: false },
    ];

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
      fetchDiscounts();
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
      return count;
    });

    function resetFilters() {
      filterOpts.value.search = "";
      filterOpts.value.isActive = undefined;
      fetchDiscounts();
    }

    function applyFilters() {
      fetchDiscounts();
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
      { name: "name", align: "left", label: $t("Name"), field: "name" },
      {
        name: "code",
        align: "left",
        label: $t("Code"),
        field: "code",
        classes: "hidden-xs",
      },
      {
        name: "scope",
        align: "left",
        label: $t("Scope"),
        field: "scope",
        classes: "hidden-xs",
      },
      { name: "type", align: "left", label: $t("Type"), field: "type" },
      { name: "value", align: "left", label: $t("Amount"), field: "value" },
      {
        name: "conditions",
        align: "center",
        label: $t("Conditions"),
        field: (row) => getTotalConditions(row),
        classes: "hidden-xs",
      },
      { name: "actions", align: "center", label: "", field: "id" },
    ];

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
      activeFilterCount,
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
      clearSearch,
      navigateToEdit,
      resetFilters,
      applyFilters,

      DiscountType,
    };
  },
});
</script>
