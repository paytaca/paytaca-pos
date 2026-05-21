<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('Tax') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>

      <div class="row items-center justify-end q-gutter-x-sm q-mb-sm">
        <q-btn
          v-if="editMode"
          icon="refresh"
          :disable="savingTaxTypes"
          @click="resetFormData"
        />
        <q-space/>
        <q-btn
          v-if="editMode"
          no-caps
          label="Save"
          :loading="savingTaxTypes"
          :disable="!edited || savingTaxTypes"
          color="primary"
          @click="saveTaxTypes()"
        />
        <q-btn
          flat
          no-caps
          :disable="savingTaxTypes"
          :label="editMode ? $t('Cancel') : $t('Edit')"
          @click="toggleEditMode"
        />
      </div>
      
      <q-table
        ref="table"
        row-key="_id"
        :loading="fetchingTaxTypes || savingTaxTypes"
        :columns="taxTypesTableColumns"
        :rows="taxTypesFormData"
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template v-slot:body-cell-name="props">
          <q-td :props="props">
            <q-input
              dense
              :borderless="!editMode"
              :readonly="!editMode"
              :loading="savingTaxTypes"
              :disable="savingTaxTypes"
              autogrow
              v-model="props.row.name"
              style="min-width:5rem;"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-code="props">
          <q-td :props="props">
            <q-select
              dense
              :borderless="!editMode"
              :readonly="!editMode"
              :loading="savingTaxTypes"
              :disable="savingTaxTypes"
              :hide-dropdown-icon="!editMode"
              v-model="props.row.code"
              :options="taxCodeOptions"
              map-options
              emit-value
            />
          </q-td>
        </template>
        <template v-slot:body-cell-value="props">
          <q-td :props="props">
            <template v-if="!editMode">
              {{ props.row.value }} %
            </template>
            <q-input
              v-else
              dense
              :borderless="!editMode"
              :readonly="!editMode"
              :loading="savingTaxTypes"
              :disable="savingTaxTypes"
              autogrow
              v-model.number="props.row.value"
              suffix="%"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-delete="props">
          <q-td :props="props">
            <q-btn
              flat
              icon="delete"
              :disable="savingTaxTypes"
              @click="() => taxTypesFormData = taxTypesFormData.filter(el => el !== props.row)"
            />
          </q-td>
        </template>
        <template v-if="editMode" v-slot:bottom-row>
          <tr>
            <td colspan="999">
              <q-btn
                class="q-my-sm full-width"
                icon="add"
                :disable="savingTaxTypes"
                @click="taxTypesFormData.push(createEmptyRow())"
              />
            </td>
          </tr>
        </template>
      </q-table>
    </q-pull-to-refresh>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend';
import { TaxType } from 'src/marketplace/objects';
import { useMarketplaceStore } from 'src/stores/marketplace';
import { useTaxTypesForm } from 'src/composables/marketplace/taxTypesForm'
import { useI18n } from 'vue-i18n';
import { defineComponent, ref, computed, onMounted } from 'vue';
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue';

export default defineComponent({
  name: 'TaxesListPage',
  components: {
    MarketplaceHeader,
  },
  setup() {
    const { t: $t } = useI18n();
    const marketplaceStore = useMarketplaceStore();

    const taxTypes = ref([].map(TaxType.parse));
    const fetchingTaxTypes = ref(false);
    async function fetchTaxTypes() {
      const params = {
        shop_id: marketplaceStore.shopData?.id,
        limit: 100,
      }
      fetchingTaxTypes.value = true;
      return backend.get(`tax-types/`, { params })
        .then(response => {
          if (!Array.isArray(response.data?.results)) return Promise.reject({ response });
          taxTypes.value = response.data?.results.map(TaxType.parse);
          return response;
        })
        .finally(() => {
          fetchingTaxTypes.value = false;
        })
    }

    const table = ref()
    const taxTypesTableColumns = computed(() => {
      const columns = [
        { name: 'name', align: 'left', label: $t('Name'), field: 'name', sortable: true },
        { name: 'code', align: 'left', label: $t('Code'), field: 'code', sortable: true },
        { name: 'value', align: 'center', label: $t('Rate'), field: 'value', sortable: true },
        // { name: 'actions', align: 'center', label: '' },
      ]

      if (editMode.value) columns.push({ name: 'delete', align: 'center', label: $t('Delete') });
      return columns
    })
    const {
      taxCodeOptions,
      createEmptyRow,
      resetFormData,
      taxTypesFormData,
      normalizedFormData,
      edited,
    } = useTaxTypesForm(taxTypes)
    const editMode = ref(false);
    function toggleEditMode() {
      editMode.value = !editMode.value;
      if (!editMode.value) resetFormData()
    }

    const savingTaxTypes = ref(false);
    async function saveTaxTypes() {
      const data = {
        tax_types: normalizedFormData.value,
      };
      savingTaxTypes.value = true
      return backend.patch(`shops/${marketplaceStore.shopData?.id}/settings/`, { data })
        .then(response => {
          if (Array.isArray(response.data?.tax_types)) {
            taxTypes.value = response.data?.tax_types.map(TaxType.parse)
          }
          return response
        })
        .finally(() => {
          savingTaxTypes.value = false
        })
    }

    async function refreshPage(done = () => {}) {
      try {
        await fetchTaxTypes();
        resetFormData();
      } finally {
        done?.()
      }
    }

    onMounted(() => {
      refreshPage()
    })

    return {
      taxTypes,
      fetchingTaxTypes,
      fetchTaxTypes,
      table,
      taxTypesTableColumns,
      taxCodeOptions,
      createEmptyRow,
      resetFormData,
      taxTypesFormData,
      edited,
      editMode,
      toggleEditMode,
      savingTaxTypes,
      saveTaxTypes,
      refreshPage,
    }
  }
})
</script>