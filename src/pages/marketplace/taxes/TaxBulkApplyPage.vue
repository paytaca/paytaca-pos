<template>
  <q-page class="q-pa-md q-pb-xl">
    <MarketplaceHeader back-button-mode="back" show-back-button>
      <template v-slot:title>
        <div class="q-space">
          <div class="text-h5">{{ $t('BulkApplyTaxType', 'Set tax types') }}</div>
          <div class="text-grey">{{ $t('Marketplace') }}</div>
        </div>
      </template>
    </MarketplaceHeader>

    <q-banner v-if="!canApply" rounded dense class="bg-warning text-dark q-mb-md">
      <template v-slot:avatar>
        <q-icon name="lock" size="sm" />
      </template>
      {{ $t('BulkApplyNoPermission', 'You need an inventory or admin role to set tax types in bulk.') }}
    </q-banner>

    <template v-else>
      <q-stepper
        v-model="step"
        flat
        :dense="mobile"
        animated
        header-nav
        color="brandblue"
        class="bg-transparent"
      >
        <!-- Step 1 — configure -->
        <q-step
          :name="1"
          icon="tune"
          :title="$t('Configure')"
          :done="step > 1"
        >
          <q-card class="q-mb-md" style="border-radius:16px;">
            <q-card-section class="q-gutter-y-md">
              <div>
                <div class="text-subtitle2">{{ $t('ProductsToUpdate', 'Products to update') }}</div>
                <div class="text-caption text-grey">{{ scopeLabel }}</div>
                <div v-if="selectionMode === 'filter'" class="q-mt-xs">
                  <q-chip
                    v-if="filterValues.has_tax_type === 'false'"
                    dense
                    size="sm"
                    color="blue-1"
                    text-color="dark"
                  >
                    {{ $t('ProductsWithoutTaxType', 'Products without a tax type') }}
                  </q-chip>
                  <q-chip
                    v-if="filterValues.has_tax_type === 'true'"
                    dense
                    size="sm"
                    color="blue-1"
                    text-color="dark"
                  >
                    {{ $t('ProductsWithTaxType', 'Products with a tax type') }}
                  </q-chip>
                  <q-chip
                    v-if="filterValues.s"
                    dense
                    size="sm"
                    color="blue-1"
                    text-color="dark"
                  >
                    {{ $t('Search') }}: {{ filterValues.s }}
                  </q-chip>
                  <q-chip
                    v-if="filterValues.categories.length"
                    dense
                    size="sm"
                    color="blue-1"
                    text-color="dark"
                  >
                    {{ $t('Categories') }}: {{ filterValues.categories.join(', ') }}
                  </q-chip>
                </div>
              </div>

              <div>
                <div>{{ $t('TaxType') }}</div>
                <q-select
                  dense
                  outlined
                  emit-value
                  map-options
                  clearable
                  :loading="fetchingTaxTypes"
                  :disable="fetchingTaxTypes"
                  :options="taxTypeOptions"
                  option-value="id"
                  option-label="name"
                  v-model="targetTaxTypeId"
                  :placeholder="$t('SelectTaxType', 'Select a tax type')"
                >
                  <template v-slot:option="ctx">
                    <q-item v-bind="ctx.itemProps">
                      <q-item-section>
                        <q-item-label>{{ ctx.opt.name }}</q-item-label>
                        <q-item-label caption>
                          {{ ctx.opt.code }} | {{ ctx.opt.value }}%
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <div class="text-caption text-grey q-mt-xs">
                  {{ $t('BulkApplyTargetHint', 'Only tax types available to this shop can be chosen. Leave empty with Overwrite on to clear tax types.') }}
                </div>
              </div>

              <div>
                <q-toggle
                  v-model="overwrite"
                  color="brandblue"
                  :label="$t('OverwriteExistingTaxTypes', 'Overwrite existing tax types')"
                />
                <div class="text-caption text-grey">
                  {{ $t('OverwriteExistingTaxTypesHint', 'Off: only products with no tax type are changed. On: every matched product is set, replacing existing values.') }}
                </div>
              </div>
            </q-card-section>
          </q-card>

          <q-expansion-item
            class="rounded-borders q-mb-md"
            :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
            icon="tune"
            :label="$t('BulkApplyAdvanced', 'Advanced selection')"
            :caption="scopeLabel"
          >
            <div class="q-pa-md q-gutter-y-md">
              <div>
                <div class="text-subtitle2 q-mb-xs">{{ $t('BulkApplyScope', 'Apply to') }}</div>
                <q-btn-toggle
                  v-model="selectionMode"
                  spread
                  no-caps
                  unelevated
                  toggle-color="brandblue"
                  :options="scopeOptions"
                />
              </div>

              <!-- Filter scope: reuse a small subset of the products-list filters -->
              <template v-if="selectionMode === 'filter'">
                <q-input
                  dense
                  outlined
                  clearable
                  :debounce="500"
                  :label="$t('SearchProducts', 'Search products')"
                  v-model="filterValues.s"
                >
                  <template v-slot:append>
                    <q-icon name="search" />
                  </template>
                </q-input>

                <q-select
                  dense
                  outlined
                  multiple
                  use-chips
                  use-input
                  clearable
                  :label="$t('Categories', 'Categories')"
                  :loading="fetchingCategories"
                  :options="filteredCategoryOptions"
                  v-model="filterValues.categories"
                  @filter="filterCategories"
                />

                <q-select
                  dense
                  outlined
                  emit-value
                  map-options
                  clearable
                  :label="$t('CurrentTaxType', 'Current tax type')"
                  :hint="$t('CurrentTaxTypeHint', 'Narrow to products that already have a tax type, or only the ones without.')"
                  v-model="filterValues.has_tax_type"
                  :options="taxTypePresenceOptions"
                />
              </template>

              <!-- Explicit selection -->
              <template v-else>
                <q-btn
                  class="full-width"
                  outline
                  no-caps
                  color="brandblue"
                  icon="add"
                  :label="$t('ChooseProducts', 'Choose products')"
                  @click="openProductPicker"
                />

                <div v-if="selectedProducts.length" class="q-mt-sm">
                  <q-chip
                    v-for="product in selectedProducts.slice(0, 8)"
                    :key="`selected-${product.id}`"
                    dense
                    removable
                    @remove="() => removeSelectedProduct(product)"
                  >
                    {{ product.name || `#${product.id}` }}
                  </q-chip>
                  <q-chip v-if="selectedProducts.length > 8" dense>
                    +{{ selectedProducts.length - 8 }}
                  </q-chip>
                  <div class="q-mt-xs">
                    <q-btn
                      flat
                      dense
                      no-caps
                      color="grey-8"
                      :label="$t('ClearSelection', 'Clear selection')"
                      @click="clearSelectedProducts"
                    />
                  </div>
                </div>
                <div v-else class="text-caption text-grey">
                  {{ $t('NoProductsSelected', 'No products selected yet.') }}
                </div>
              </template>
            </div>
          </q-expansion-item>

          <q-banner v-if="previewError" rounded dense class="bg-red text-white q-mb-md">
            {{ previewError }}
          </q-banner>

          <q-btn
            class="full-width"
            color="brandblue"
            no-caps
            :disable="!canPreview"
            :loading="previewing"
            :label="$t('ReviewChanges', 'Review changes')"
            @click="reviewChanges"
          />
        </q-step>

        <!-- Step 2 — review -->
        <q-step
          :name="2"
          icon="fact_check"
          :title="$t('Review')"
          :disable="!preview"
        >
          <div v-if="!preview" class="text-grey text-center q-pa-lg">
            {{ $t('NoPreviewYet', 'Configure a change and run the preview first.') }}
          </div>

          <template v-else>
            <q-card class="q-mb-md" style="border-radius:16px;">
              <q-card-section>
                <div class="text-h6">
                  {{
                    $t(
                      'BulkApplyHeadline',
                      { changing: preview.will_change_count, matched: preview.matched_count },
                      `${preview.will_change_count} of ${preview.matched_count} products will change`
                    )
                  }}
                </div>
                <div class="text-subtitle2 q-mt-xs">
                  {{ $t('To') }}: {{ taxTypeName(preview.target_tax_type) }}
                </div>
                <div class="text-caption text-grey q-gutter-x-md">
                  <span v-if="Number(preview.already_set_count)">
                    {{
                      $t(
                        'BulkApplyAlreadySet',
                        { count: preview.already_set_count },
                        `${preview.already_set_count} already use this tax type`
                      )
                    }}
                  </span>
                  <span v-if="Number(preview.kept_existing_count)">
                    {{
                      $t(
                        'BulkApplyKeptExisting',
                        { count: preview.kept_existing_count },
                        `${preview.kept_existing_count} kept (different tax type)`
                      )
                    }}
                  </span>
                  <span v-if="Number(preview.without_tax_type_count)">
                    {{
                      $t(
                        'BulkApplyWithoutTaxType',
                        { count: preview.without_tax_type_count },
                        `${preview.without_tax_type_count} currently have no tax type`
                      )
                    }}
                  </span>
                </div>
              </q-card-section>
            </q-card>

            <q-banner
              v-if="Number(preview.price_semantics_changing_count)"
              rounded
              dense
              class="bg-warning text-dark q-mb-sm"
            >
              <template v-slot:avatar>
                <q-icon name="warning" size="sm" />
              </template>
              {{
                $t(
                  'BulkApplyPriceSemanticsWarning',
                  { count: preview.price_semantics_changing_count },
                  `${preview.price_semantics_changing_count} products change tax code; displayed or charged prices may change.`
                )
              }}
            </q-banner>

            <q-banner
              v-if="preview.ignored_product_ids?.length"
              rounded
              dense
              class="bg-warning text-dark q-mb-sm"
            >
              <template v-slot:avatar>
                <q-icon name="warning" size="sm" />
              </template>
              {{
                $t(
                  'BulkApplyIgnoredProducts',
                  { count: preview.ignored_product_ids.length },
                  `${preview.ignored_product_ids.length} selected products are not in this shop and were ignored.`
                )
              }}
            </q-banner>

            <q-banner
              v-for="(warning, index) in derivedWarnings"
              :key="`warning-${index}`"
              rounded
              dense
              class="bg-warning text-dark q-mb-sm"
            >
              <template v-slot:avatar>
                <q-icon name="warning" size="sm" />
              </template>
              {{ warning }}
            </q-banner>

            <div v-if="preview.by_current_tax_type?.length" class="q-mb-md">
              <div class="text-subtitle2 q-mb-xs">{{ $t('BulkApplyFromTo', 'From → To') }}</div>
              <q-markup-table dense flat bordered class="rounded-borders">
                <thead>
                  <tr>
                    <th class="text-left">{{ $t('From') }}</th>
                    <th class="text-right">{{ $t('Products') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in preview.by_current_tax_type" :key="`row-${index}`">
                    <td>{{ taxTypeName(row.tax_type) }}</td>
                    <td class="text-right">{{ row.count }}</td>
                  </tr>
                </tbody>
              </q-markup-table>
            </div>

            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-4">
                <q-card flat bordered class="q-pa-sm text-center" style="border-radius:12px;">
                  <div class="text-h6">{{ preview.variants_affected ?? 0 }}</div>
                  <div class="text-caption text-grey">{{ $t('Variants', 'Variants') }}</div>
                </q-card>
              </div>
              <div class="col-4">
                <q-card flat bordered class="q-pa-sm text-center" style="border-radius:12px;">
                  <div class="text-h6">{{ preview.products_with_stocks ?? 0 }}</div>
                  <div class="text-caption text-grey">{{ $t('WithStocks', 'With stocks') }}</div>
                </q-card>
              </div>
              <div class="col-4">
                <q-card flat bordered class="q-pa-sm text-center" style="border-radius:12px;">
                  <div class="text-h6">{{ preview.storefront_products_affected ?? 0 }}</div>
                  <div class="text-caption text-grey">{{ $t('Storefront', 'Storefront') }}</div>
                </q-card>
              </div>
            </div>

            <q-expansion-item
              v-if="preview.samples?.length"
              class="rounded-borders q-mb-md"
              :class="$q.dark.isActive ? 'bg-dark' : 'bg-white'"
              icon="preview"
              :label="$t('PreviewAffectedProducts', 'Preview affected products')"
            >
              <q-list separator>
                <q-item v-for="sample in preview.samples" :key="sample.id">
                  <q-item-section>
                    <q-item-label>{{ sample.name }}</q-item-label>
                    <q-item-label caption>#{{ sample.id }} · {{ taxTypeName(sample.current_tax_type) }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    {{
                      $t(
                        'VariantCount',
                        { count: sample.variant_count },
                        `${sample.variant_count} variant(s)`
                      )
                    }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>

            <div class="text-caption text-grey q-mb-md">
              {{ previewValidityText }}
            </div>

            <q-banner v-if="applyError" rounded dense class="bg-red text-white q-mb-md">
              {{ applyError }}
            </q-banner>

            <q-btn
              class="full-width"
              color="brandblue"
              no-caps
              :disable="!canApplyChanges"
              :loading="applying"
              :label="$t('ApplyTaxTypes', 'Apply')"
              @click="applyChanges"
            />
            <q-btn
              class="full-width q-mt-sm"
              flat
              no-caps
              color="grey-8"
              :disable="applying"
              :label="$t('RefreshPreview', 'Refresh preview')"
              @click="runPreview()"
            />
          </template>
        </q-step>
      </q-stepper>
    </template>
  </q-page>
</template>

<script>
import { backend } from 'src/marketplace/backend'
import { Product, TaxType } from 'src/marketplace/objects'
import { errorParser } from 'src/marketplace/utils'
import { useTaxTypeHelpers } from 'src/composables/marketplace/taxTypesForm'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar, debounce } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import ProductSearchDialog from 'src/components/marketplace/ProductSearchDialog.vue'

/**
 * Bulk apply tax types — two-step wizard over a single shop's products.
 *
 * Step 1 configures the target tax type, selection and overwrite toggle.
 * Step 2 shows a read-only dry-run (`bulk_preview`) and applies it
 * (`bulk_apply`) using the returned `preview_token`.
 *
 * Selection is resolved server-side over the whole matched set; only the
 * filter/ids are sent, never a page of products. See
 * `connecta2/docs/tax-bulk-apply-ui.md`.
 */

/** ProductFilter keys inherited from the launcher (products list query) that
 * are only passed through — they are not editable here.
 */
const PASSTHROUGH_FILTER_KEYS = [
  'tax_type_ids',
  'exclude_ids',
  'has_cart_options',
  'collection_id',
  'storefront_id',
  'availability',
  'ordering',
]

export default defineComponent({
  name: 'TaxBulkApplyPage',
  components: {
    MarketplaceHeader,
  },
  setup() {
    const $q = useQuasar()
    const { t: $t } = useI18n()
    const $route = useRoute()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    const { getTaxCodeLabel } = useTaxTypeHelpers()

    const canApply = computed(() => {
      return Boolean(marketplaceStore.userPermissions.admin || marketplaceStore.userPermissions.inventory)
    })

    const mobile = computed(() => $q.screen.lt.sm)

    const step = ref(1)

    // Selection seeded from the query so every launcher is a one-liner.
    const initialProductIds = parseProductIds($route.query.product_ids || $route.query.ids)

    /** Hand-picked products (ids mode); Product objects or `{ id }` stubs. */
    const selectedProducts = ref(initialProductIds.map(id => ({ id })))
    const productIds = computed(() => {
      return selectedProducts.value.map(product => product?.id).filter(Boolean)
    })

    /** `ids` = hand-picked products, `filter` = everything matching the filters. */
    const selectionMode = ref(initialProductIds.length ? 'ids' : 'filter')

    /** The editable subset of ProductFilter shown in the Advanced panel. */
    const filterValues = ref({
      s: queryString($route.query.s),
      categories: parseCategoryNames($route.query.categories),
      has_tax_type: queryString($route.query.has_tax_type),
    })

    /** Shop categories offered in the categories picker. */
    const categoryOptions = ref([])
    const filteredCategoryOptions = ref([])
    const fetchingCategories = ref(false)

    /** Filters inherited from the launcher; passed through but not edited. */
    const inheritedFilters = computed(() => {
      const result = {}
      PASSTHROUGH_FILTER_KEYS.forEach(key => {
        const value = queryString($route.query[key])
        if (value) result[key] = value
      })
      return result
    })

    function buildFilters() {
      const result = { ...inheritedFilters.value }
      const values = filterValues.value
      if (values.s) result.s = values.s
      if (values.has_tax_type) result.has_tax_type = values.has_tax_type
      if (values.categories?.length) result.categories = values.categories.join('|')
      return result
    }

    function fetchCategories() {
      const shopId = marketplaceStore.activeShopId
      if (!shopId) return Promise.resolve(null)
      fetchingCategories.value = true
      return backend.get('product-categories/', {
        params: { shop_id: shopId, limit: 100 },
      })
        .then(response => {
          const results = Array.isArray(response?.data?.results) ? response.data.results : []
          categoryOptions.value = results.map(category => category?.name).filter(Boolean)
          filteredCategoryOptions.value = [...categoryOptions.value]
          return response
        })
        .catch(() => {
          categoryOptions.value = []
          filteredCategoryOptions.value = []
          return null
        })
        .finally(() => {
          fetchingCategories.value = false
        })
    }

    function filterCategories(value, update) {
      const needle = String(value || '').toLowerCase()
      update(() => {
        filteredCategoryOptions.value = needle
          ? categoryOptions.value.filter(name => name.toLowerCase().includes(needle))
          : [...categoryOptions.value]
      })
    }

    const taxTypePresenceOptions = computed(() => [
      { value: 'false', label: $t('ProductsWithoutTaxType', 'Products without a tax type') },
      { value: 'true', label: $t('ProductsWithTaxType', 'Products with a tax type') },
    ])

    const taxTypes = ref([].map(TaxType.parse))
    const fetchingTaxTypes = ref(false)
    const taxTypeOptions = computed(() => {
      return taxTypes.value.map(taxType => ({
        ...taxType,
        label: taxTypeLabel(taxType),
      }))
    })

    const targetTaxTypeId = ref(parsePositiveInt($route.query.tax_type_id))
    const overwrite = ref(String($route.query.overwrite) === 'true')

    const preview = ref(null)
    const previewRequestBody = ref(null)
    const previewing = ref(false)
    const previewError = ref('')

    const applying = ref(false)
    const applyError = ref('')

    function taxTypeLabel(taxType) {
      if (!taxType) return $t('NoTaxType', 'No tax type')
      const rate = Number.isFinite(taxType.value) ? ` (${Number(taxType.value.toFixed(2))}%)` : ''
      return `${taxType.name || getTaxCodeLabel(taxType.code)}${rate}`
    }
    function taxTypeName(taxType) {
      if (!taxType) return $t('NoTaxType', 'No tax type')
      return taxType.name || getTaxCodeLabel(taxType.code)
    }

    const scopeLabel = computed(() => {
      if (selectionMode.value === 'ids') {
        return $t(
          'BulkApplySelectedScope',
          { count: productIds.value.length },
          `${productIds.value.length} selected product(s)`,
        )
      }
      const count = preview.value?.matched_count
      if (count === undefined || count === null) {
        return $t('BulkApplyFilterScope', 'All products matching the current filters')
      }
      return $t(
        'BulkApplyFilterScopeCount',
        { count },
        `All products matching the current filters (${count})`,
      )
    })

    const scopeOptions = computed(() => {
      const idsCount = productIds.value.length
      const matched = preview.value?.matched_count
      const filterCountKnown = selectionMode.value === 'filter'
        && matched !== undefined && matched !== null

      return [
        {
          value: 'filter',
          label: filterCountKnown
            ? $t('BulkApplyAllMatchingCount', { count: matched }, `All matching (${matched})`)
            : $t('BulkApplyAllMatching', 'All matching'),
        },
        {
          value: 'ids',
          label: idsCount
            ? $t('BulkApplySelectedCount', { count: idsCount }, `Selected (${idsCount})`)
            : $t('BulkApplySelectedShort', 'Selected'),
          disable: !idsCount,
        },
      ]
    })

    const canPreview = computed(() => {
      if (selectionMode.value === 'ids' && !productIds.value.length) return false
      // A null target only makes sense when clearing (requires overwrite).
      if (!targetTaxTypeId.value && !overwrite.value) return false
      return true
    })

    const previewExpired = computed(() => {
      const expiresAt = preview.value?.expires_at
      if (!expiresAt) return false
      return new Date(expiresAt).getTime() < Date.now()
    })
    const previewValidityText = computed(() => {
      if (!preview.value?.expires_at) return ''
      if (previewExpired.value) {
        return $t('BulkApplyPreviewExpired', 'This preview has expired. Refresh it before applying.')
      }
      return $t(
        'BulkApplyPreviewValidUntil',
        { date: formatDateTime(preview.value.expires_at) },
        `Preview valid until ${formatDateTime(preview.value.expires_at)}`,
      )
    })
    const canApplyChanges = computed(() => {
      return Boolean(
        preview.value
        && Number(preview.value.will_change_count) > 0
        && !previewExpired.value
        && !applying.value,
      )
    })

    /**
     * Warnings derived from the preview's structured fields (the server's
     * `warnings` strings are intentionally not shown).
     */
    const derivedWarnings = computed(() => {
      const data = preview.value
      if (!data) return []

      const messages = []
      const matched = Number(data.matched_count) || 0
      const changing = Number(data.will_change_count) || 0
      const kept = Number(data.kept_existing_count) || 0

      if (matched === 0) {
        messages.push($t('BulkApplyNoMatches', 'No products match this selection.'))
      } else if (changing === 0) {
        messages.push($t('BulkApplyNothingToChange', 'No products need to change for this selection.'))
      }

      if (kept > 0 && !data.overwrite) {
        messages.push($t(
          'BulkApplyKeptHint',
          { count: kept },
          `${kept} product(s) kept a different tax type. Turn on Overwrite to replace them.`,
        ))
      }

      return messages
    })

    function buildRequestBody() {
      const selection = selectionMode.value === 'ids'
        ? { mode: 'ids', product_ids: [...productIds.value] }
        : { mode: 'filter', filters: buildFilters() }
      return {
        shop_id: Number(marketplaceStore.shopData?.id || marketplaceStore.activeShopId),
        tax_type_id: targetTaxTypeId.value ?? null,
        selection,
        overwrite: overwrite.value,
      }
    }

    // Guards against out-of-order preview responses overwriting newer ones.
    let previewRequestId = 0
    function runPreview(opts = {}) {
      if (!canPreview.value) return Promise.resolve(null)
      const requestId = ++previewRequestId
      previewing.value = true
      previewError.value = ''
      const body = buildRequestBody()

      return backend.post('tax-types/bulk_preview/', body)
        .then(response => {
          if (requestId !== previewRequestId) return response
          preview.value = response?.data || null
          previewRequestBody.value = body
          if (opts.advance) step.value = 2
          return response
        })
        .catch(error => {
          if (requestId !== previewRequestId) return null
          preview.value = null
          previewRequestBody.value = null
          previewError.value = resolveError(error)
          return null
        })
        .finally(() => {
          if (requestId === previewRequestId) previewing.value = false
        })
    }

    function invalidatePreview() {
      preview.value = null
      previewRequestBody.value = null
      previewError.value = ''
    }

    /**
     * Lean on the preview being cheap to re-run: whenever the target,
     * selection or overwrite changes, drop the stale preview and fetch a
     * fresh one (debounced) so counts stay live.
     */
    const debouncedPreview = debounce(() => {
      if (canPreview.value) runPreview()
    }, 600)

    watch(
      () => [
        targetTaxTypeId.value,
        overwrite.value,
        selectionMode.value,
        filterValues.value.s,
        filterValues.value.categories.join('|'),
        filterValues.value.has_tax_type,
        productIds.value.join(','),
      ],
      () => {
        invalidatePreview()
        debouncedPreview()
      },
    )

    function reviewChanges() {
      // A fresh preview in hand means nothing changed since it was generated.
      if (preview.value && previewRequestBody.value) {
        step.value = 2
        return Promise.resolve(null)
      }
      debouncedPreview.cancel?.()
      return runPreview({ advance: true })
    }

    function openProductPicker() {
      const scope = {}
      if (filterValues.value.has_tax_type === 'false') scope.has_tax_type = false
      else if (filterValues.value.has_tax_type === 'true') scope.has_tax_type = true
      if (filterValues.value.categories?.length) scope.categories = filterValues.value.categories.join('|')

      $q.dialog({
        component: ProductSearchDialog,
        componentProps: {
          selected: selectedProducts.value.slice(),
          searchFilterKwargs: scope,
          ok: { label: $t('Done'), color: 'brandblue' },
          cancel: true,
        },
      }).onOk(products => {
        selectedProducts.value = Array.isArray(products) ? products.slice() : []
        selectionMode.value = 'ids'
      })
    }

    function removeSelectedProduct(product) {
      selectedProducts.value = selectedProducts.value.filter(item => item?.id !== product?.id)
    }

    function clearSelectedProducts() {
      selectedProducts.value = []
      if (selectionMode.value === 'ids') selectionMode.value = 'filter'
    }

    function fetchSelectedProductsByIds(ids) {
      if (!ids?.length) return Promise.resolve(null)
      return backend.get('products/info/', {
        params: {
          ids: ids.join(','),
          shop_id: marketplaceStore.activeShopId || null,
          limit: ids.length,
        },
      })
        .then(response => {
          const results = Array.isArray(response?.data?.results) ? response.data.results : []
          const products = results.map(Product.parse)
          const foundIds = new Set(products.map(product => product.id))
          const missing = ids.filter(id => !foundIds.has(id)).map(id => ({ id }))
          selectedProducts.value = [...products, ...missing]
          return response
        })
        .catch(() => {
          selectedProducts.value = ids.map(id => ({ id }))
          return null
        })
    }

    function applyChanges() {
      if (!canApplyChanges.value) return Promise.resolve()
      applying.value = true
      applyError.value = ''

      const body = { ...previewRequestBody.value, preview_token: preview.value.preview_token }
      const config = {}
      const idempotencyKey = makeIdempotencyKey()
      if (idempotencyKey) config.headers = { 'X-Idempotency-Key': idempotencyKey }

      return backend.post('tax-types/bulk_apply/', body, config)
        .then(response => {
          const data = response?.data || {}
          $q.notify({
            type: 'positive',
            message: $t(
              'BulkApplyDone',
              { applied: data.applied_count, skipped: data.skipped_count },
              `Updated ${data.applied_count} product(s) (${data.skipped_count} unchanged)`,
            ),
          })
          goBack()
          return response
        })
        .catch(error => {
          if (error?.response?.status === 409) {
            preview.value = null
            previewRequestBody.value = null
            return runPreview({ advance: true }).then(() => {
              if (!preview.value) return
              $q.notify({
                type: 'warning',
                message: $t(
                  'BulkApplyDrifted',
                  'The product selection changed since the preview. Review the updated preview.',
                ),
              })
            })
          }
          applyError.value = resolveError(error)
          return null
        })
        .finally(() => {
          applying.value = false
        })
    }

    function resolveError(error) {
      const data = error?.response?.data
      const message = errorParser.firstElementOrValue(data?.non_field_errors)
        || errorParser.firstElementOrValue(data?.selection?.product_ids)
        || errorParser.firstElementOrValue(data?.selection?.filters)
        || errorParser.firstElementOrValue(data?.tax_type_id)
        || errorParser.firstElementOrValue(data?.preview_token)
        || data?.detail
        || (Array.isArray(data) ? data[0] : null)
        || $t('BulkApplyError', 'Something went wrong. Please try again.')
      return message
    }

    function fetchTaxTypes() {
      const shopId = marketplaceStore.activeShopId
      if (!shopId) return Promise.resolve()
      fetchingTaxTypes.value = true
      return backend.get('tax-types/', {
        params: { available_for_shop_id: shopId, limit: 100 },
      })
        .then(response => {
          const results = Array.isArray(response?.data) ? response.data : response?.data?.results
          taxTypes.value = Array.isArray(results) ? results.map(TaxType.parse) : []
          return response
        })
        .finally(() => {
          fetchingTaxTypes.value = false
        })
    }

    function goBack() {
      if (window.history.state?.back) $router.back()
      else $router.push({ name: 'marketplace-taxes' })
    }

    onMounted(async () => {
      await marketplaceStore.appRefreshScopePromise?.catch?.(() => {})
      if (!marketplaceStore.shop?.id) await marketplaceStore.refetchShop().catch(() => {})
      fetchTaxTypes()
      fetchCategories()
      if (initialProductIds.length) fetchSelectedProductsByIds(initialProductIds)
    })

    onBeforeUnmount(() => {
      debouncedPreview.cancel?.()
    })

    return {
      marketplaceStore,

      step,
      mobile,

      canApply,
      filterValues,
      inheritedFilters,
      selectionMode,
      selectedProducts,
      productIds,
      scopeLabel,
      scopeOptions,
      taxTypePresenceOptions,
      filteredCategoryOptions,
      fetchingCategories,
      filterCategories,

      taxTypeOptions,
      fetchingTaxTypes,
      targetTaxTypeId,
      overwrite,

      preview,
      previewing,
      previewError,
      previewExpired,
      previewValidityText,
      canPreview,
      canApplyChanges,
      derivedWarnings,

      applying,
      applyError,

      taxTypeName,
      runPreview,
      reviewChanges,
      openProductPicker,
      removeSelectedProduct,
      clearSelectedProducts,
      applyChanges,
      goBack,
    }
  },
})

/** @returns {Number[]} */
function parseProductIds(value) {
  if (Array.isArray(value)) return value.map(parsePositiveInt).filter(Boolean)
  if (value === undefined || value === null || value === '') return []
  return String(value)
    .split(',')
    .map(parsePositiveInt)
    .filter(Boolean)
}

function parsePositiveInt(value) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : null
}

/** Coerce a router query value (string | string[] | undefined) to a string. */
function queryString(value) {
  if (Array.isArray(value)) return value[0] !== undefined ? String(value[0]) : ''
  if (value === undefined || value === null) return ''
  return String(value)
}

/** Parse a `categories` query value into the array used by the picker. */
function parseCategoryNames(value) {
  const raw = Array.isArray(value) ? value.join('|') : queryString(value)
  return raw.split('|').map(name => name.trim()).filter(Boolean)
}

function makeIdempotencyKey() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch (error) {
    // ignore
  }
  return undefined
}

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}
</script>

<style scoped>
/* Trim the stepper's generous desktop padding on small screens. */
@media (max-width: 599px) {
  :deep(.q-stepper__step-inner) {
    padding: 8px;
  }

  :deep(.q-stepper__nav) {
    padding-top: 8px;
  }

  :deep(.q-stepper__header .q-stepper__tab) {
    padding-top: 12px;
    padding-bottom: 12px;
  }
}
</style>
