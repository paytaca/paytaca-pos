<template>
  <q-form ref="form" @submit="() => submit()">
    <q-select
      dense
      outlined
      :disable="disable"
      :loading="scanner.loading"
      label="Item"
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
            <q-item-label>Stocks</q-item-label>
            <q-item-label>{{opt?.totalStocks }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>

    <q-slide-transition>
      <div v-if="inlineScanner && scanner.show" class="q-mb-sm">
        <div style="position:relative;padding-bottom:75%;" class="full-width">
          <StreamBarcodeReader
            @decode="onScannerDecode"
            @error="onScannerError"
            style="position:absolute;inset:0;"
          />
          <div style="position:absolute;bottom:0;left:0;right:0" class="text-center text-caption">
            Scan barcode
          </div>
        </div>
      </div>
    </q-slide-transition>
    <q-input
      v-if="withCostPrice"
      dense
      outlined
      :disable="disable"
      label="Cost price"
      :suffix="marketplaceStore?.currency"
      type="number"
      :placeholder="formData?.variant?.price ? `Price: ${formData?.variant?.price}`: ''"
      v-model.number="formData.costPrice"
      bottom-slots
      :rules="[
        val => val > 0 || 'Invalid',
      ]"
    />
    <q-input
      dense
      outlined
      :disable="disable"
      label="Quantity"
      type="number"
      v-model.number="formData.quantity"
      bottom-slots
      :rules="[
        val => val > 0 || 'Invalid',
      ]"
    />
    <div class="q-gutter-y-sm">
      <q-btn
        :disable="disable"
        color="brandblue"
        no-caps
        label="Add Item"
        type="submit"
        class="full-width"
      />
      <q-btn
        v-if="!hideCancel"
        :disable="disable"
        outline
        color="grey"
        no-caps
        label="Cancel"
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
import { backend } from 'src/marketplace/backend'
import { debounce } from 'quasar'
import { computed, defineComponent, ref, watch } from 'vue'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { StreamBarcodeReader } from "vue-barcode-reader";
import { Variant } from 'src/marketplace/objects';


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

      backend.get('variants/', { params })
        .finally(() => {
          scanner.value.error = ''
        })
        .then(response => {
          if (!response?.data?.results?.length) {
            scanner.value.error = 'No variant found'
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
          scanner.value.error = 'Failed to retrieve item details'
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

    const variantOpts = ref([
      { id: 0, name: '', image_url: '', price: 0, product: { id: 0, name: '', image_url: '' } },
    ])
    function filterVariantOpts(val, update, abortUpdate) {
      const params = {
        s: val,
        shop_id: marketplaceStore.activeShopId,
        exclude_ids: props.exludeVariantIds?.join?.(',') || undefined,
        limit: 5 + 2**(val?.length || 0),
      }

      backend.get('variants/', { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          update(() => {
            variantOpts.value = response.data?.results?.map(Variant.parse)
            if (Array.isArray(props.exludeVariantIds) && props.exludeVariantIds.length) {
              variantOpts.value = variantOpts.value.filter(variant => {
                return props.exludeVariantIds.indexOf(variant?.id) < 0
              })
            }
          })
          return response
        })
        .catch(() => abortUpdate())
    }
    filterVariantOpts = debounce(filterVariantOpts)

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
      variantOpts,
      filterVariantOpts,
      submit,
    }
  },
})
</script>
