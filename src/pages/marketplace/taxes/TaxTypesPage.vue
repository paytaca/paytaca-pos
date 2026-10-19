<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader :title="$t('Taxes')" :subtitle="$t('Marketplace')" back-button-mode="back" show-back-button />

      <NextStepsBanner
        v-model="taxSetupTaskIndex"
        :dismissible="false"
        :tasks="taxSetupTasks"
        @action="goToSetupTask"
      />

      <div class="full-width q-mb-sm">
        <div class="row items-end q-mb-sm no-wrap q-gutter-x-sm">
          <q-input
            dense
            outlined
            class="q-space"
            v-model="filterOpts.search"
            :placeholder="$t('SearchByName', 'Search by name or code')"
            debounce="300"
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
            :to="{ name: 'marketplace-tax-add' }"
          >
            <q-tooltip>{{ $t('AddTaxType', 'Add tax type') }}</q-tooltip>
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
        :loading="fetchingTaxTypes"
        :columns="taxTypesTableColumns"
        :rows="displayedTaxTypes"
        :sort-method="allLoaded ? undefined : sortMethod"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
        :no-data-label="$t('NoTaxTypesYet', 'No tax types yet')"
        :no-results-label="$t('NoTaxTypesFound', 'No tax types found')"
      >
        <template v-slot:body="props">
          <q-tr :props="props" class="cursor-pointer" @click="openTaxTypeDetailDialog(props.row)">
            <q-td key="name" :props="props">
              <div class="text-weight-medium row items-center no-wrap">
                <q-icon
                  v-if="isDefaultTaxType(props.row)"
                  name="star"
                  color="amber-7"
                  size="sm"
                  class="q-mr-xs"
                />
                <span>{{ props.row.name || '—' }}</span>
              </div>
              <div class="text-caption text-grey">
                {{ props.row.isCustom ? $t('Custom', 'Custom') : $t('Platform', 'Platform') }}
              </div>
            </q-td>
            <q-td key="code" :props="props">
              {{ getTaxCodeLabel(props.row.code) }}
            </q-td>
            <q-td key="value" :props="props" class="text-center">
              <template v-if="Number.isFinite(props.row.value)">
                {{ Number(props.row.value.toFixed(2)) }}%
              </template>
              <span v-else class="text-grey">—</span>
            </q-td>
          </q-tr>
        </template>
        <template v-slot:bottom>
          <div class="row items-center full-width">
            <div class="text-caption text-grey">
              {{ displayedTaxTypes.length }} / {{ pagination.count }}
              {{ $t('TaxTypes', 'tax types').toLowerCase() }}
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
              :modelValue="pagination"
              @update:modelValue="fetchTaxTypes"
            />
          </div>
        </template>
      </q-table>

      <TaxTypeDetailDialog
        v-model="taxTypeDetailDialog.show"
        :tax-type="taxTypeDetailDialog.taxType"
      >
        <template #actions="{ taxType }">
          <q-btn-dropdown
            split
            no-caps
            color="brandblue"
            icon="edit"
            :label="$t('Edit')"
            :disable-main-btn="!taxType?.isCustom"
            @click="openEditTaxTypeDialog(taxType)"
          >
            <q-list style="min-width: 220px">
              <q-item
                v-if="!isDefaultTaxType(taxType)"
                clickable
                v-close-popup
                @click="setAsDefaultTaxType(taxType)"
              >
                <q-item-section avatar>
                  <q-icon name="star_border" />
                </q-item-section>
                <q-item-section>
                  {{ $t('SetAsDefaultTaxType', 'Set as default tax type') }}
                </q-item-section>
              </q-item>
              <q-item
                v-if="taxType?.isCustom"
                clickable
                v-close-popup
                @click="confirmDeleteTaxType(taxType)"
              >
                <q-item-section avatar>
                  <q-icon name="delete" color="negative" />
                </q-item-section>
                <q-item-section class="text-negative">
                  {{ $t('Delete') }}
                </q-item-section>
              </q-item>
              <q-item
                v-if="taxType?.source === 'platform'"
                clickable
                v-close-popup
                :disable="isDefaultTaxType(taxType)"
                @click="confirmDetachTaxType(taxType)"
              >
                <q-item-section avatar>
                  <q-icon name="link_off" color="negative" />
                </q-item-section>
                <q-item-section class="text-negative">
                  {{ $t('RemoveFromShop', 'Remove from shop') }}
                </q-item-section>
                <q-tooltip v-if="isDefaultTaxType(taxType)">
                  {{ $t('SetAnotherDefaultToRemove', 'Set another tax type as default before removing this one') }}
                </q-tooltip>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </template>
      </TaxTypeDetailDialog>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { TaxType } from 'src/marketplace/objects'
import { taxCodeOptions, useTaxTypeHelpers } from 'src/composables/marketplace/taxTypesForm'
import { useSetupTasks } from 'src/composables/marketplace/setupTasks'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import TaxTypeFormDialog from 'src/components/marketplace/taxes/TaxTypeFormDialog.vue'
import TaxTypeDetailDialog from 'src/components/marketplace/taxes/TaxTypeDetailDialog.vue'
import TaxTypeFiltersDialog from 'src/components/marketplace/taxes/TaxTypeFiltersDialog.vue'
import NextStepsBanner from 'src/components/marketplace/NextStepsBanner.vue'

const SHOP_SETTINGS_MAX_AGE = 5 * 60 * 1000
const DEFAULT_LIMIT = 10

const sortFieldNameMap = {
  name: 'name',
  code: 'code',
  value: 'value',
}

export default defineComponent({
  name: 'TaxTypesPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
    NextStepsBanner,
    TaxTypeDetailDialog,
  },
  setup() {
    const { t: $t } = useI18n()
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    const {
      tasks: taxSetupTasks,
      index: taxSetupTaskIndex,
      goTo: goToSetupTask,
    } = useSetupTasks({ only: ['setup-taxes'] })

    const taxTypes = ref([].map(TaxType.parse))
    const fetchingTaxTypes = ref(false)
    const pagination = ref({ offset: 0, limit: DEFAULT_LIMIT, count: 0 })
    const filterOpts = ref({ search: '', code: undefined, source: undefined, sort: undefined })
    /**
     * Whether the list currently in memory was fetched with a filter applied
     * (`s`, `code` or `source` query param). A filtered result can never be
     * considered "all loaded", even when its count happens to fit within the
     * page size.
     */
    const fetchedWithFilter = ref(false)

    /**
     * The whole (unfiltered) list is only fully loaded when the server count
     * fits within the current page size AND the list was fetched without a
     * filter. Otherwise there are more records on the server (or the list is a
     * filtered subset) and the `s`, `code`, `source` + `ordering` query params
     * are used instead.
     */
    const allLoaded = computed(() => {
      return !fetchedWithFilter.value && pagination.value.count <= pagination.value.limit
    })

    async function fetchTaxTypes(opts = { limit: 0, offset: 0 }) {
      const params = {
        shop_id: marketplaceStore.shopData?.id,
        limit: opts?.limit || pagination.value.limit || DEFAULT_LIMIT,
        offset: opts?.offset || 0,
      }
      if (!allLoaded.value) {
        if (filterOpts.value.search?.trim?.()) params.s = filterOpts.value.search.trim()
        if (filterOpts.value.code) params.code = filterOpts.value.code
        if (filterOpts.value.source) params.source = filterOpts.value.source
        if (filterOpts.value.sort) params.ordering = filterOpts.value.sort
      }
      fetchingTaxTypes.value = true
      return backend.get(`tax-types/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          taxTypes.value = response.data.results.map(TaxType.parse)
          pagination.value.limit = response?.data?.limit || pagination.value.limit
          pagination.value.offset = response?.data?.offset || 0
          pagination.value.count = response?.data?.count || 0
          fetchedWithFilter.value = Boolean(params.s || params.code || params.source)
          return response
        })
        .finally(() => {
          fetchingTaxTypes.value = false
        })
    }

    watch(filterOpts, () => {
      if (allLoaded.value) return
      fetchTaxTypes({ offset: 0 })
    }, { deep: true })

    const displayedTaxTypes = computed(() => {
      if (!allLoaded.value) return taxTypes.value
      const query = filterOpts.value.search?.trim().toLowerCase()
      return taxTypes.value.filter(taxType => {
        if (filterOpts.value.code && taxType.code !== filterOpts.value.code) return false
        if (filterOpts.value.source && taxType.source !== filterOpts.value.source) return false
        if (!query) return true
        return [taxType.name, taxType.code, taxType.value].some(field => {
          return String(field ?? '').toLowerCase().includes(query)
        })
      })
    })

    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-' : '') + fieldName
      return rows
    }

    const hasDefaultTaxType = computed(() => Boolean(marketplaceStore.shopSettings?.defaultTaxType?.id))
    const hasAppliedRegime = computed(() => Boolean(marketplaceStore.shopSettings?.appliedTaxRegime?.id))
    const isTaxSetupComplete = computed(() => hasAppliedRegime.value || hasDefaultTaxType.value)
    function isDefaultTaxType(taxType) {
      const defaultTaxTypeId = marketplaceStore.shopSettings?.defaultTaxType?.id
      return Boolean(taxType?.id && defaultTaxTypeId && taxType.id == defaultTaxTypeId)
    }

    const { getTaxCodeLabel } = useTaxTypeHelpers()

    const codeFilterOptions = computed(() => [
      { label: $t('All'), value: undefined },
      ...taxCodeOptions.map(opt => ({ label: opt.label, value: opt.value })),
    ])
    const sourceFilterOptions = computed(() => [
      { label: $t('All'), value: undefined },
      { label: $t('Platform', 'Platform'), value: 'platform' },
      { label: $t('Custom', 'Custom'), value: 'custom' },
    ])

    const activeFilterCount = computed(() => {
      let count = 0
      if (filterOpts.value.search) count++
      if (filterOpts.value.code !== undefined) count++
      if (filterOpts.value.source !== undefined) count++
      return count
    })

    const activeFilterChips = computed(() => {
      const chips = []
      if (filterOpts.value.code !== undefined) {
        const label = codeFilterOptions.value.find(opt => opt.value === filterOpts.value.code)?.label
        chips.push({ key: 'code', label: `${$t('Code')}: ${label}` })
      }
      if (filterOpts.value.source !== undefined) {
        const label = sourceFilterOptions.value.find(opt => opt.value === filterOpts.value.source)?.label
        chips.push({ key: 'source', label: `${$t('Source')}: ${label}` })
      }
      return chips
    })

    function clearSearch() {
      filterOpts.value.search = ''
    }
    function removeFilter(key) {
      filterOpts.value[key] = undefined
    }
    function resetFilters() {
      filterOpts.value.search = ''
      filterOpts.value.code = undefined
      filterOpts.value.source = undefined
      filterOpts.value.sort = undefined
    }

    function openFiltersDialog() {
      $q.dialog({
        component: TaxTypeFiltersDialog,
        componentProps: { filterOpts: filterOpts.value },
      }).onOk(newFilterOpts => {
        Object.assign(filterOpts.value, newFilterOpts)
      })
    }

    const taxTypeDetailDialog = ref({ show: false, taxType: null })

    function openTaxTypeDetailDialog(taxType) {
      taxTypeDetailDialog.value.taxType = taxType
      taxTypeDetailDialog.value.show = true
    }

    function closeTaxTypeDetailDialog() {
      taxTypeDetailDialog.value.show = false
    }

    function openEditTaxTypeDialog(taxType) {
      if (!taxType?.isCustom) return
      closeTaxTypeDetailDialog()
      $q.dialog({
        component: TaxTypeFormDialog,
        componentProps: { taxType },
      }).onOk(() => fetchTaxTypes({ offset: 0 }))
    }

    function setAsDefaultTaxType(taxType) {
      if (!taxType?.id || isDefaultTaxType(taxType)) return
      return backend.patch(`shops/${marketplaceStore.activeShopId}/settings/`, {
        default_tax_type_id: taxType.id,
      })
        .then(response => {
          if (response?.data?.id) marketplaceStore.setShopSettingsData(response.data)
          else marketplaceStore.refetchShopSettings()
          $q.notify({
            type: 'positive',
            message: $t('DefaultTaxTypeUpdated', 'Default tax type updated'),
          })
          return response
        })
        .catch(error => {
          $q.notify({
            type: 'negative',
            message: error?.response?.data?.detail
              || $t('FailedToUpdateDefaultTaxType', 'Failed to update default tax type'),
          })
        })
    }

    function confirmDeleteTaxType(taxType) {
      if (!taxType?.isCustom) return
      closeTaxTypeDetailDialog()
      $q.dialog({
        title: $t('DeleteTaxType', 'Delete tax type'),
        message: $t(
          'DeleteTaxTypeConfirm',
          { name: taxType.name },
          `Delete tax type "${taxType.name}"? This cannot be undone.`,
        ),
        color: 'negative',
        ok: { label: $t('Delete'), color: 'negative', noCaps: true },
        cancel: { label: $t('Cancel'), flat: true, noCaps: true },
      }).onOk(() => deleteTaxType(taxType))
    }

    function deleteTaxType(taxType) {
      return backend.delete(`tax-types/${taxType.id}/`)
        .then(() => {
          $q.notify({
            type: 'positive',
            message: $t('TaxTypeDeleted', 'Tax type deleted'),
          })
          return Promise.allSettled([
            fetchTaxTypes({ offset: 0 }),
            marketplaceStore.refetchShopSettings(),
          ])
        })
        .catch(error => {
          $q.notify({
            type: 'negative',
            message: error?.response?.data?.detail
              || $t('FailedToDeleteTaxType', 'Failed to delete tax type'),
          })
        })
    }

    function confirmDetachTaxType(taxType) {
      if (!taxType?.id || taxType.source !== 'platform') return
      if (isDefaultTaxType(taxType)) return
      closeTaxTypeDetailDialog()
      $q.dialog({
        title: $t('RemoveTaxTypeFromShop', 'Remove tax type from shop'),
        message: $t(
          'RemoveTaxTypeFromShopConfirm',
          { name: taxType.name },
          `Remove tax type "${taxType.name}" from this shop? It will no longer be available here, but you can add it again later.`,
        ),
        color: 'negative',
        ok: { label: $t('Remove', 'Remove'), color: 'negative', noCaps: true },
        cancel: { label: $t('Cancel'), flat: true, noCaps: true },
      }).onOk(() => detachTaxType(taxType))
    }

    function detachTaxType(taxType) {
      if (!taxType?.id) return Promise.resolve()
      return backend.delete(`shops/${marketplaceStore.activeShopId}/tax-types/${taxType.id}/`)
        .then(() => {
          $q.notify({
            type: 'positive',
            message: $t('TaxTypeRemovedFromShop', 'Tax type removed from shop'),
          })
          return Promise.allSettled([
            fetchTaxTypes({ offset: 0 }),
            marketplaceStore.refetchShopSettings(),
          ])
        })
        .catch(error => {
          $q.notify({
            type: 'negative',
            message: error?.response?.data?.detail
              || (Array.isArray(error?.response?.data) ? error.response.data[0] : null)
              || $t('FailedToRemoveTaxType', 'Failed to remove tax type from shop'),
          })
        })
    }

    async function refreshShopSettingsIfNeeded() {
      if (isTaxSetupComplete.value) return
      return marketplaceStore.refetchShopSettingsIfStale({ maxAge: SHOP_SETTINGS_MAX_AGE }).catch(() => {})
    }

    async function refreshPage(done = () => {}) {
      try {
        await Promise.allSettled([fetchTaxTypes({ offset: 0 }), refreshShopSettingsIfNeeded()])
      } finally {
        done?.()
      }
    }

    const taxTypesTableColumns = [
      { name: 'name', align: 'left', label: $t('Name'), field: 'name', sortable: true },
      { name: 'code', align: 'left', label: $t('Code'), field: 'code', sortable: true, classes: 'hidden-xs' },
      { name: 'value', align: 'center', label: $t('Rate', 'Rate'), field: 'value', sortable: true },
    ]

    onMounted(() => refreshPage())

    return {
      filterOpts,
      taxTypes,
      displayedTaxTypes,
      fetchingTaxTypes,
      taxTypesTableColumns,
      pagination,
      sortMethod,
      allLoaded,
      hasDefaultTaxType,
      hasAppliedRegime,
      isTaxSetupComplete,
      isDefaultTaxType,
      getTaxCodeLabel,
      activeFilterCount,
      activeFilterChips,
      codeFilterOptions,
      sourceFilterOptions,
      clearSearch,
      removeFilter,
      resetFilters,
      openFiltersDialog,
      openEditTaxTypeDialog,
      openTaxTypeDetailDialog,
      taxTypeDetailDialog,
      taxSetupTasks,
      taxSetupTaskIndex,
      goToSetupTask,
      setAsDefaultTaxType,
      confirmDeleteTaxType,
      deleteTaxType,
      confirmDetachTaxType,
      detachTaxType,
      fetchTaxTypes,
      refreshPage,
    }
  },
})
</script>