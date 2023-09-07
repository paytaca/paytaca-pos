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
            @click="() => openAddProductsDialog()"
          />
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
        :loading="fetchingProducts"
        :columns="productsTableColumns"
        :rows="products"
        :pagination="{ rowsPerPage: 0 }"
        selection="multiple"
        row-key="id"
        v-model:selected="productsTableState.selected"
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
              <q-spinner v-if="props.row?.$state?.updating" size="1.5em" class="q-ml-sm"/>
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-available="props">
          <q-td :props="props" @click="() => toggleProductSelection(props.row)">
            {{ props?.row?.availableAtStorefrontText?.(marketplaceStore.storefrontData.id) }}
          </q-td>
        </template>
      </q-table>
    </q-pull-to-refresh>
    <ProductInventoryDialog
      v-model="productDetailDialog.show"
      :productObj="productDetailDialog.product"
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

export default defineComponent({
  name: 'StorefrontProducts',
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
        storefront_id: Number(marketplaceStore.storefrontData.id),
        s: filterOpts?.value?.search || undefined,
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
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

    const productsTableColumns = [
      { name: 'product', align: 'left', label: 'Product', field: 'name' },
      // { name: 'total-quantity', align: 'center', label: 'Stock', field: 'totalStocks' },
      { name: 'available', align: 'left', label: 'Available' },
      { name: 'markup-price', align: 'left', label: 'Markup Price', field: 'markupPriceRangeText', format: val => `${val} ${marketplaceStore?.currency}` },
      { name: 'created', align: 'center', label: 'Created', field: 'createdAt', format: formatTimestampToText },
      // { name: 'actions', align: 'center', label: '' },
    ]

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
      filterOpts,

      categoriesFilter,
      updateProductCategories,
      categoriesPrompt,

      products,
      fetchingProducts,
      productsPagination,
      fetchProducts,

      productsTableColumns,
      productsTableState,
      toggleProductSelection,
      confirmRemoveSelectedProducts,
      updateSelectedProductsAvailability,
      openAddProductsDialog,

      productDetailDialog,
      viewProductDetail,

      refreshPage,
    }
  },
})
</script>
