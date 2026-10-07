<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader
        :title="$t('BenefitPrograms', {}, 'Benefit Programs')"
        :subtitle="$t('Marketplace')"
        back-button-mode="back"
        show-back-button
      />

      <div class="full-width q-mb-sm">
        <div class="row items-end q-mb-sm no-wrap q-gutter-x-sm">
          <q-input
            dense
            outlined
            class="q-space"
            v-model="filterOpts.search"
            :placeholder="$t('SearchByName', 'Search by name')"
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
            :to="{ name: 'marketplace-benefit-create' }"
          >
            <q-tooltip>
              {{ $t('CreateBenefitProgram', {}, 'Create benefit program') }}
            </q-tooltip>
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
        :loading="fetchingBenefitPrograms"
        :columns="benefitProgramsTableColumns"
        :rows="displayedBenefitPrograms"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
        :no-data-label="$t('NoBenefitProgramsYet', 'No benefit programs yet')"
        :no-results-label="$t('NoBenefitProgramsFound', 'No benefit programs found')"
      >
        <template v-slot:body="props">
          <q-tr
            :props="props"
            class="cursor-pointer"
            @click="navigateToForm(props.row.id)"
          >
            <q-td key="name" :props="props">
              <div class="row items-center q-gutter-x-xs">
                <span class="text-weight-medium">{{ props.row.name || '—' }}</span>
                <q-chip
                  dense
                  size="xs"
                  :color="props.row.source === 'custom' ? 'blue-1' : 'grey-3'"
                  text-color="dark"
                >
                  {{ props.row.source === 'custom' ? $t('Custom') : $t('Platform') }}
                </q-chip>
              </div>
              <div
                v-if="props.row.description"
                class="text-caption text-grey ellipsis-2-lines program-description"
              >
                {{ props.row.description }}
              </div>
            </q-td>
            <q-td key="beneficiaryCategories" :props="props">
              <div v-if="props.row.beneficiaryCategoryCodes?.length" class="row items-center q-gutter-x-xs">
                <q-chip
                  v-for="code in props.row.beneficiaryCategoryCodes"
                  :key="code"
                  dense
                  size="sm"
                  color="blue-1"
                  text-color="dark"
                >
                  {{ getBeneficiaryCategoryName(code) }}
                </q-chip>
              </div>
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
            <q-td key="taxType" :props="props">
              <div
                v-if="props.row.taxType?.id"
                class="row items-center no-wrap q-gutter-x-xs"
              >
                <span>{{ props.row.taxType.name }}</span>
                <span v-if="getTaxRateLabel(props.row.taxType)" class="text-caption text-grey">
                  {{ getTaxRateLabel(props.row.taxType) }}
                </span>
              </div>
              <span v-else class="text-grey text-caption">—</span>
            </q-td>
            <q-td key="discounts" :props="props" class="text-center">
              <div
                v-if="getDiscounts(props.row).length"
                class="row items-center justify-center flex-wrap q-gutter-x-xs"
              >
                <q-chip
                  v-for="(discount, index) in getDiscounts(props.row)"
                  :key="index"
                  dense
                  size="sm"
                  color="blue-1"
                  text-color="dark"
                >
                  {{ getDiscountAmountLabel(discount) }}
                </q-chip>
              </div>
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
                @click.stop="navigateToForm(props.row.id)"
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
              {{ displayedBenefitPrograms.length }} / {{ pagination.count }}
              {{ $t('BenefitPrograms', {}, 'benefit programs').toLowerCase() }}
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
              @update:modelValue="fetchBenefitPrograms"
            />
          </div>
        </template>
      </q-table>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { BenefitProgram } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import BenefitProgramsFiltersDialog from 'src/components/marketplace/benefits/BenefitProgramsFiltersDialog.vue'

const DEFAULT_LIMIT = 10

export default defineComponent({
  name: 'BenefitProgramsPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const { t: $t } = useI18n()
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    const benefitPrograms = ref([].map(BenefitProgram.parse))
    const fetchingBenefitPrograms = ref(false)
    const pagination = ref({ offset: 0, limit: DEFAULT_LIMIT, count: 0 })
    const filterOpts = ref({
      search: '',
      source: undefined,
      beneficiaryCategoryCodes: [],
    })
    /**
     * Whether the list currently in memory was fetched with a filter applied
     * (`s` query param). A filtered result can never be considered "all
     * loaded", even when its count happens to fit within the page size.
     */
    const fetchedWithFilter = ref(false)

    /**
     * The whole (unfiltered) list is only fully loaded when the server count
     * fits within the current page size AND the list was fetched without a
     * filter. Otherwise there are more records on the server and the `s` +
     * `limit`/`offset` query params are used instead.
     */
    const allLoaded = computed(() => {
      return !fetchedWithFilter.value && pagination.value.count <= pagination.value.limit
    })

    async function fetchBenefitPrograms(opts = { limit: 0, offset: 0 }) {
      const params = {
        shop_ids: marketplaceStore.activeShopId,
        limit: opts?.limit || pagination.value.limit || DEFAULT_LIMIT,
        offset: opts?.offset || 0,
      }
      // `source` and `beneficiary_category_codes` filtering are done
      // client-side since the API does not support them (platform programs
      // have a null source, which the `source` query param cannot match).
      if (!allLoaded.value && filterOpts.value.search?.trim?.()) {
        params.s = filterOpts.value.search.trim()
      }
      fetchingBenefitPrograms.value = true
      return backend.get(`benefit-programs/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          benefitPrograms.value = response.data.results.map(BenefitProgram.parse)
          pagination.value.limit = response?.data?.limit || pagination.value.limit
          pagination.value.offset = response?.data?.offset || 0
          pagination.value.count = response?.data?.count || 0
          fetchedWithFilter.value = Boolean(params.s)
          return response
        })
        .finally(() => {
          fetchingBenefitPrograms.value = false
        })
    }

    watch(filterOpts, () => {
      if (allLoaded.value) return
      fetchBenefitPrograms({ offset: 0 })
    }, { deep: true })

    /**
     * A program is considered "platform" when its source is not `custom`
     * (the API returns `null` for platform-provided programs).
     * @param {BenefitProgram} program
     */
    function matchesSource(program) {
      const source = filterOpts.value.source
      if (source === undefined) return true
      if (source === 'custom') return program.source === 'custom'
      return program.source !== 'custom'
    }

    const displayedBenefitPrograms = computed(() => {
      const categoryCodes = filterOpts.value.beneficiaryCategoryCodes || []
      const query = filterOpts.value.search?.trim().toLowerCase()
      return benefitPrograms.value.filter(program => {
        if (!matchesSource(program)) return false
        if (categoryCodes.length) {
          const programCodes = program.beneficiaryCategoryCodes || []
          if (!categoryCodes.some(code => programCodes.includes(code))) return false
        }
        // When not all records are loaded, `s` was already applied
        // server-side, so the text search is not re-applied here.
        if (!allLoaded.value) return true
        if (!query) return true
        return [program.name, program.description].some(field => {
          return String(field ?? '').toLowerCase().includes(query)
        })
      })
    })

    // --- Beneficiary categories (for name lookup and filters) ---
    const beneficiaryCategories = ref([])
    const fetchingBeneficiaryCategories = ref(false)
    function fetchBeneficiaryCategories() {
      fetchingBeneficiaryCategories.value = true
      return backend.get(`beneficiary-categories/`)
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          beneficiaryCategories.value = response.data.results
          return response
        })
        .finally(() => {
          fetchingBeneficiaryCategories.value = false
        })
    }

    const beneficiaryCategoryNameMap = computed(() => {
      const map = {}
      beneficiaryCategories.value.forEach(category => {
        if (category?.code) map[category.code] = category.name
      })
      return map
    })
    function getBeneficiaryCategoryName(code) {
      return beneficiaryCategoryNameMap.value[code] || code
    }

    // --- Tax type helpers ---
    function getTaxRateLabel(taxType) {
      if (!Number.isFinite(taxType?.value)) return ''
      return `${Number(taxType.value.toFixed(2))}%`
    }

    /**
     * Builds the amount label for a discount, e.g. `50 PHP`, `10%` or
     * `10% max 100 PHP`.
     * @param {import('src/marketplace/objects').DiscountType} discount
     */
    function getDiscountAmountLabel(discount) {
      const currency =
        discount?.currency?.symbol ||
        discount?.currency?.code ||
        marketplaceStore?.merchant?.currency?.code ||
        marketplaceStore?.merchant?.currency?.symbol ||
        ''

      let label = '—'
      if (discount?.type === 'percentage') {
        label = `${Number((Number(discount?.value || 0) * 100).toFixed(2))}%`
      } else if (discount?.value != null && Number.isFinite(Number(discount.value))) {
        const value = Number(discount.value).toFixed(2)
        label = currency ? `${Number(value)} ${currency}` : `${Number(value)}`
      }

      const maxAmount = Number(discount?.maxAmount)
      if (Number.isFinite(maxAmount) && maxAmount > 0) {
        label += ` ${$t('Max', 'max')} ${Number(maxAmount.toFixed(2))}`
        if (currency) label += ` ${currency}`
      }
      return label
    }

    function getDiscounts(program) {
      return Array.isArray(program?.discounts) ? program.discounts : []
    }

    // --- Filter helpers ---
    const sourceFilterOptions = computed(() => [
      { label: $t('All'), value: undefined },
      { label: $t('Platform', 'Platform'), value: 'platform' },
      { label: $t('Custom', 'Custom'), value: 'custom' },
    ])

    const activeFilterCount = computed(() => {
      let count = 0
      if (filterOpts.value.search) count++
      if (filterOpts.value.source !== undefined) count++
      if (filterOpts.value.beneficiaryCategoryCodes?.length) count++
      return count
    })

    const activeFilterChips = computed(() => {
      const chips = []
      if (filterOpts.value.source !== undefined) {
        const label = sourceFilterOptions.value.find(opt => opt.value === filterOpts.value.source)?.label
        chips.push({ key: 'source', label: `${$t('Source')}: ${label}` })
      }
      if (filterOpts.value.beneficiaryCategoryCodes?.length) {
        const labels = filterOpts.value.beneficiaryCategoryCodes.map(getBeneficiaryCategoryName)
        chips.push({
          key: 'beneficiaryCategoryCodes',
          label: `${$t('BeneficiaryCategories', {}, 'Beneficiary Categories')}: ${labels.join(', ')}`,
        })
      }
      return chips
    })

    function clearSearch() {
      filterOpts.value.search = ''
    }
    function removeFilter(key) {
      if (key === 'beneficiaryCategoryCodes') filterOpts.value.beneficiaryCategoryCodes = []
      else filterOpts.value[key] = undefined
    }
    function resetFilters() {
      filterOpts.value.search = ''
      filterOpts.value.source = undefined
      filterOpts.value.beneficiaryCategoryCodes = []
    }

    function openFiltersDialog() {
      $q.dialog({
        component: BenefitProgramsFiltersDialog,
        componentProps: {
          filterOpts: filterOpts.value,
          beneficiaryCategoryOptions: beneficiaryCategories.value,
        },
      }).onOk(newFilterOpts => {
        Object.assign(filterOpts.value, newFilterOpts)
      })
    }

    // --- Navigation ---
    function navigateToForm(benefitProgramId) {
      $router.push({
        name: 'marketplace-benefit-edit',
        params: { benefitProgramId },
      })
    }

    async function refreshPage(done = () => {}) {
      try {
        await Promise.allSettled([
          fetchBenefitPrograms({ offset: 0 }),
          fetchBeneficiaryCategories(),
        ])
      } finally {
        done?.()
      }
    }

    const benefitProgramsTableColumns = [
      { name: 'name', align: 'left', label: $t('Name'), field: 'name' },
      { name: 'beneficiaryCategories', align: 'left', label: $t('BeneficiaryCategories', {}, 'Beneficiary Categories'), field: 'beneficiaryCategoryCodes' },
      { name: 'taxType', align: 'left', label: $t('TaxType', {}, 'Tax Type'), field: (row) => row.taxType?.name },
      { name: 'discounts', align: 'center', label: $t('Discounts'), field: 'discounts', classes: 'hidden-xs' },
      { name: 'actions', align: 'center', label: '', field: 'id' },
    ]

    onMounted(() => refreshPage())

    return {
      filterOpts,
      benefitPrograms,
      displayedBenefitPrograms,
      fetchingBenefitPrograms,
      benefitProgramsTableColumns,
      pagination,
      allLoaded,

      beneficiaryCategories,
      fetchingBeneficiaryCategories,
      getBeneficiaryCategoryName,

      getTaxRateLabel,
      getDiscounts,
      getDiscountAmountLabel,

      sourceFilterOptions,
      activeFilterCount,
      activeFilterChips,
      clearSearch,
      removeFilter,
      resetFilters,
      openFiltersDialog,

      navigateToForm,

      fetchBenefitPrograms,
      fetchBeneficiaryCategories,
      refreshPage,
    }
  },
})
</script>
<style scoped>
.program-description {
  max-width: 320px;
}
</style>
