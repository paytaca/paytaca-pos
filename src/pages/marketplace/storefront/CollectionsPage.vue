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
            v-model="filterOpts.search"
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
        <div class="row items-center">
          <q-btn-dropdown
            no-caps
            :outline="$q.dark.isActive"
          >
            <template v-slot:label>
              <template v-if="filterOpts.auto == true">
                Auto
              </template>
              <template v-else-if="filterOpts.auto === false">
                Manual
              </template>
              <template v-else>
                Filter type
              </template>
            </template>
            <q-item clickable v-ripple v-close-popup @click="() => filterOpts.auto = null">
              <q-item-section>
                <q-item-label>All</q-item-label>
              </q-item-section>
            </q-item>
            <q-item clickable v-ripple v-close-popup @click="() => filterOpts.auto = true">
              <q-item-section>
                <q-item-label>Auto</q-item-label>
              </q-item-section>
            </q-item>
            <q-item clickable v-ripple v-close-popup @click="() => filterOpts.auto = false">
              <q-item-section>
                <q-item-label>Manual</q-item-label>
              </q-item-section>
            </q-item>
          </q-btn-dropdown>
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
import { defineComponent, onMounted, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import CollectionFormDialog from 'src/components/marketplace/storefront/CollectionFormDialog.vue'
import LimitOffsetPagination from 'src/components/LimitOffsetPagination.vue'
import { useMarketplaceStore } from 'src/stores/marketplace'

export default defineComponent({
  name: 'CollectionsPage',
  components: {
    MarketplaceHeader,
    LimitOffsetPagination,
  },
  setup() {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    const filterOpts = ref({
      search: '',
      auto: null,
    })
    watch(filterOpts, () => fetchCollections(), { deep: true })

    const collections = ref([].map(Collection.parse))
    const fetchingCollections = ref(false)
    const collectionsPagination = ref({ count: 0, limit: 0, offset: 0 })
    onMounted(() => fetchCollections())
    function fetchCollections(opts={limit: 0, offset: 0}) {
      const params = {
        storefront_id: marketplaceStore.storefrontData.id,
        limit: opts?.limit || 10,
        offset: opts?.offset || 0,
        s: filterOpts.value?.search || undefined,
        auto: typeof filterOpts.value.auto === 'boolean' ? filterOpts.value.auto : undefined,
      }
      fetchingCollections.value = true
      return backend.get(`connecta/collections/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          collections.value = response.data.results.map(Collection.parse)
          collectionsPagination.value.limit = response?.data?.limit
          collectionsPagination.value.offset = response?.data?.offset
          collectionsPagination.value.count = response?.data?.count
          return response
        })
        .finally(() => {
          fetchingCollections.value = false
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
        component: CollectionFormDialog,
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
      filterOpts,
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
