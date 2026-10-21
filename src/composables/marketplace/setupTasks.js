import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { backend } from 'src/marketplace/backend'
import { resolveSetupTasks } from 'src/marketplace/setup-tasks'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useSetupTasksStore } from 'src/stores/setupTasks'

/**
 * Fetches the counts the setup tasks depend on.
 *
 * Kept separate from `useSetupTasks` so the task definitions stay declarative
 * and the host owns when the (network) work happens — call `fetchCounts()` on
 * mount and pull-to-refresh.
 */
export function useSetupTaskCounts() {
  const marketplaceStore = useMarketplaceStore()
  const counts = reactive({
    productsCount: undefined,
    productsWithoutTaxTypeCount: undefined,
    loaded: false,
    loading: false,
  })

  async function fetchCounts() {
    const shopId = marketplaceStore.activeShopId
    if (!shopId) {
      counts.loaded = true
      return
    }

    counts.loading = true
    try {
      const params = { shop_id: shopId, limit: 1, offset: 0 }
      const [allProducts, withoutTaxType] = await Promise.all([
        backend.get('products/', { params }),
        backend.get('products/', { params: { ...params, has_tax_type: false } }),
      ])
      counts.productsCount = allProducts?.data?.count
      counts.productsWithoutTaxTypeCount = withoutTaxType?.data?.count
    } catch (error) {
      // Leave counts undefined; tasks that need them stay hidden.
    } finally {
      counts.loaded = true
      counts.loading = false
    }
  }

  return { counts, fetchCounts }
}

/**
 * Builds and resolves the marketplace "next steps" tasks.
 *
 * @param {Object} [opts]
 * @param {import('vue').ReactiveEffect<Object>} [opts.counts] reactive counts from `useSetupTaskCounts`
 * @param {String[]} [opts.only] restrict to specific task slugs (e.g. taxes page)
 */
export function useSetupTasks(opts = {}) {
  const { t: $t } = useI18n()
  const $router = useRouter()
  const marketplaceStore = useMarketplaceStore()
  const setupTasksStore = useSetupTasksStore()
  const counts = opts.counts || {}

  const activeShopId = computed(() => {
    return marketplaceStore.shop?.id || marketplaceStore.activeShopId || 0
  })
  const currentRoles = computed(() => {
    return Object.entries(marketplaceStore.userPermissions || {})
      .filter(([, allowed]) => allowed)
      .map(([role]) => role)
  })

  const taskDefs = computed(() => {
    const shopId = activeShopId.value
    const hasAppliedRegime = Boolean(marketplaceStore.shopSettings?.appliedTaxRegime?.id)
    const hasDefaultTaxType = Boolean(marketplaceStore.shopSettings?.defaultTaxType?.id)
    const productsCount = Number(counts.productsCount)
    const hasProductsCount = Number.isFinite(productsCount)
  
    const productsWithoutTaxTypeCount = Number(counts.productsWithoutTaxTypeCount)
    const hasProductsWithNoTaxType = Number.isFinite(productsWithoutTaxTypeCount) && productsWithoutTaxTypeCount > 0

    const defs = [
      {
        slug: 'add-product',
        icon: 'local_mall',
        title: $t('SetupTaskAddProduct', 'Add a product'),
        hint: $t('SetupTaskAddProductHint', 'Add at least one product so you can start selling.'),
        actionLabel: $t('AddProduct', 'Add product'),
        action: { name: 'marketplace-add-product' },
        roles: ['admin', 'inventory'],
        order: 10,
        available: hasProductsCount,
        done: hasProductsCount && productsCount > 0,
        dependsOn: [],
      },
      {
        slug: 'setup-taxes',
        icon: 'receipt_long',
        title: $t('SetUpTaxes', 'Set up taxes'),
        hint: $t('NoDefaultTaxTypeHint', 'New products will use a default tax type when set.'),
        actionLabel: $t('SetUpTaxes', 'Set up taxes'),
        action: { name: 'marketplace-tax-regime-setup' },
        roles: ['admin'],
        order: 20,
        done: hasAppliedRegime || hasDefaultTaxType,
        dependsOn: [],
      },

      {
        slug: 'bulk-apply-tax-type',
        icon: 'sell',
        title: $t('SetupTaskBulkApplyTaxType', 'Set tax types on your products'),
        hint: $t('SetupTaskBulkApplyTaxTypeHint', "Assign a tax type to the products that don't have one yet."),
        actionLabel: $t('SetupTaskBulkApplyTaxTypeAction', 'Set tax types'),
        action: { name: 'marketplace-tax-bulk-apply' },
        roles: ['admin', 'inventory'],
        order: 30,
        available: hasProductsWithNoTaxType,
        done: Number.isFinite(productsWithoutTaxTypeCount) && productsWithoutTaxTypeCount === 0,
        dependsOn: [{ slug: 'add-product', type: 'strict'}, { slug: 'setup-taxes', type: 'strict' } ],
      },
      {
        slug: 'setup-storefront',
        icon: 'storefront',
        title: $t('SetupTaskSetupStorefront', 'Set up your storefront'),
        hint: $t('SetupTaskSetupStorefrontHint', 'Open your online storefront to start receiving orders.'),
        actionLabel: $t('SetUp', 'Set up'),
        action: { name: 'marketplace-storefront-setup' },
        roles: ['admin', 'storefront'],
        order: 40,
        done: Boolean(marketplaceStore.storefrontData?.id),
        dependsOn: [],
      }, 
      {
        slug: 'branch-location',
        icon: 'location_on',
        title: $t('SetupTaskBranchLocation', 'Add your branch location'),
        hint: $t(
          'SetupTaskBranchLocationHint',
          "The shop's coordinates is not set. Contact the owner to set a pin location in Paytaca app's merchant admin.",
        ),
        roles: ['admin'],
        order: 50,
        done: Boolean(marketplaceStore.shop?.location?.validCoordinates),
        dependsOn: [{ slug: 'setup-storefront', type: 'optional' }],
      },
    ]

    return defs
      .filter(def => def.available !== false)
      .map(def => ({ ...def, key: `${shopId}:${def.slug}` }))
  })

  const tasks = computed(() => {
    // Covers both session ("not now") and permanent ("do not show again")
    // dismissals.
    const dismissedSlugs = taskDefs.value
      .filter(def => setupTasksStore.isDismissed(def.key))
      .map(def => def.slug)

    return resolveSetupTasks(taskDefs.value, {
      roles: currentRoles.value,
      dismissedSlugs,
      only: opts.only,
    }).map(task => ({
      ...task,
      lockedHint: task.locked
        ? $t(
          'SetupTaskLockedHint',
          { tasks: task.blockedBy.map(dep => dep.title).filter(Boolean).join(', ') },
          'Finish the earlier steps first',
        )
        : '',
    }))
  })

  const index = ref(0)
  watch(tasks, () => {
    if (index.value >= tasks.value.length) index.value = 0
  })

  /**
   * Dismisses a task.
   *
   * @param {Object} task resolved setup task
   * @param {Object} [opts]
   * @param {Boolean} [opts.permanent] "do not show again" instead of the
   *   session-only dismissal
   */
  function dismiss(task, opts = {}) {
    if (!task?.key) return
    if (opts.permanent) setupTasksStore.dismissPermanent(task.key)
    else setupTasksStore.dismiss(task.key)
  }
  function goTo(task) {
    if (task?.action) $router.push(task.action)
  }

  return { tasks, index, dismiss, goTo }
}
