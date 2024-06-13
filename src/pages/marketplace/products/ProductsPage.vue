<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Products') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md no-wrap">
          <q-input
            dense
            v-model="filterOpts.search"
            :placeholder="$t('ProductName')"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn flat padding="sm" icon="tune" @click="categoriesPrompt"></q-btn>
          <q-separator vertical class="q-ml-xs q-mr-sm"/>
          <q-btn 
            rounded
            icon="add"
            padding="sm"
            color="brandblue"
          >
            <q-menu>
              <q-list separator>
                <q-item clickable :to="{ name: 'marketplace-add-product' }">
                  <q-item-section>
                    <q-item-label>{{ $t('AddProduct') }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable :to="{ name: 'marketplace-batch-add-product' }">
                  <q-item-section>
                    <q-item-label>{{ $t('AddMultipleProducts') }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="row items-center">
          <div
            v-if="filterOpts?.categories?.length > 0"
            class="ellipsis filter-opt q-px-xs"
            style="max-width:max(500px,75vw);"
            @click="categoriesPrompt"
          >
            {{ filterOpts?.categories?.length === 1 ? $t('Category') : $t('Categories') }}
            :
            {{ filterOpts?.categories?.join(', ') }}
          </div>
        </div>
      </div>
      <q-table
        ref="table"
        :loading="fetchingProducts"
        :columns="productsTableColumns"
        :rows="products"
        :pagination="{ rowsPerPage: 0 }"
        :selected="productsTableState.selected"
        :expanded="productsTableState.expanded"
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
                    {{
                      $t(
                        'VariantCount',
                        { count: props.row.variants.length || props.row.variantsCount },
                        `(${ props.row.variants.length || props.row.variantsCount } variants)`
                      )
                    }}
                  </template>
                </div>
                <div class="text-caption bottom text-grey">#{{ props.row.id }}</div>
              </div>
            </div>
          </q-td>
        </template>
        <template v-slot:body-cell-reviews="props">
          <q-td :props="props" @click="() => toggleProductSelection(props.row)">
            <div
              style="position:relative;" v-ripple
              @click.stop="() => props?.row?.reviewSummary?.count ? openProductReviewsDialog(props?.row) : undefined"
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
                {{
                  $t(
                    'ReviewCount',
                    { count: props?.row?.reviewSummary?.count },
                    `${ props?.row?.reviewSummary?.count } review(s)`
                  )
                }}
              </div>
            </div>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat icon="more_vert" padding="sm">
              <q-menu anchor="bottom right" self="top right">
                <q-list separator>
                  <q-item
                    clickable
                    :to="{name: 'marketplace-edit-product', params: { productId: props.row.id }}"
                    v-close-popup
                  >
                    <q-item-section>
                      <q-item-label>{{ $t('EditProduct') }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item
                    clickable
                    :to="{
                      name: 'marketplace-stocks',
                      query: { productId: props.row?.id }
                    }"
                    v-close-popup
                  >
                    <q-item-section>
                      <q-item-label>{{ $t('GoToInventory') }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>

    <ProductInventoryDialog
      v-model="productDetailDialog.show"
      :productObj="productDetailDialog.product"
    >
      <template v-slot:menu="{ product }">
        <q-btn flat icon="more_vert" padding="sm">
          <q-menu anchor="bottom right" self="top right">
            <q-list separator>
              <q-item
                clickable
                :to="{name: 'marketplace-edit-product', params: { productId: product.id }}"
                v-close-popup
              >
                <q-item-section>
                  <q-item-label>{{ $t('EditProduct') }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                :to="{ name: 'marketplace-stocks', query: { productId: product?.id } }"
                v-close-popup
              >
                <q-item-section>
                  <q-item-label>{{ $t('GoToInventory') }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </template>
    </ProductInventoryDialog>
    <ReviewsListDialog
      v-model="reviewsListDialog.show"
      :productId="reviewsListDialog?.product?.id"
    />
  </q-page>
</template>
<script>
import { formatTimestampToText } from 'src/marketplace/utils'
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { defineComponent, onMounted, ref, watch } from 'vue'
import ProductInventoryDialog from 'src/components/marketplace/inventory/ProductInventoryDialog.vue'
import ReviewsListDialog from 'src/components/marketplace/reviews/ReviewsListDialog.vue';
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

export default defineComponent({
  name: 'ProductsPage',
  components: {
    ProductInventoryDialog,
    ReviewsListDialog,
    LimitOffsetPagination,
    MarketplaceHeader,
  },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
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
    function categoriesPrompt() {
      $q.dialog({
        title: t('FilterCategories'),
        position: 'bottom',
        options: {
          type: 'checkbox',
          model: filterOpts.value.categories,
          items: categoriesFilter.value.opts.map(category => Object({
            label: category,
            value: category,
            color: 'brandblue',
          })),
        },
        ok: { color: 'brandblue' },
        cancel: { flat: true, color: 'grey' },
      }).onOk(val => {
        filterOpts.value.categories = val
      })
    }

    const filterOpts = ref({
      sort: undefined,
      search: '',
      categories: [],
    })
    watch(filterOpts, () => fetchProducts(), { deep: true })

    const products = ref([].map(Product.parse))

    const fetchingProducts = ref(false)
    const productsPagination = ref({ count: 0, limit: 0, offset: 0 })
    onMounted(() => fetchProducts())
    function fetchProducts(opts={limit: 0, offset: 0}) {
      const params = {
        s: filterOpts?.value?.search || undefined,
        shop_id: Number(marketplaceStore.activeShopId),
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
        ordering: filterOpts.value.sort || undefined,
        categories: filterOpts.value.categories.join('|') || undefined,
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
      { name: 'product', align: 'left', label: t('Product'), field: 'name', sortable: true },
      { name: 'reviews', align: 'left', label: t('Reviews') },
      { name: 'total-quantity', align: 'center', label: t('Stock'), field: 'totalStocks', sortable: true },
      { name: 'created', align: 'center', label: t('Created'), field: 'createdAt', format: formatTimestampToText, sortable: true },
      // { name: 'actions', align: 'center', label: '' },
    ]
    const sortFieldNameMap = {
      product: 'name',
      'total-quantity': 'total_stocks',
      'created': 'created_at',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

    const productsTableState = ref({
      expanded: [].map(Product.parse),
      selected: [].map(Product.parse),
    })

    const productDetailDialog = ref({
      show: false,
      product: Product.parse(),
    })

    function viewProductDetail(product=Product.parse()) {
      productDetailDialog.value.product = product
      productDetailDialog.value.show = true
    }

    const reviewsListDialog = ref({ show: false, product: Product.parse() })
    function openProductReviewsDialog(product=Product.parse()) {
      reviewsListDialog.value.product = product
      reviewsListDialog.value.show = true
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
      categoriesFilter,
      categoriesPrompt,
      filterOpts,
      products,
      fetchingProducts,
      productsPagination,
      fetchProducts,
      table,
      productsTableColumns,
      sortMethod,
      productsTableState,
      productDetailDialog,
      viewProductDetail,
      reviewsListDialog,
      openProductReviewsDialog,

      refreshPage,
    }
  },
})
</script>
<style scoped lang="scss">
.filter-opt {
  border: 1px solid currentColor;
  border-radius: 4px;
}
</style>
