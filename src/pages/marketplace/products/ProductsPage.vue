<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Products</div>
            <div class="text-grey">Marketplace</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md">
          <q-input
            dense
            v-model="filterOpts.search"
            placeholder="Product name"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
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
                    <q-item-label>Add Product</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item clickable :to="{ name: 'marketplace-batch-add-product' }">
                  <q-item-section>
                    <q-item-label>Add Multiple Products</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="row items-center">
          <q-chip
            v-for="category in filterOpts.categories" :key="category"
            removable
            @remove="() => filterOpts.categories = filterOpts.categories.filter(_category => _category != category)"
          >
            {{ category }}
          </q-chip>
          <q-btn
            flat
            :rounded="filterOpts.categories.length > 0"
            padding="xs"
            no-caps
            :label="!filterOpts.categories.length ? 'Filter categories': ''"
            :icon="filterOpts.categories.length ? 'add' : undefined"
            @click="categoriesPrompt"
          />
        </div>
      </div>
      <q-table
        :loading="fetchingProducts"
        :columns="productsTableColumns"
        :rows="products"
        :pagination="{ rowsPerPage: 0 }"
        :selected="productsTableState.selected"
        :expanded="productsTableState.expanded"
        hide-pagination
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
                      <q-item-label>Edit Product</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item
                    clickable
                    :to="{ name: 'marketplace-stocks', query: { productId: props.row?.id } }"
                    v-close-popup
                  >
                    <q-item-section>
                      <q-item-label>Go to inventory</q-item-label>
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
                  <q-item-label>Edit Product</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                :to="{ name: 'marketplace-stocks', query: { productId: product?.id } }"
                v-close-popup
              >
                <q-item-section>
                  <q-item-label>Go to inventory</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </template>
    </ProductInventoryDialog>
  </q-page>
</template>
<script>
import { formatTimestampToText } from 'src/marketplace/utils'
import { backend } from 'src/marketplace/backend'
import { Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { defineComponent, onMounted, ref, watch } from 'vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import ProductInventoryDialog from 'src/components/marketplace/inventory/ProductInventoryDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

export default defineComponent({
  name: 'ProductsPage',
  components: {
    ProductInventoryDialog,
    LimitOffsetPagination,
    MarketplaceHeader,
  },
  setup() {
    const $q = useQuasar()
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
        title: 'Filter categories',
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
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
        categories: filterOpts.value.categories.join('|') || undefined,
      }

      fetchingProducts.value = true
      return backend.get(`shops/${marketplaceStore.activeShopId}/products/`, { params })
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
    
    const productsTableColumns = [
      { name: 'product', align: 'left', label: 'Product', field: 'name' },
      { name: 'total-quantity', align: 'center', label: 'Stock', field: 'totalStocks' },
      { name: 'created', align: 'center', label: 'Created', field: 'createdAt', format: formatTimestampToText },
      // { name: 'actions', align: 'center', label: '' },
    ]

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
      productsTableColumns,
      productsTableState,
      productDetailDialog,
      viewProductDetail,

      refreshPage,
    }
  },
})
</script>
