<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Collections') }}</div>
            <div class="text-grey">{{ $t('Storefront') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div v-if="collection?.id" class="row items-center justify-end q-mb-sm q-gutter-sm">
        <q-btn
          :outline="$q.dark.isActive"
          no-caps
          :label="$t('Delete')"
          icon="delete"
          color="red"
          padding="xs md"
          @click="() => confirmDeleteCollection()"
        />
      </div>
      <q-card class="q-mb-md" style="position:relative;" v-ripple @click="() => openEditForm()">
        <q-card-section>
          <q-icon v-if="collection?.id" name="edit" style="float:right;" size="1.5em"/>
          <div class="text-h5">
            {{ collection?.name }}
            <q-spinner v-if="fetchingCollection || collection?.$state?.updating"/>
          </div>
          <div v-if="collection?.imageUrl" class="row items-center justify-center full-width">
            <img
              :src="collection?.imageUrl"
              class="rounded-borders"
              style="max-height:250px;"
            />
          </div>
          <div v-if="typeof collection?.auto === 'boolean'">
            <div>
              <template v-if="collection?.auto">{{ $t('Auto') }} </template>
              <template v-else>{{ $t('Manual') }} </template>
            </div>
            <div class="text-caption bottom">{{ $t('CollectionType') }}</div>
          </div>
          <div v-if="collection?.auto" class="row">
            <div class="text-subtitle1 col-12">{{ $t('Conditions') }} </div>
            <div>
              <span v-if="collection?.conditionsOperand == 'any'">
                {{ $t('ProductsMatchAny') }}
              </span>
              <span v-else-if="collection?.conditionsOperand == 'all'">
                {{ $t('ProductsMatchAll') }}
              </span>
            </div>
            <table v-if="Array.isArray(collection?.conditions)" class="full-width text-left">
              <tr>
                <th>{{ $t('Field') }}</th>
                <th>{{ $t('Condition') }}</th>
                <th>{{ $t('Value') }}</th>
              </tr>
              <tr v-for="(condition, index) in collection?.conditions" :key="index">
                <td>{{ condition.fieldLabel }}</td>
                <td>{{ condition?.expressionLabel }}</td>
                <td>
                  <template v-if="condition.field === CollectionCondition.fields.price">
                    {{ condition.value }}
                    {{ marketplaceStore?.currency }}
                  </template>
                  <template v-else-if="condition.field == CollectionCondition.fields.created">
                    {{ formatTimestampToText(condition.value) }}
                  </template>
                  <template v-else-if="condition.field == CollectionCondition.fields.categories">
                    <template v-for="(category, index) in condition.value" :key="index">
                      <q-chip
                        dense color="brandblue"
                        class="q-ma-none q-mr-xs text-white"
                      >
                        {{ category }}
                      </q-chip>
                    </template>
                  </template>
                  <template v-else>
                    {{ condition.value }}
                  </template>
                </td>
              </tr>
            </table>
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-mb-md">
        <q-card-section class="q-pb-none">
          <div class="row items-center full-width">
            <div class="text-h6">
              {{ $t('Products') }} 
              <template v-if="productsPagination?.count && !isNaN(productsPagination?.count)">
                ({{ productsPagination?.count }})
              </template>
              <q-spinner v-if="fetchingProducts"/>
            </div>
            <q-space/>
            <LimitOffsetPagination
              :pagination-props="{
                maxPages: 5,
                round: true,
                padding: 'sm md',
                flat: true,
                boundaryNumbers: true
              }"
              :hide-below-pages="2"
              :modelValue="productsPagination"
              @update:modelValue="fetchProducts"
            />
          </div>
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
              <q-item-label>
                {{ product?.name }}
                <template v-if="product?.hasVariants">
                  ({{
                    $t(
                      'VariantCount',
                      { count: product?.variants?.length || product?.variantsCount },
                      `(${ product?.variants?.length || product?.variantsCount } variants)`
                    )
                  }})
                </template>
              </q-item-label>
              <q-item-label class="text-caption">#{{ product?.id }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="!isNaN(product?.totalStocks) && product?.totalStocks !== null" avatar top>
              <q-item-label>{{ product?.totalStocks }}</q-item-label>
              <q-item-label class="text-caption">{{ $t('Stocks') }}</q-item-label>
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
import { Collection, CollectionCondition, Product } from 'src/marketplace/objects'
import { formatTimestampToText } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import ProductInventoryDialog from 'src/components/marketplace/inventory/ProductInventoryDialog.vue';
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import CollectionFormDialog from 'src/components/marketplace/storefront/CollectionFormDialog.vue'

export default defineComponent({
  name: 'CollectionPage',
  components: {
    LimitOffsetPagination,
    ProductInventoryDialog,
    MarketplaceHeader,
  },
  props: {
    collectionId: [Number, String],
  },
  setup(props) {
    const $q = useQuasar()
    const { t } = useI18n()
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
        title: t('DeleteCollection'),
        message: t(
          'DeleteCollectionMsg',
          { name: collection.value.name },
          `Deleting collection '${collection.value.name}'. Are you sure?`
        ),
        ok: { color: 'red', noCaps: true, label: t('Delete') },
        cancel: { color: 'grey', noCaps: true, flat: true },
      }).onOk(deleteCollection)
    }

    function deleteCollection() {
      const dialog = $q.dialog({
        title: t('RemovingCollection'),
        ok: false,
        progress: true,
        persistent: true,
      })

      backend.delete(`connecta/collections/${collection.value?.id}/`)
        .then(() => {
          dialog.update({
            title: t('CollectionDeleted'),
          }).onDismiss(() => $router.go(-1))
        })
        .catch(error => {
          const data = error?.response?.data
          dialog.update({
            title: t('Error'),
            message: data?.detail || t('UnknownErrorOccurred'),
          })
        })
        .finally(() => {
          dialog.update({ persistent: false, progress: false })
        })
    }

    const products = ref([].map(Product.parse))
    const fetchingProducts = ref(false)
    const productsPagination = ref({ count: 0, limit: 0, offset: 0 })
    function fetchProducts(opts={ limit: 0, offset: 0 }) {
      const params = {
        collection_id: props.collectionId || null,
        limit: opts?.limit || 10,
        offset: opts?.offset || undefined,
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

    const productDetailDialog = ref({
      show: false,
      product: Product.parse(),
    })

    function viewProductDetail(product=Product.parse()) {
      productDetailDialog.value.product = product
      productDetailDialog.value.show = true
    }

    function openEditForm() {
      $q.dialog({
        component: CollectionFormDialog,
        componentProps: {
          collection: collection.value
        }
      }).onOk(() => fetchProducts())
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
      CollectionCondition,
      marketplaceStore,
      collection,
      fetchingCollection,
      fetchCollection,

      confirmDeleteCollection,

      products,
      fetchingProducts,
      productsPagination,
      fetchProducts,

      productDetailDialog,
      viewProductDetail,

      openEditForm,

      refreshPage,

      // utils funcs
      formatTimestampToText,
    }
  },
})
</script>
