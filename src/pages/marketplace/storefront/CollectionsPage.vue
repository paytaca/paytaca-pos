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
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-md">
          <q-input
            dense
            model-value=""
            placeholder="Name"
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
            @click="() => openCreateCollectionDialog()"
          />
        </div>
      </div>

      <q-table
        :loading="fetchingCollections"
        :columns="collectionsTableColumns"
        :rows="collections"
        :pagination="{ rowsPerPage: 0 }"
        row-key="id"
        hide-pagination
        @row-click="(evt, row) => $router.push({ name: 'marketplace-storefront-collection', params: { collectionId: row.id } })"
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
              :modelValue="collectionsPagination"
              @update:modelValue="fetchCollections"
            />
          </div>
        </template>
      </q-table>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { Collection } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { formatTimestampToText } from 'src/marketplace/utils'
import { useQuasar } from 'quasar'
import { defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import CollectionCreateFormDialog from 'src/components/marketplace/storefront/CollectionCreateFormDialog.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'

export default defineComponent({
  name: 'CollectionsPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const $q = useQuasar()

    const collections = ref([].map(Collection.parse))
    const fetchingCollections = ref(false)
    const collectionsPagination = ref({ count: 0, limit: 0, offset: 0 })
    onMounted(() => fetchCollections())
    function fetchCollections(opts={limit: 0, offset: 0}) {
      const params = {
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
      }
      return backend.get(`connecta/collections/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          collections.value = response.data.results.map(Collection.parse)
          collectionsPagination.value.limit = response?.data?.limit
          collectionsPagination.value.offset = response?.data?.offset
          collectionsPagination.value.count = response?.data?.count
          return response
        })
    }

    const collectionsTableColumns = [
      { name: 'name', align: 'center', label: 'Name', field: 'name', classes: 'text-weight-medium' },
      { name: 'auto', align: 'center', label: 'Type', field: 'auto', format: val => val ? 'Auto' : 'Manual' },
      { name: 'count', align: 'center', label: 'Products', field: 'productsCount' },
      { name: 'created', align: 'center', label: 'Created', field: 'createdAt', format: formatTimestampToText },
    ]

    function openCreateCollectionDialog() {
      $q.dialog({
        component: CollectionCreateFormDialog,
      }).onOk(() => fetchCollections())
    }

    async function refreshPage(done) {
      try {
        await fetchCollections()
      } finally {
        done()
      }
    }

    return {
      collections,
      fetchingCollections,
      fetchCollections,
      collectionsPagination,

      collectionsTableColumns,

      openCreateCollectionDialog,
      refreshPage,
    }
  },
})
</script>
