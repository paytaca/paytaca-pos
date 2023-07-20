<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card class="q-pa-md" style="min-width:min(450px, 90vw);">
      <q-btn flat round icon="close" padding="xs" class="float-right" v-close-popup/>
      <div class="text-h6 q-mb-sm">Search Variant</div>
      <template v-if="mode === 'search'">
        <q-input
          ref="searchInput"
          dense outlined
          :loading="loading"
          v-model="searchVal"
          debounce="500"
          clearable
          @update:model-value="() => filterVariantOpts()"
        >
          <template v-slot:append>
            <q-icon name="search"/>
          </template>
          <template v-slot:after>
            <q-btn
              v-if="!hideScanner"
              flat
              :loading="scanner.loading"
              padding="sm"
              :text-color="$q.dark.isActive ? 'white' : 'black'"
              icon="mdi-qrcode-scan"
              @click="() => mode = 'scan'"
            />
          </template>
        </q-input>
        <q-list separator>
          <div v-if="loading" class="row items-center justify-center q-my-sm">
            <q-spinner size="2em"/>
          </div>
          <q-item v-else-if="!variantOpts?.length">
            <q-item-section class="text-center text-grey">
              <q-item-label v-if="searchVal">No items</q-item-label>
              <q-item-label v-else>Search variant</q-item-label>
            </q-item-section>
          </q-item>
          <q-item
            v-for="opt in variantOpts" :key="opt?.id"
            clickable
            @click="() => onDialogOK(opt)"
          >
            <q-item-section v-if="opt?.imageUrl || opt?.product?.imageUrl" side>
              <img
                :src="opt?.imageUrl || opt?.product?.imageUrl"
                style="max-width:50px;"
                class="rounded-borders"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ opt?.itemName }}</q-item-label>
              <q-item-label class="text-caption">{{ opt?.code }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label>Stocks: {{opt?.totalStocks }}</q-item-label>
              <q-item-label>{{opt?.price }} {{ marketplaceStore?.currency }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </template>
      <template v-else>
        <div class="q-mb-sm">
          <div class="full-width">
            <StreamBarcodeReader
              @decode="onScannerDecode"
              @error="onScannerError"
            />
            <div style="position:absolute;bottom:0;left:0;right:0" class="text-center text-caption text-white">
              Scan barcode
            </div>
          </div>
        </div>
      </template>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Variant } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { debounce, useDialogPluginComponent } from 'quasar'
import { defineComponent, onMounted, ref, watch } from 'vue'
import { StreamBarcodeReader } from "vue-barcode-reader";

export default defineComponent({
  name: 'VariantSearchDialog',
  components: {
    StreamBarcodeReader,
  },
  emits: [
    'update:model-value',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    modelValue: Boolean,
    excludeVariantIds: Array,
    hideScanner: Boolean,
  },
  setup(props, { emit: $emit }) {
    const marketplaceStore = useMarketplaceStore()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    const searchInput = ref()
    watch(innerVal, () => {
      if (!innerVal.value) return
      setTimeout(() => {
        console.log(searchInput.value)
        searchInput.value?.focus?.()
      }, 100)
    })

    const mode = ref('search') // search | scan

    const loading = ref(false)
    const searchVal = ref('')
    const variantOpts = ref([].map(Variant.parse))
    function filterVariantOpts() {
      const params = {
        s: searchVal.value,
        shop_id: marketplaceStore.activeShopId,
        exclude_ids: props.excludeVariantIds?.join?.(',') || undefined,
        limit: 5 + 2**(searchVal.value?.length || 0),
      }

      loading.value = true
      backend.get('variants/', { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          variantOpts.value = response.data?.results?.map(Variant.parse)
          if (Array.isArray(props.excludeVariantIds) && props.excludeVariantIds.length) {
            variantOpts.value = variantOpts.value.filter(variant => {
              return props.exludeVariantIds.indexOf(variant?.id) < 0
            })
          }
          return response
        })
        .finally(() => {
          loading.value = false
        })
    }
    filterVariantOpts = debounce(filterVariantOpts, 1000)
    onMounted(() => innerVal.value ? filterVariantOpts(): null)
    watch(innerVal, () => innerVal.value ? filterVariantOpts() : null)

    const scanner = ref({
      loading: false,
      error: '',
    })

    function onScannerDecode(content='') {
      scanner.value.show = false
      scanner.value.loading = true
      const params = {
        code: content,
        limit: 1,
        shop_id: marketplaceStore.activeShopId,
      }

      backend.get('variants/', { params })
        .finally(() => {
          scanner.value.error = ''
        })
        .then(response => {
          if (!response?.data?.results?.length) {
            scanner.value.error = 'No variant found'
            return response
          }

          const variant = Variant.parse(response?.data?.results[0])
          onDialogOK(variant)
          return response
        })
        .catch(error => {
          console.error(error)
          scanner.value.error = 'Failed to retrieve item details'
        })
        .finally(() => {
          scanner.value.loading = false
        })
    }
    function onScannerError(...args) {
      console.error(...args)
    }

    return {
      marketplaceStore,
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      searchInput,

      mode,
      
      loading,
      searchVal,
      variantOpts,
      filterVariantOpts,

      scanner,
      onScannerDecode,
      onScannerError,
    }
  },
})
</script>
