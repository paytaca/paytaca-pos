<template>
  <q-form ref="form" @submit="() => submit()">
    <q-select
      dense
      outlined
      :disable="disable"
      :loading="scanner.loading"
      :label="$t('Item')"
      use-input
      :options="variantOpts"
      option-label="name"
      option-value="id"
      behavior="menu"
      v-model="formData.variant"
      bottom-slots
      @filter="filterVariantOpts"
      @focus="() => scanner.error = ''"
      :error="Boolean(scanner.error)"
      :error-message="scanner.error"
    >
      <template v-slot:after>
        <q-btn
          flat
          :disable="disable"
          :loading="scanner.loading"
          padding="sm"
          :text-color="$q.dark.isActive ? 'white' : 'black'"
          icon="mdi-qrcode-scan"
          @click="() => scanner.show = !scanner.show"
        />
      </template>
      <template v-slot:selected-item="{ opt }">
        {{ opt?.itemName }}
      </template>
      <template v-slot:option="{ opt, toggleOption }">
        <q-item
          clickable
          :disable="disable"
          @click="() => toggleOption(opt)"
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
            <q-item-label>{{ $t('Stocks') }}</q-item-label>
            <q-item-label>{{ opt?.totalStocks }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
      <template v-if="pagination?.hasMore" v-slot:after-options>
        <q-separator inset/>
        <q-item
          clickable v-ripple
          :disable="Boolean(pagination?.appending)"
          @click="() => updateVariantOpts({ append: true })"
        >
          <q-item-section class="text-center">
            <q-item-label>
              {{ $t('More') }}
              <q-spinner v-if="pagination?.appending"/>
            </q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>

    <q-slide-transition>
      <div v-if="inlineScanner && scanner.show" class="q-mb-sm">
        <div class="full-width" style="position: relative;">
          <StreamBarcodeReader
            @decode="onScannerDecode"
            @error="onScannerError"
          />
          <div style="position:absolute;bottom:0;left:0;right:0" class="text-center text-caption text-white">
            {{ $t('ScanBarcode') }}
          </div>
        </div>
      </div>
    </q-slide-transition>
    <!--TODO:-->
    <q-input
      v-if="withCostPrice"
      dense
      outlined
      :disable="disable"
      :label="$t('CostPrice')"
      :suffix="marketplaceStore?.currency"
      type="number"
      step="0.001"
      :placeholder="formData?.variant?.price ? `Price: ${formData?.variant?.price}`: ''"
      v-model.number="formData.costPrice"
      bottom-slots
      :rules="[
        val => val > 0 || $t('Invalid'),
      ]"
    />
    <q-input
      dense
      outlined
      :disable="disable"
      :label="$t('Quantity')"
      type="number"
      v-model.number="formData.quantity"
      bottom-slots
      :rules="[
        val => val > 0 || $t('Invalid'),
      ]"
    />
    <div class="q-gutter-y-sm">
      <q-btn
        :disable="disable"
        color="brandblue"
        no-caps
        :label="$t('AddItem')"
        type="submit"
        class="full-width"
      />
      <q-btn
        v-if="!hideCancel"
        :disable="disable"
        outline
        color="grey"
        no-caps
        :label="$t('Cancel')"
        @click="() => {$emit('cancel');clearForm();}"
        class="full-width"
      />
    </div>
    <q-dialog
      v-if="!inlineScanner"
      v-model="scanner.show"
      full-height position="bottom"
    >
      <div class="row items-center justify-center">
        <StreamBarcodeReader @decode="onScannerDecode" @error="onScannerError"/>
      </div>
    </q-dialog>
  </q-form>
</template>
<script>
import { setup } from 'axios-cache-adapter';
import { backend } from 'src/marketplace/backend'
import { debounce } from 'quasar'
import { computed, defineComponent, ref, watch } from 'vue'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { StreamBarcodeReader } from "vue-barcode-reader";
import { Variant } from 'src/marketplace/objects';
import { useI18n } from 'vue-i18n'

const cachedBackend = setup(Object.assign({}, backend.defaults,
  {
    cache: {
      maxAge: 15 * 60 * 1000,
      exclude: { query: false },
    }
  },
))


export default defineComponent({
  name: 'AddItemForm',
  components: {
    StreamBarcodeReader,
  },
  emits: [
    'submit',
    'cancel',
  ],
  props: {
    inlineScanner: Boolean, 
    autoSubmitOnScan: Boolean,
    exludeVariantIds: Array,
    withCostPrice: Boolean,
    hideCancel: Boolean,
    disable: Boolean,
  },
  setup(props, { emit: $emit, attrs: $attrs }) {
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()
    const showCancel = computed(() => {
      console.log($attrs)
      return $attrs.onCancel
    })

    const scanner = ref({
      show: false,
      loading: false,
      error: '',
    })
    watch(() => [scanner.value.show], () => {
      if (!scanner.value.show) return
      scanner.value.error = ''
    })
    function onScannerDecode(content='') {
      scanner.value.show = false
      scanner.value.loading = true
      const params = {
        code: content,
        limit: 1,
        shop_id: marketplaceStore.activeShopId,
      }

      cachedBackend.get('variants/', { params })
        .finally(() => {
          scanner.value.error = ''
        })
        .then(response => {
          if (!response?.data?.results?.length) {
            scanner.value.error = t('NoVariantFound')
            return response
          }

          formData.value.variant = Variant.parse(response?.data?.results[0])
          if (props.autoSubmitOnScan) {
            if (!formData.value.quantity) formData.value.quantity = 1
            submit()
          }
          return response
        })
        .catch(error => {
          console.error(error)
          scanner.value.error = t('FailedToRetrieveItemDetails')
        })
        .finally(() => {
          scanner.value.loading = false
        })
    }
    function onScannerError(...args) {
      console.error(...args)
    }

    const formData = ref({
      variant: Variant.parse(),
      costPrice: null,
      quantity: null,
    })

    const form = ref()
    function clearForm() {
      formData.value.variant = null
      formData.value.costPrice = null
      formData.value.quantity = null
      setTimeout(() => form.value?.resetValidation(), 10)
    }

    const pagination = ref({ nextOffset: 0, hasMore: 0, appending: false })
    const searchVal = ref('')
    const variantOpts = ref([].map(Variant.parse))
    function filterVariantOpts(val, update, abortUpdate) {
      searchVal.value = val
      updateVariantOpts()
        .then(() => update())
        .catch(() => abortUpdate())
    }
    filterVariantOpts = debounce(filterVariantOpts)
    function updateVariantOpts(opts={ append: false }) {
      const params = {
        s: searchVal.value,
        shop_id: marketplaceStore.activeShopId,
        exclude_ids: props.exludeVariantIds?.join?.(',') || undefined,
        limit: 5,
        offset: opts?.append ? pagination.value?.nextOffset : undefined,
      }

      pagination.value.appending = Boolean(opts?.append)
      const cache = { maxAge: 2 * 60 * 1000, exclude: { query: false } }
      return cachedBackend.get(`variants/`, { params, cache })
        .then(response => {
          if (!response?.data) return Promise.reject({ response })
          const { results, offset, limit, count } = response?.data
          if (!Array.isArray(results)) return Promise.reject({ response })

          const parsedResults = results.map(Variant.parse)
          if (opts?.append) variantOpts.value.push(...parsedResults)
          else variantOpts.value = parsedResults
          if (props.exludeVariantIds?.length) {
            variantOpts.value = variantOpts.value.filter(variant => {
              return props.exludeVariantIds.indexOf(variant?.id) < 0
            })
          }
          const nextOffset = offset + limit
          pagination.value = { nextOffset: nextOffset, hasMore: nextOffset < count }
          return response
        })
        .finally(() => {
          pagination.value.appending = false
        })
    }

    function submit() {
      const data = {
        variant: formData.value.variant,
        quantity: formData.value.quantity,
      }
      if (props.withCostPrice) data.costPrice = formData.value.costPrice
      $emit('submit', data)
      clearForm()
    }
  
    return {
      marketplaceStore,
      showCancel,
      scanner,
      onScannerDecode,
      onScannerError,
      formData,
      form,
      clearForm,
      pagination,
      variantOpts,
      filterVariantOpts,
      updateVariantOpts,
      submit,
    }
  },
})
</script>
