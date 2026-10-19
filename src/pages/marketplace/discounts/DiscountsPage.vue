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
            :to="{ name: 'marketplace-discount-add' }"
          >
            <q-tooltip>{{ $t('AddDiscount', 'Add discount') }}</q-tooltip>
          </q-btn>
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
            @click="openDiscountDetailDialog(props.row)"
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
              {{ getDiscountCodeLabel(props.row.code) }}
            </q-td>
            <q-td key="scope" :props="props">
              {{ getDiscountScopeLabel(props.row.scope) }}
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
                {{ getDiscountTypeLabel(props.row.type) }}
              </q-chip>
            </q-td>
            <q-td key="value" :props="props">
              <div>{{ formatDiscountValue(props.row, { includeMax: false }) }}</div>
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
            <q-td key="redemptions" :props="props">
              <template v-if="hasRedemptionLimits(props.row)">
                <div
                  v-if="props.row.maxRedemptions != null"
                  class="text-caption"
                >
                  {{ $t("Total", "Total") }}: {{ props.row.maxRedemptions }}
                </div>
                <div
                  v-if="props.row.maxRedemptionsPerCustomer != null"
                  class="text-caption"
                >
                  {{ $t("PerCustomer", "Per customer") }}:
                  {{ props.row.maxRedemptionsPerCustomer }}
                </div>
              </template>
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
            <q-td key="dates" :props="props">
              <span v-if="getDiscountDateRangeText(props.row)" class="text-caption">
                {{ getDiscountDateRangeText(props.row) }}
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

      <DiscountTypeDetailDialog
        v-model="discountDetailDialog.show"
        :discount-type="discountDetailDialog.discountType"
      >
        <template #actions="{ discountType }">
          <q-btn-dropdown
            split
            no-caps
            color="brandblue"
            icon="edit"
            :label="$t('Edit')"
            :disable-main-btn="!discountType?.isCustom"
            @click="navigateToEdit(discountType.id)"
          >
            <q-list style="min-width: 200px">
              <q-item
                v-if="discountType?.isCustom"
                clickable
                v-close-popup
                @click="confirmDeleteDiscount(discountType)"
              >
                <q-item-section avatar>
                  <q-icon name="delete" color="negative" />
                </q-item-section>
                <q-item-section class="text-negative">
                  {{ $t('Delete') }}
                </q-item-section>
              </q-item>
              <q-item
                v-else
                clickable
                v-close-popup
                @click="confirmDetachDiscount(discountType)"
              >
                <q-item-section avatar>
                  <q-icon name="link_off" color="negative" />
                </q-item-section>
                <q-item-section class="text-negative">
                  {{ $t('RemoveFromShop', 'Remove from shop') }}
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </template>
      </DiscountTypeDetailDialog>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from "src/marketplace/backend";
import { DiscountType } from "src/marketplace/objects";
import { useDiscountFormHelpers, useDiscountTypeHelpers } from "src/composables/marketplace/discount";
import { useMarketplaceStore } from "src/stores/marketplace";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { defineComponent, onMounted, ref, computed, watch } from "vue";
import MarketplaceHeader from "src/components/marketplace/MarketplaceHeader.vue";
import LimitOffsetPagination from "src/components/LimitOffsetPagination.vue";
import DiscountFiltersDialog from "src/components/marketplace/discounts/DiscountFiltersDialog.vue";
import DiscountTypeDetailDialog from "src/components/marketplace/discounts/DiscountTypeDetailDialog.vue";

export default defineComponent({
  name: "DiscountsPage",
  components: {
    LimitOffsetPagination,
    MarketplaceHeader,
    DiscountTypeDetailDialog,
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
    const {
      getDiscountCodeLabel,
      getDiscountScopeLabel,
      getDiscountTypeLabel,
      formatDiscountValue,
      getDiscountDateRangeText,
    } = useDiscountTypeHelpers();

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

    function getTotalConditions(discount) {
      if (!Array.isArray(discount?.conditionGroups)) return 0;
      return discount.conditionGroups.reduce(
        (sum, group) => sum + (group.conditions?.length ?? 0),
        0
      );
    }
    function hasRedemptionLimits(discount) {
      return (
        discount?.maxRedemptions != null ||
        discount?.maxRedemptionsPerCustomer != null
      );
    }
    function clearSearch() {
      filterOpts.value.search = "";
    }

    const discountDetailDialog = ref({ show: false, discountType: null });

    function openDiscountDetailDialog(discount) {
      discountDetailDialog.value.discountType = discount;
      discountDetailDialog.value.show = true;
    }

    function closeDiscountDetailDialog() {
      discountDetailDialog.value.show = false;
    }

    function navigateToEdit(discountId) {
      closeDiscountDetailDialog();
      $router.push({
        name: "marketplace-discount-edit",
        params: { discountId },
      });
    }

    function confirmDeleteDiscount(discount) {
      if (!discount?.isCustom) return;
      closeDiscountDetailDialog();
      $q.dialog({
        title: $t("DeleteDiscount", {}, "Delete discount"),
        message: $t(
          "DeleteDiscountConfirm",
          { name: discount.name },
          `Delete discount "${discount.name}"? This cannot be undone.`
        ),
        color: "negative",
        ok: { label: $t("Delete"), color: "negative", noCaps: true },
        cancel: { label: $t("Cancel"), flat: true, noCaps: true },
      }).onOk(() => deleteDiscount(discount));
    }

    function deleteDiscount(discount) {
      if (!discount?.id) return Promise.resolve();
      return backend
        .delete(`discount-types/${discount.id}/`)
        .then(() => {
          $q.notify({
            type: "positive",
            message: $t("DiscountDeleted", {}, "Discount deleted"),
          });
          return fetchDiscounts({ offset: 0 });
        })
        .catch((error) => {
          $q.notify({
            type: "negative",
            message:
              error?.response?.data?.detail ||
              $t("FailedToDeleteDiscount", {}, "Failed to delete discount"),
          });
        });
    }

    function confirmDetachDiscount(discount) {
      if (!discount?.id || discount.source !== "platform") return;
      closeDiscountDetailDialog();
      $q.dialog({
        title: $t("RemoveDiscountFromShop", {}, "Remove discount from shop"),
        message: $t(
          "RemoveDiscountFromShopConfirm",
          { name: discount.name },
          `Remove discount "${discount.name}" from this shop? It will no longer be available here, but you can add it again later.`
        ),
        color: "negative",
        ok: { label: $t("Remove", "Remove"), color: "negative", noCaps: true },
        cancel: { label: $t("Cancel"), flat: true, noCaps: true },
      }).onOk(() => detachDiscount(discount));
    }

    function detachDiscount(discount) {
      if (!discount?.id) return Promise.resolve();
      return backend
        .delete(`shops/${marketplaceStore.activeShopId}/discount-types/${discount.id}/`)
        .then(() => {
          $q.notify({
            type: "positive",
            message: $t("DiscountRemovedFromShop", {}, "Discount removed from shop"),
          });
          return fetchDiscounts({ offset: 0 });
        })
        .catch((error) => {
          const data = error?.response?.data;
          $q.notify({
            type: "negative",
            message:
              data?.detail ||
              (Array.isArray(data) ? data[0] : null) ||
              $t("FailedToRemoveDiscount", {}, "Failed to remove discount from shop"),
          });
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
        name: "redemptions",
        align: "left",
        label: $t("Redemptions", "Redemptions"),
        field: (row) => row.maxRedemptions,
        classes: "hidden-xs",
      },
      {
        name: "dates",
        align: "left",
        label: $t("Validity", "Validity"),
        field: (row) => getDiscountDateRangeText(row),
        classes: "hidden-xs",
      },
      {
        name: "conditions",
        align: "center",
        label: $t("Conditions"),
        field: (row) => getTotalConditions(row),
        classes: "hidden-xs",
      },
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
      discountDetailDialog,
      openDiscountDetailDialog,

      getDiscountCodeLabel,
      getDiscountScopeLabel,
      getDiscountTypeLabel,
      formatDiscountValue,
      getTotalConditions,
      getDiscountDateRangeText,
      hasRedemptionLimits,
      clearSearch,
      navigateToEdit,
      confirmDeleteDiscount,
      deleteDiscount,
      confirmDetachDiscount,
      detachDiscount,
      removeFilter,
      resetFilters,
      openFiltersDialog,
      sortMethod,

      DiscountType,
    };
  },
});
</script>
