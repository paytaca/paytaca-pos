<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">Collections</div>
            <div class="text-grey">Storefront</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div v-if="collection?.id" class="row items-center justify-end q-mb-sm">
        <q-btn @click="() => $q.dark.toggle()"/>
        <q-btn
          :outline="$q.dark.isActive"
          no-caps label="Delete"
          icon="delete"
          color="red"
          padding="xs md"
          @click="() => confirmDeleteCollection()"
        />
      </div>
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h5">{{ collection?.name }}</div>
          <div>
            <div>
              <template v-if="collection?.auto">Auto</template>
              <template v-else>Manual</template>
            </div>
            <div class="text-caption bottom">Collection Type</div>
          </div>
          <div v-if="collection?.auto" class="row">
            <div class="text-subtitle1 col-12">Conditions</div>
            <div v-if="collection?.categories?.length" class="col-12 q-pa-xs">
              <div class="row q-gutter-xs">
                <q-chip
                  v-for="category in collection?.categories" :key="category"
                  dense
                  :outline="!$q.dark.isActive"
                  color="brandblue"
                >
                  {{ category }}
                </q-chip>
              </div>
              <div class="text-caption bottom">Categories</div>
            </div>

            <div v-if="!isNaN(collection?.priceLessThan) && collection?.priceLessThan !== null" class="q-pa-xs">
              <div>{{ collection?.priceLessThan }} {{ marketplaceStore?.currency }}</div>
              <div class="text-caption bottom">Price less than</div>
            </div>

            <div v-if="!isNaN(collection?.priceGreaterThan) && collection?.priceGreaterThan !== null" class="q-pa-xs">
              <div>{{ collection?.priceGreaterThan }} {{ marketplaceStore?.currency }}</div>
              <div class="text-caption bottom">Price creater than</div>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-mb-md">
        <q-card-section class="q-pb-none">
          <div class="text-h6">Products</div>
        </q-card-section>
        <q-list class="q-pb-md">
          <q-item
            v-for="product in products" :key="product?.id"
            clickable
            @click="() => viewProductDetail(product)"
          >
            <q-item-section v-if="product?.displayImageUrl" avatar class="q-pr-xs">
              <img
                :src="product?.displayImageUrl"
                width="50"
                class="rounded-borders"
              />
            </q-item-section>
            <q-item-section top>
              <q-item-label>{{ product?.name }}</q-item-label>
              <q-item-label class="text-caption">#{{ product?.id }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="!isNaN(product?.totalStocks) && product?.totalStocks !== null" avatar top>
              <q-item-label>{{ product?.totalStocks }}</q-item-label>
              <q-item-label class="text-caption">Stocks</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-pull-to-refresh>
    <ProductInventoryDialog
      v-model="productDetailDialog.show"
      :productObj="productDetailDialog.product"
    />
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Collection, Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import ProductInventoryDialog from 'src/components/marketplace/inventory/ProductInventoryDialog.vue';
import { useRouter } from 'vue-router'

export default defineComponent({
  name: 'CollectionPage',
  components: {
    ProductInventoryDialog,
    MarketplaceHeader,
  },
  props: {
    collectionId: [Number, String],
  },
  setup(props) {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    onMounted(() => {
      fetchCollection()
      fetchProducts()
    })
    const fetchingCollection = ref(false)
    const collection = ref(Collection.parse())

    watch(() => [props.collectionId], () => fetchCollection())

    function fetchCollection() {
      if (!props.collectionId) return Promise.reject()
      fetchingCollection.value = true
      return backend.get(`connecta/collections/${props.collectionId}/`)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          collection.value = Collection.parse(response?.data)
          return response
        })
        .finally(() => {
          fetchingCollection.value = false
        })
    }

    function confirmDeleteCollection() {
      $q.dialog({
        title: 'Delete collection',
        message: `Deleting collection '${collection.value.name}'. Are you sure?`,
        ok: { color: 'red', noCaps: true, label: 'Delete' },
        cancel: { color: 'grey', noCaps: true, flat: true },
      }).onOk(deleteCollection)
    }

    function deleteCollection() {
      const dialog = $q.dialog({
        title: 'Removing collection',
        ok: false,
        progress: true,
        persistent: true,
      })

      backend.delete(`connecta/collections/${collection.value?.id}/`)
        .then(() => {
          dialog.update({
            title: 'Collection deleted',
          }).onDismiss(() => $router.go(-1))
        })
        .catch(error => {
          const data = error?.response?.data
          dialog.update({
            title: 'Error',
            message: data?.detail || 'Unknown error occurred',
          })
        })
        .finally(() => {
          dialog.update({ persistent: false, progress: false })
        })
    }

    const products = ref([].map(Product.parse))
    function fetchProducts() {
      const params = {
        collection_id: props.collectionId || null,
      }
      return backend.get(`products/info/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          products.value = response?.data?.results.map(Product.parse)
          return response
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

    async function refreshPage(done) {
      try {
        await Promise.all([
          fetchCollection(),
          fetchProducts(),
        ])
      } finally {
        done()
      }
    }

    return {
      marketplaceStore,
      collection,
      fetchCollection,

      confirmDeleteCollection,

      products,
      fetchProducts,

      productDetailDialog,
      viewProductDetail,

      refreshPage,
    }
  },
})
</script>
