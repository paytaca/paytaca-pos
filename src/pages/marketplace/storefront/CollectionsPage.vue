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
      <div class="full-width q-px-sm q-mb-sm">
        <div class="row items-end q-mb-sm no-wrap">
          <q-input
            dense
            v-model="filterOpts.search"
            :placeholder="$t('Name')"
            debounce="500"
          >
            <template v-slot:prepend><q-icon name="search"/></template>
          </q-input>
          <q-space/>
          <q-btn flat padding="sm" icon="tune">
            <q-menu v-model="openFilterOptsForm" class="q-pa-md">
              <q-btn
                flat
                no-caps
                :label="$t('Reset')"
                color="brandblue"
                padding="xs md"
                class="text-underline q-r-mt-md q-r-mr-lg float-right"
                v-close-popup
                @click="() => filterOpts = createDefaultFilterOpts()"
              />
              <div class="q-py-xs"></div>
              <div class="q-mb-sm" style="min-width:100%;">
                <div class="text-subtitle1">{{ $t('CollectionType') }}</div>
                <q-btn-toggle
                  v-model="filterOpts.auto"
                  no-caps
                  no-wrap
                  stack
                  toggle-color="primary"
                  padding="xs lg"
                  :options="[
                    {label: $t('Auto'), value: true },
                    {label: $t('Manual'), value: false },
                    {label: $t('All'), value: null}
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
            @click="() => openCreateCollectionDialog()"
          />
        </div>
        <div class="row items-center"> 
          <div
            v-if="typeof filterOpts?.auto === 'boolean'"
            class="ellipsis filter-opt q-px-xs"
            @click="openFilterOptsForm = true"
          >
            {{ $t('CollectionType', {}, 'CollectionType') }}
            :
            {{ filterOpts?.auto ? $t('Auto') : $t('Manual') }}
          </div>
        </div>
      </div>

      <q-table
        ref="table"
        :loading="fetchingCollections"
        :columns="collectionsTableColumns"
        :rows="collections"
        :pagination="{ rowsPerPage: 0 }"
        row-key="id"
        hide-pagination
        binary-state-sort
        :sort-method="sortMethod"
        @row-click="(evt, row) => $router.push({
          name: 'marketplace-storefront-collection',
          params: { collectionId: row.id }
        })"
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
        <template v-slot:body-cell-name="props">
          <q-td :props="props">
            <div class="row items-center no-wrap q-gutter-xs">
              <img
                v-if="props.row?.imageUrl"
                :src="props.row?.imageUrl"
                width="50"
                class="rounded-borders"
              />
              <div>{{ props.row?.name }}</div>
            </div>
          </q-td>
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
import { useI18n } from 'vue-i18n'
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
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()

    const openFilterOptsForm = ref(false)
    function createDefaultFilterOpts() {
      return {
        sort: undefined,
        search: '',
        auto: null,
      }
    }
    const filterOpts = ref(createDefaultFilterOpts())
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
        ordering: filterOpts.value.sort || undefined,
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

    const table = ref()
    const collectionsTableColumns = [
      { name: 'name', align: 'left', label: t('Name') , field: 'name', classes: 'text-weight-medium', sortable: true },
      { name: 'auto', align: 'center', label: t('Type') , field: 'auto', format: val => val ? t('Auto') : t('Manual'), sortable: true },
      { name: 'count', align: 'center', label: t('Products') , field: 'productsCount', sortable: true },
      { name: 'created', align: 'center', label: t('Created') , field: 'createdAt', format: formatTimestampToText, sortable: true },
    ]
    const sortFieldNameMap = {
      count: 'products_count',
      created: 'created_at',
    }
    function sortMethod(rows, sortBy, descending) {
      const fieldName = sortFieldNameMap[sortBy] || sortBy
      filterOpts.value.sort = (descending ? '-': '') + fieldName
      return rows
    }

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
      openFilterOptsForm,
      createDefaultFilterOpts,
      filterOpts,
      collections,
      fetchingCollections,
      fetchCollections,
      collectionsPagination,

      table,
      collectionsTableColumns,
      sortMethod,

      openCreateCollectionDialog,
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
