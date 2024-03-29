<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Products</div>
            <div class="text-grey">Storefront</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md no-wrap">
          <q-input
            dense
            v-model="filterOpts.search"
            placeholder="Product name"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn flat padding="sm" icon="tune">
            <q-menu
              v-model="openFilterOptsForm"
              class="q-pa-md"
              @hide="() => syncTempFilterOptsToFilterOpts()"
            >
              <q-btn
                flat
                no-caps label="Reset"
                color="brandblue"
                padding="xs md"
                class="text-underline q-r-mt-md q-r-mr-lg float-right"
                v-close-popup
                @click="filterOpts = createDefaultFilterOpts(), tempFilterOpts = createDefaultFilterOpts()"
              />
              <div class="q-mb-sm">
                <div class="text-subtitle1">Categories</div>
                <div style="min-width:min(50vw, 300px);">
                  <q-select
                    outlined
                    dense
                    multiple
                    use-input
                    use-chips
                    :options="categoriesFilter?.opts"
                    v-model="tempFilterOpts.categories"
                    class="q-r-mx-xs"
                  />
                </div>
              </div>
              <div class="q-mb-sm">
                <div class="text-subtitle1">Availability</div>
                <q-btn-toggle
                  v-model="tempFilterOpts.availability"
                  no-caps
                  no-wrap
                  toggle-color="primary"
                  padding="xs md"
                  :options="[
                    {label: 'Available', value: true },
                    {label: 'Unvailable', value: false },
                    {label: 'All', value: undefined}
                  ]"
                />
              </div>
            </q-menu>
          </q-btn>
          <q-separator vertical class="q-ml-xs q-mr-sm"/>
          <q-btn 
            rounded
            icon="add"
            padding="sm"
            color="brandblue"
            @click="() => openAddProductsDialog()"
          />
        </div>
        <div class="row items-center q-gutter-xs">
          <div class="row items-center"> 
            <div
              v-if="typeof filterOpts?.availability === 'boolean'"
              class="ellipsis filter-opt q-px-xs"
              @click="openFilterOptsForm = true"
            >
              {{ availability ? 'Available' : 'Unavailable' }}
            </div>
          </div>
          <div
            v-if="filterOpts?.categories?.length > 0"
            class="ellipsis filter-opt q-px-xs"
            style="max-width:max(500px,75vw);"
            @click="openFilterOptsForm = true"
          >
            {{ filterOpts?.categories?.length === 1 ? 'Category' : 'Categories' }}
            :
            {{ filterOpts?.categories?.join(', ') }}
          </div>
        </div>
      </div>

      <q-slide-transition>
        <div v-if="productsTableState.selected?.length" class="q-mb-sm row items-center q-gutter-sm">
          <q-btn
            rounded
            :outline="$q.dark.isActive"
            padding="2px 0.75em"
            no-caps
            label="Remove"
            @click="() => confirmRemoveSelectedProducts()"
          />
          <q-btn
            rounded
            :outline="$q.dark.isActive"
            padding="2px 0.75em"
            no-caps
            label="Mark available"
            @click="() => updateSelectedProductsAvailability(true)"
          />

          <q-btn
            rounded
            :outline="$q.dark.isActive"
            padding="2px 0.75em"
            no-caps
            label="Mark unavailable"
            @click="() => updateSelectedProductsAvailability(false)"
          />
        </div>
      </q-slide-transition>

      <q-table
        ref="table"
        :loading="fetchingProducts"
        :columns="productsTableColumns"
        :rows="products"
        :pagination="{ rowsPerPage: 0 }"
        selection="multiple"
        row-key="id"
        v-model:selected="productsTableState.selected"
        hide-pagination
        binary-state-sort
        :sort-method="sortMethod"
      >
        <template v-slot:bottom>
          <div class="row items-center full-width">
            <q-space/>
            <LimitOffsetPagination
              :pagination-props="{
                maxPages: 5,
                rounded: true,
                padding: 'sm md',
                flat: true,
                boundaryNumbers: true
              }"
              :hide-below-pages="2"
              :modelValue="productsPagination"
              @update:modelValue="fetchProducts"
            />
          </div>
        </template>

        <template v-slot:body-cell-product="props">
          <q-td :props="props">
            <div class="row items-center no-wrap" @click="() => viewProductDetail(props.row)">
              <img
                v-if="props.row.displayImageUrl"
                :src="props.row.displayImageUrl"
                class="rounded-borders q-mr-sm"
                style="width:35px"
              />
              <div class="text-weight-medium">
                <div>
                  {{ props.row.name }}
                  <template v-if="props.row.hasVariants">
                    ({{ props.row.variants.length || props.row.variantsCount }} variants)
                  </template>
                </div>
                <div class="text-caption bottom text-grey">#{{ props.row.id }}</div>
              </div>
              <q-spinner v-if="props.row?.$state?.updating" size="1.5em" class="q-ml-sm"/>
            </div>
          </q-td>
        </template>
        <template v-slot:body-cell-reviews="props">
          <q-td :props="props" @click="() => toggleProductSelection(props.row)">
            <div
              style="position:relative;" v-ripple
              @click.stop="() => openProductReviewsDialog(props?.row)"
            >
              <q-rating
                v-if="Number.isFinite(props?.row?.reviewSummary?.averageRating)"
                readonly
                max="5"
                icon-half="star_half"
                :model-value="props?.row?.reviewSummary?.averageRating * (5 / 100)"
                color="brandblue"
                class="no-wrap"
              />
              <div class="text-caption bottom">
                {{ props?.row?.reviewSummary?.count }}
                {{ props?.row?.reviewSummary?.count === 1 ? 'review' : 'reviews' }}
              </div>
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-available="props">
          <q-td :props="props" @click="() => toggleProductSelection(props.row)">
            {{ props?.row?.availableAtStorefrontText?.(marketplaceStore.storefrontData.id) }}
          </q-td>
        </template>
        <template v-slot:body-cell-cart-options="props">
          <q-td :props="props">
            <q-btn
              :disable="props.row?.$state?.updatingCartOptions"
              :loading="props.row?.$state?.updatingCartOptions"
              flat
              no-caps
              :label="props.row?.hasCartOptions ? 'Edit' : 'Add'"
              :icon-right="props.row?.hasCartOptions ? 'edit' : 'add'"
              no-wrap
              padding="xs sm"
              dense
              @click="() => updateCartOptions(props.row)"
            />
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>
    <ProductInventoryDialog
      v-model="productDetailDialog.show"
      :productObj="productDetailDialog.product"
    />
    <ReviewsListDialog
      v-model="reviewsListDialog.show"
      :productId="reviewsListDialog?.product?.id"
    />
  </q-page>
</template>
<script>
import { Product } from 'src/marketplace/objects';
import { backend } from 'src/marketplace/backend';
import { errorParser, formatTimestampToText } from 'src/marketplace/utils';
import { useMarketplaceStore } from 'src/stores/marketplace';
import { useQuasar } from 'quasar';
import { defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue';
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue';
import ProductInventoryDialog from 'src/components/marketplace/inventory/ProductInventoryDialog.vue';
import ProductSearchDialog from 'src/components/marketplace/ProductSearchDialog.vue';
import JSONFormDialog from 'src/components/marketplace/jsonform/JSONFormDialog.vue';
import ReviewsListDialog from 'src/components/marketplace/reviews/ReviewsListDialog.vue';

export default defineComponent({
  name: 'StorefrontProducts',
  components: {
    ProductInventoryDialog,
    LimitOffsetPagination,
    MarketplaceHeader,
    ReviewsListDialog,
  },
  setup() {
    const $q = useQuasar()
    window.$q = $q
    const marketplaceStore = useMarketplaceStore()

    const categoriesFilter = ref({
      showFormDialog: false,
      opts: [],
    })
    onMounted(() => updateProductCategories())
    function updateProductCategories() {
      const params = {
        shop_id: marketplaceStore.activeShopId,
      }
      return backend.get(`product-categories/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          categoriesFilter.value.opts = response?.data?.results.map(category => category?.name).filter(Boolean)
          return response
        })
    }

    const openFilterOptsForm = ref()
    function createDefaultFilterOpts() {
      return {
        sort: undefined,
        search: '',
        categories: [],
        availability: undefined,
      }
    }
    const filterOpts = ref(createDefaultFilterOpts())
    watch(filterOpts, () => fetchProducts(), { deep: true })
    const tempFilterOpts = ref(createDefaultFilterOpts())
    function syncTempFilterOptsToFilterOpts() {
      filterOpts.value.search = tempFilterOpts.value.search
      filterOpts.value.availability = tempFilterOpts.value.availability
      
      const tempCategories = tempFilterOpts.value.categories
      const categories = filterOpts.value.categories
      const hasAddedCategories = tempCategories.some(category => !categories.includes(category))
      const hasRemovedCategories = categories.some(category => !tempCategories.includes(category))
      if (!hasAddedCategories && !hasRemovedCategories) return
      filterOpts.value.categories = [...tempFilterOpts.value.categories]
    }

    const products = ref([].map(Product.parse))
    const fetchingProducts = ref(false)
    const productsPagination = ref({ count: 0, limit: 0, offset: 0 })
    onMounted(() => fetchProducts())
    function fetchProducts(opts={limit: 0, offset: 0}) {
      const params = {
        storefront_id: Number(marketplaceStore.storefrontData.id),
        s: filterOpts?.value?.search || undefined,
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
        ordering: filterOpts.value.sort || undefined,
        categories: filterOpts.value.categories.join('|') || undefined,
        availability: filterOpts.value.availability,
      }
      fetchingProducts.value = true
      return backend.get(`products/info/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          products.value = response?.data?.results.map(Product.parse)
          productsPagination.value.limit = response?.data?.limit
          productsPagination.value.offset = response?.data?.offset
          productsPagination.value.count = response?.data?.count
          return response
        })
        .finally(() => {
          fetchingProducts.value = false
        })
    }

    const table = ref()
    const productsTableColumns = [
      { name: 'product', align: 'left', label: 'Product', field: 'name', sortable: true },
      // { name: 'total-quantity', align: 'center', label: 'Stock', field: 'totalStocks' },
      { name: 'reviews', align: 'left', label: 'Reviews' },
      { name: 'available', align: 'left', label: 'Available', sortable: true },
      { name: 'markup-price', align: 'left', label: 'Markup Price', field: 'markupPriceRangeText', format: val => `${val} ${marketplaceStore?.currency}`, sortable: true },
      { name: 'cart-options', align: 'left', label: 'Cart Options' },
      { name: 'created', align: 'center', label: 'Created', field: 'createdAt', format: formatTimestampToText, sortable: true },
      // { name: 'actions', align: 'center', label: '' },
    ]
    const sortFieldNameMap = {
      product: 'name',
      'markup-price': 'markup_price',
      created: 'created_at',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

    const productsTableState = ref({
      selected: [].map(Product.parse),
    })
    function toggleProductSelection(product = Product.parse()) {
      if (!product?.id) return
      
      if (productsTableState.value.selected.includes(product)) {
        productsTableState.value.selected = productsTableState.value.selected
          .filter(_product => _product !== product)
      } else {
        productsTableState.value.selected.push(product)
      }
    }

    watch(products, () => {
      productsTableState.value.selected = productsTableState.value.selected
        .filter(product => {
          return products.value.some(_product => _product.id === product.id)
        })
    }, { deep: true })

    function confirmRemoveSelectedProducts() {
      const count = productsTableState.value.selected.length
      $q.dialog({
        title: `Remove ${count} ${count === 1 ? 'product' : 'products'} from storefront`,
        message: 'Removing selected products from storefront, are you sure?',
      }).onOk(() => removeSelectedProducts())
    }

    function removeSelectedProducts() {
      const data = {
        action: 'remove',
        product_ids: productsTableState.value.selected.map(product => product?.id),
      }

      const dialog = $q.dialog({
        title: 'Removing products from strefront',
        ok: false, 
        persistent: true,
        progress: true,
      })

      return backend.post(`connecta/storefronts/${marketplaceStore.storefrontData.id}/product_subscription/`, data)
        .then(() => {
          fetchProducts()
          dialog.hide()
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMsg = errorParser.firstElementOrValue(data?.non_field_errors) ||
                        data?.detail || 'Encountered unknown error'
          dialog.update({ title: 'Unable to remove products', message: errorMsg })
        })
        .finally(() => {
          dialog.update({ ok: { color: 'brandblue' }, progress: false, persistent: false })
        })
    }

    /**
     * @param {Bool} available 
     */
    function updateSelectedProductsAvailability(available) {
      if (typeof available !== 'boolean') return

      const promises = productsTableState.value.selected.map(product => {
        const handle = `${marketplaceStore.storefrontData?.id}-${product?.id}`
        const data = { available: available }
        product.$state.updating = true
        return backend.patch(`connecta/storefront-products/${handle}/`, data)
          .then(response => {
            product.addStorefrontProductData(response?.data)
            return response
          })
          .finally(() => {
            product.$state.updating = false
          })
      })

      return Promise.all(promises)
    }

    async function updateCartOptions(product=Product.parse()) {
      if (product.cartOptions === undefined) await product.fetchCartOptions()

      $q.dialog({
        component: JSONFormDialog,
        componentProps: {
          title: [product?.name, 'Cart options'].filter(Boolean).join(' - '),
          schemaData: product.cartOptions || undefined,
        }
      }).onOk(result => {
        if (Array.isArray(result)) {
          result = result?.map?.(data => Object.assign({}, data, { _index: undefined }))
        }

        const data = { cart_options: result }
        if (!data?.cart_options?.length) data.cart_options = null

        const params = { storefront_id: Number(marketplaceStore.storefrontData.id) }
        product.$state.updatingCartOptions = true
        backend.patch(`products/${product.id}/`, data, { params })
          .then(response => {
            product.cartOptions = response?.data?.cart_options
            product.raw.cart_options = response?.data?.cart_options

            product.hasCartOptions = product.cartOptions !== null
            product.raw.has_cart_options = product.hasCartOptions
            $q.notify({
              message: 'Cart options updated',
              icon: 'check',
              color: 'brandblue',
            })
            return response
          })
          .finally(() => {
            product.$state.updatingCartOptions = false
          })
      })
    }

    function openAddProductsDialog() {
      $q.dialog({
        component: ProductSearchDialog,
        componentProps: {
          searchFilterKwargs: {
            exclude_storefront_id: marketplaceStore.storefrontData.id,
          },
          selected: [],
          ok: true, cancel: true,
        }
      }).onOk(products => {
        const data = {
          action: 'add',
          product_ids: products?.map(product => product?.id),
        }

        const dialog = $q.dialog({
          title: 'Adding products',
          progress: true,
          persistent: true,
          ok: false,
        })
        backend.post(`connecta/storefronts/${marketplaceStore.storefrontData.id}/product_subscription/`, data)
          .then(() => {
            fetchProducts()
            dialog.hide()
          })
          .catch(error => {
            const data = error?.response?.data
            let errorMsg = errorParser.firstElementOrValue(data?.non_field_errors) ||
                          data?.detail || 'Encountered unknown error'
            dialog.update({ title: 'Unable to add products', message: errorMsg })
          })
          .finally(() => {
            dialog.update({ ok: { color: 'brandblue' }, progress: false, persistent: false })
          })
      })
    }

    const reviewsListDialog = ref({ show: false, product: Product.parse() })
    function openProductReviewsDialog(product=Product.parse()) {
      reviewsListDialog.value.product = product
      reviewsListDialog.value.show = true
    }

    const productDetailDialog = ref({
      show: false,
      product: Product.parse(),
    })

    function viewProductDetail(product=Product.parse()) {
      productDetailDialog.value.product = product
      productDetailDialog.value.show = true
    }

    async function refreshPage(done){
      try {
        await Promise.all([
          fetchProducts(),
          updateProductCategories(),
        ])
      } finally {
        done()
      }
    }

    return {
      marketplaceStore,
      openFilterOptsForm,
      createDefaultFilterOpts,
      filterOpts,
      tempFilterOpts,
      syncTempFilterOptsToFilterOpts,

      categoriesFilter,
      updateProductCategories,

      products,
      fetchingProducts,
      productsPagination,
      fetchProducts,

      table,
      productsTableColumns,
      sortMethod,

      productsTableState,
      toggleProductSelection,
      confirmRemoveSelectedProducts,
      updateSelectedProductsAvailability,
      updateCartOptions,
      openAddProductsDialog,

      reviewsListDialog,
      openProductReviewsDialog,

      productDetailDialog,
      viewProductDetail,

      refreshPage,
    }
  },
})
</script>
<style lang="scss" scoped>
.filter-opt {
  border: 1px solid currentColor;
  border-radius: 4px;
}
</style>
