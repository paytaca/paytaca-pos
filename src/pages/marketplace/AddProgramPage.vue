<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader
        :title="config.headerTitle"
        :subtitle="$t('Marketplace')"
        back-button-mode="back"
        show-back-button
      />

      <!-- Create-your-own CTA: always visible so the custom path is never buried. -->
      <q-card flat bordered class="q-mb-md" style="border-radius:12px;">
        <q-card-section class="row items-center no-wrap q-py-sm">
          <q-icon name="storefront" color="brandblue" size="sm" class="q-mr-sm" />
          <div class="q-space text-body2 text-grey-8">
            {{ config.introText }}
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions>
          <q-btn
            outline
            no-caps
            color="brandblue"
            icon="edit_note"
            :label="config.createLabel"
            @click="config.openCreate()"
          />
        </q-card-actions>
      </q-card>

      <div class="row items-end q-mb-sm no-wrap q-gutter-x-sm">
        <q-input
          dense
          outlined
          class="q-space"
          v-model="search"
          :placeholder="$t('SearchByName', 'Search by name')"
          debounce="300"
        >
          <template v-slot:prepend><q-icon name="search" /></template>
          <template v-slot:append>
            <q-icon
              v-if="search"
              name="clear"
              class="cursor-pointer"
              @click="search = ''"
            />
          </template>
        </q-input>
      </div>

      <div class="row items-center no-wrap q-mb-sm">
        <q-checkbox dense v-model="hideAdded" :label="$t('HideAdded', 'Hide added')" />
        <q-space />
        <q-btn
          v-if="selected.length"
          dense
          no-caps
          color="brandblue"
          :loading="addingSelected"
          :disable="addingSelected"
          :label="$t('AddSelected', { count: selected.length }, `Add ${selected.length} selected`)"
          icon="add"
          @click="addSelected"
        />
      </div>

      <q-table
        row-key="id"
        :loading="fetching"
        :columns="tableColumns"
        :rows="displayedRows"
        selection="multiple"
        v-model:selected="selected"
        :pagination="{ rowsPerPage: 0 }"
        hide-pagination
        binary-state-sort
        :sort-method="sortMethod"
        :no-data-label="$t('NoPlatformProgramsAvailable', 'No platform programs are available for this shop')"
        :no-results-label="$t('NoPlatformProgramsFound', 'No platform programs found')"
      >
        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td auto-width>
              <q-checkbox
                :model-value="isSelected(props.row)"
                :disable="isAdded(props.row)"
                color="brandblue"
                @update:model-value="toggleRow(props.row)"
              />
            </q-td>
            <q-td key="name" :props="props">
              <div class="row items-center q-gutter-x-xs">
                <span class="text-weight-medium">{{ props.row.name || '—' }}</span>
                <q-chip
                  v-if="isAdded(props.row)"
                  dense
                  size="xs"
                  color="green-2"
                  text-color="dark"
                  icon="check"
                >
                  {{ $t('Added', 'Added') }}
                </q-chip>
              </div>
              <div v-if="config.subtitle(props.row)" class="text-caption text-grey">
                {{ config.subtitle(props.row) }}
              </div>
            </q-td>
            <q-td key="value" :props="props">
              {{ config.value(props.row) }}
            </q-td>
            <q-td key="actions" :props="props" class="text-center">
              <q-btn
                flat
                round
                dense
                icon="visibility"
                color="grey-7"
                @click.stop="openDetail(props.row)"
              >
                <q-tooltip>{{ $t('ViewDetails', 'View details') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="!isAdded(props.row)"
                flat
                round
                dense
                icon="add_circle"
                color="brandblue"
                :loading="addingId === props.row.id"
                @click.stop="addToShop(props.row)"
              >
                <q-tooltip>{{ $t('AddToShop', 'Add to shop') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-else
                flat
                round
                dense
                icon="link_off"
                color="negative"
                :loading="removingId === props.row.id"
                @click.stop="confirmRemove(props.row)"
              >
                <q-tooltip>{{ $t('RemoveFromShop', 'Remove from shop') }}</q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
        <template v-slot:bottom>
          <div class="row items-center full-width">
            <div class="text-caption text-grey">
              {{ displayedRows.length }} / {{ pagination.count }}
              {{ config.pluralLabel }}
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
              @update:modelValue="fetchCatalog"
            />
          </div>
        </template>
      </q-table>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { TaxType, DiscountType, BenefitProgram } from 'src/marketplace/objects'
import { useTaxTypeHelpers } from 'src/composables/marketplace/taxTypesForm'
import { useDiscountTypeHelpers } from 'src/composables/marketplace/discount'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { defineComponent, ref, computed, watch, onMounted } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import TaxTypeDetailDialog from 'src/components/marketplace/taxes/TaxTypeDetailDialog.vue'
import TaxTypeFormDialog from 'src/components/marketplace/taxes/TaxTypeFormDialog.vue'
import DiscountTypeDetailDialog from 'src/components/marketplace/discounts/DiscountTypeDetailDialog.vue'
import BenefitProgramDetailDialog from 'src/components/marketplace/benefits/BenefitProgramDetailDialog.vue'

const DEFAULT_LIMIT = 10
const LINKED_FETCH_LIMIT = 500

export default defineComponent({
  name: 'AddProgramPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const { t: $t } = useI18n()
    const $q = useQuasar()
    const $route = useRoute()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    const { getTaxCodeLabel, taxRateLabel } = useTaxTypeHelpers()
    const {
      getDiscountCodeLabel,
      getDiscountScopeLabel,
      formatDiscountValue,
    } = useDiscountTypeHelpers()

    const programType = computed(() => $route.meta?.programType || 'tax')
    const shopId = computed(() => marketplaceStore.activeShopId)

    const catalog = ref([])
    const linkedIds = ref(new Set())
    const fetching = ref(false)
    const addingId = ref(null)
    const addingSelected = ref(false)
    const removingId = ref(null)
    const search = ref('')
    const hideAdded = ref(false)
    const sort = ref(undefined)
    const selected = ref([])
    const pagination = ref({ offset: 0, limit: DEFAULT_LIMIT, count: 0 })

    // --- Beneficiary category names (benefit programs only) ---
    const beneficiaryCategoryNames = ref({})
    function fetchBeneficiaryCategories() {
      return backend.get('beneficiary-categories/')
        .then(response => {
          const map = {}
          for (const category of response?.data?.results || []) {
            if (category?.code) map[category.code] = category.name
          }
          beneficiaryCategoryNames.value = map
          return response
        })
        .catch(() => {})
    }
    function getBeneficiaryCategoryName(code) {
      return beneficiaryCategoryNames.value[code] || code
    }

    // --- Per-entity configuration ---
    const configByType = {
      tax: {
        endpoint: 'tax-types/',
        parse: TaxType.parse,
        headerTitle: $t('AddTaxTypes', 'Add tax types'),
        introText: $t(
          'AddTaxTypesIntro',
          'Platform tax types are provided by Paytaca and shared across shops. Add the ones you want to use, or create your own.',
        ),
        createLabel: $t('CreateTaxType', 'Create tax type'),
        pluralLabel: $t('TaxTypes', 'tax types').toLowerCase(),
        detailComponent: TaxTypeDetailDialog,
        detailProp: 'taxType',
        openCreate: openTaxTypeCreateDialog,
        linkPath: id => `shops/${shopId.value}/tax-types/${id}/`,
        subtitle: row => getTaxCodeLabel(row.code),
        value: row => (Number.isFinite(row.value) ? `${Number(row.value.toFixed(2))}%` : '—'),
      },
      discount: {
        endpoint: 'discount-types/',
        parse: DiscountType.parse,
        headerTitle: $t('AddDiscounts', 'Add discounts'),
        introText: $t(
          'AddDiscountsIntro',
          'Platform discounts are provided by Paytaca. Add the ones you want to offer in this shop, or create your own.',
        ),
        createLabel: $t('CreateDiscount', 'Create discount'),
        pluralLabel: $t('Discounts', 'discounts').toLowerCase(),
        detailComponent: DiscountTypeDetailDialog,
        detailProp: 'discountType',
        openCreate: () => $router.push({ name: 'marketplace-discount-create' }),
        linkPath: id => `shops/${shopId.value}/discount-types/${id}/`,
        subtitle: row => [getDiscountCodeLabel(row.code), getDiscountScopeLabel(row.scope)]
          .filter(Boolean).join(' · '),
        value: row => formatDiscountValue(row, { includeMax: false }),
      },
      benefit: {
        endpoint: 'benefit-programs/',
        parse: BenefitProgram.parse,
        headerTitle: $t('AddBenefitPrograms', 'Add benefit programs'),
        introText: $t(
          'AddBenefitProgramsIntro',
          'Platform benefit programs are provided by Paytaca. Add the ones you want to offer in this shop, or create your own.',
        ),
        createLabel: $t('CreateBenefitProgram', 'Create benefit program'),
        pluralLabel: $t('BenefitPrograms', 'benefit programs').toLowerCase(),
        detailComponent: BenefitProgramDetailDialog,
        detailProp: 'benefitProgram',
        openCreate: () => $router.push({ name: 'marketplace-benefit-create' }),
        linkPath: id => `shops/${shopId.value}/benefit-programs/${id}/`,
        subtitle: row => {
          const codes = row.beneficiaryCategoryCodes || []
          return codes.map(getBeneficiaryCategoryName).join(', ')
        },
        value: row => {
          const count = Array.isArray(row.discounts) ? row.discounts.length : 0
          if (count) return $t('DiscountCount', { count }, `${count} discount(s)`)
          return taxRateLabel(row.taxType) || '—'
        },
      },
    }

    const config = computed(() => configByType[programType.value] || configByType.tax)

    const tableColumns = computed(() => [
      { name: 'name', align: 'left', label: $t('Name'), field: 'name', sortable: true },
      { name: 'value', align: 'left', label: $t('Value', 'Value'), field: 'value' },
      { name: 'actions', align: 'center', label: '', field: 'id' },
    ])

    // --- Catalog ---
    async function fetchCatalog(opts = { limit: 0, offset: 0 }) {
      const params = {
        available_for_shop_id: shopId.value,
        source: 'platform',
        limit: opts?.limit || pagination.value.limit || DEFAULT_LIMIT,
        offset: opts?.offset || 0,
      }
      if (search.value?.trim()) params.s = search.value.trim()
      if (sort.value) params.ordering = sort.value

      fetching.value = true
      return backend.get(config.value.endpoint, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          catalog.value = response.data.results.map(config.value.parse)
          pagination.value.limit = response?.data?.limit || pagination.value.limit
          pagination.value.offset = response?.data?.offset || 0
          pagination.value.count = response?.data?.count || 0
          selected.value = []
          return response
        })
        .finally(() => {
          fetching.value = false
        })
    }

    /**
     * Ids of platform records already linked to the shop. `available_for_shop_id`
     * returns both the addable catalog and the already-linked records, so the
     * shop's current (platform) list is used to tell them apart.
     */
    async function fetchLinkedIds() {
      const shopParam = programType.value === 'tax' ? 'shop_id' : 'shop_ids'
      return backend.get(config.value.endpoint, {
        params: {
          [shopParam]: shopId.value,
          source: 'platform',
          limit: LINKED_FETCH_LIMIT,
          offset: 0,
        },
      })
        .then(response => {
          const results = response?.data?.results || []
          linkedIds.value = new Set(results.map(row => row.id))
          return response
        })
        .catch(() => {})
    }

    function isAdded(row) {
      return Boolean(row?.id && linkedIds.value.has(row.id))
    }

    const displayedRows = computed(() => {
      if (!hideAdded.value) return catalog.value
      return catalog.value.filter(row => !isAdded(row))
    })

    function isSelected(row) {
      return selected.value.includes(row)
    }
    function toggleRow(row) {
      if (isAdded(row)) return
      if (isSelected(row)) {
        selected.value = selected.value.filter(item => item !== row)
      } else {
        selected.value = [...selected.value, row]
      }
    }

    function sortMethod(rows, sortBy, descending) {
      sort.value = (descending ? '-' : '') + (sortBy === 'value' ? 'value' : 'name')
      return rows
    }

    // --- Linking ---
    function extractErrorMessage(error, fallback) {
      const data = error?.response?.data
      if (!data) return fallback
      if (typeof data === 'string') return data
      if (Array.isArray(data)) return data[0]
      if (typeof data === 'object') {
        return data.detail || data.non_field_errors?.[0] || Object.values(data)[0]
      }
      return fallback
    }

    async function addToShop(row) {
      if (!row?.id || isAdded(row)) return
      addingId.value = row.id
      return backend.post(config.value.linkPath(row.id))
        .then(() => {
          linkedIds.value = new Set(linkedIds.value).add(row.id)
          selected.value = selected.value.filter(item => item.id !== row.id)
          $q.notify({
            type: 'positive',
            message: $t('AddedToShop', { name: row.name }, `Added "${row.name}" to shop`),
          })
        })
        .catch(error => {
          $q.notify({
            type: 'negative',
            message: extractErrorMessage(error, $t('FailedToAddToShop', 'Failed to add to shop')),
          })
          return Promise.reject(error)
        })
        .finally(() => {
          addingId.value = null
        })
    }

    async function addSelected() {
      const rows = selected.value.filter(row => !isAdded(row))
      if (!rows.length) return
      addingSelected.value = true
      const results = await Promise.allSettled(rows.map(row => addToShop(row)))
      addingSelected.value = false

      const added = results.filter(result => result.status === 'fulfilled').length
      const failed = results.length - added
      if (failed > 0) {
        $q.notify({
          type: 'warning',
          message: $t(
            'AddedSomeToShop',
            { added, failed },
            `Added ${added} item(s); ${failed} failed`,
          ),
        })
      }
      selected.value = []
    }

    function confirmRemove(row) {
      if (!row?.id || !isAdded(row)) return
      $q.dialog({
        title: $t('RemoveFromShop', 'Remove from shop'),
        message: $t(
          'RemoveProgramFromShopConfirm',
          { name: row.name },
          `Remove "${row.name}" from this shop? It will no longer be available here, but you can add it again later.`,
        ),
        color: 'negative',
        ok: { label: $t('Remove', 'Remove'), color: 'negative', noCaps: true },
        cancel: { label: $t('Cancel'), flat: true, noCaps: true },
      }).onOk(() => removeFromShop(row))
    }

    async function removeFromShop(row) {
      if (!row?.id || !isAdded(row)) return
      removingId.value = row.id
      return backend.delete(config.value.linkPath(row.id))
        .then(() => {
          const next = new Set(linkedIds.value)
          next.delete(row.id)
          linkedIds.value = next
          selected.value = selected.value.filter(item => item.id !== row.id)
          $q.notify({
            type: 'positive',
            message: $t('RemovedFromShop', { name: row.name }, `Removed "${row.name}" from shop`),
          })
        })
        .catch(error => {
          $q.notify({
            type: 'negative',
            message: extractErrorMessage(error, $t('FailedToRemoveFromShop', 'Failed to remove from shop')),
          })
          return Promise.reject(error)
        })
        .finally(() => {
          removingId.value = null
        })
    }

    // --- Detail / create ---
    function openDetail(row) {
      $q.dialog({
        component: config.value.detailComponent,
        componentProps: { [config.value.detailProp]: row },
      })
    }

    function openTaxTypeCreateDialog() {
      $q.dialog({ component: TaxTypeFormDialog })
        .onOk(() => $router.push({ name: 'marketplace-taxes' }))
    }

    // --- Lifecycle ---
    let searchTimer = null
    watch(search, () => {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => fetchCatalog({ offset: 0 }), 300)
    })
    watch(sort, () => fetchCatalog({ offset: 0 }))

    async function refreshPage(done = () => {}) {
      try {
        const tasks = [fetchCatalog({ offset: 0 }), fetchLinkedIds()]
        if (programType.value === 'benefit') tasks.push(fetchBeneficiaryCategories())
        await Promise.allSettled(tasks)
      } finally {
        done?.()
      }
    }

    onMounted(() => refreshPage())

    return {
      config,
      tableColumns,
      catalog,
      displayedRows,
      fetching,
      addingId,
      addingSelected,
      removingId,
      search,
      hideAdded,
      selected,
      pagination,
      fetchCatalog,
      sortMethod,
      isAdded,
      isSelected,
      toggleRow,
      addToShop,
      addSelected,
      confirmRemove,
      removeFromShop,
      openDetail,
      refreshPage,
      getBeneficiaryCategoryName,
    }
  },
})
</script>
