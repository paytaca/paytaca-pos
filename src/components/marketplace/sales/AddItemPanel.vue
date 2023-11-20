<template>
  <q-form ref="form" @submit="() => submit()">
    <div class="row items-center q-mb-sm">
      <slot name="title">
        <div class="text-h6">Add Item</div>
      </slot>
      <q-space/>
      <div class="row items-center q-gutter-xs">
        <q-btn
          flat round
          icon="search"
          :color="showVariantSearchDialog ? 'brandblue' : undefined"
          @click="selectVariant()"
        />
        <q-btn
          flat round
          icon="mdi-qrcode-scan"
          :color="scanner.show ? 'brandblue' : undefined"
          @click="() => scanner.show = !scanner.show"
        />
      </div>
    </div>
    <q-slide-transition>
      <div v-if="scanner.show" class="q-mb-sm">
        <div class="full-width" style="position:relative;min-height:1rem;">
          <StreamBarcodeReader
            @decode="onScannerDecode"
            @error="onScannerError"
          />
          <div style="position:absolute;bottom:0;left:0;right:0" class="text-center text-caption text-white">
            Scan barcode
          </div>
          <q-inner-loading :showing="scanner.loading" color="brandblue" dark/>
        </div>
      </div>
    </q-slide-transition>

    <!-- <q-slide-transition>
      <div v-if="!hideFieldsForScan" class="row items-center">
        <q-checkbox
          v-if="!disableCustomItem || formData.customItem"
          dense
          color="brandblue"
          v-model="formData.customItem"
          label="Custom Item"
          class="q-mb-sm"
        />
      </div>
    </q-slide-transition> -->
    <div v-if="!formData.customItem && !hideFieldsForScan" @click="() => selectVariant()">
      <q-field
        :dense="!formData.variant?.id"
        outlined
        clearable
        label="Item"
        v-model="formData.variant"
        bottom-slots
        :error="Boolean(scanner.error)"
        :error-message="scanner.error"
        @focus="() => {
          scanner.error = ''
        }"
      >
        <template v-slot:control="ctx">
          <template v-if="formData?.variant?.id">
            <q-item-section
              v-if="formData?.variant?.imageUrl || formData?.variant?.product?.imageUrl"
              avatar top
            >
              <img
                :src="formData?.variant?.imageUrl || formData?.variant?.product?.imageUrl"
                style="max-width:50px;"
                class="rounded-borders"
              />
            </q-item-section>
            <q-item-section top>
              <q-item-label>{{ formData?.variant?.itemName }}</q-item-label>
              <q-item-label v-if="formData?.variant?.price">
                <template v-if="!marketplaceStore?.currency">Price: </template>
                {{ formData?.variant?.price }} {{ marketplaceStore?.currency }}
              </q-item-label>
            </q-item-section>
          </template>
          <div v-else-if="ctx.focused" class=text-grey>
            Search / scan item
          </div>
        </template>
      </q-field>
    </div>
    <template v-else-if="formData.customItem">
      <q-input
        dense
        outlined
        :disable="disable"
        label="Item name (Custom)"
        v-model="formData.itemName"
        @blur="() => formData.customItem = Boolean(formData.itemName)"
        lazy-rules
        :rules="[
          val => Boolean(val) || 'Required',
        ]"
      />
      <q-input
        dense
        outlined
        :disable="disable"
        label="Price"
        :suffix="marketplaceStore?.currency"
        type="number"
        step="0.001"
        v-model.number="formData.price"
        :rules="[
          val => Boolean(val) || 'Required',
        ]"
      />
    </template>

    <q-input
      v-if="withCostPrice"
      dense
      outlined
      :disable="disable"
      label="Cost price"
      :suffix="marketplaceStore?.currency"
      type="number"
      step="0.001"
      v-model.number="formData.costPrice"
      :placeholder="formData?.variant?.price ? `Price: ${formData?.variant?.price}`: ''"
      bottom-slots
    />
    <q-input
      dense
      outlined
      :disable="disable"
      label="Quantity"
      type="number"
      v-model.number="formData.quantity"
      bottom-slots
    />
    <q-slide-transition>
      <div v-if="!hideFieldsForScan" class="q-gutter-y-sm">
        <q-btn
          :disable="disable"
          color="brandblue"
          no-caps
          :label="formData.customItem ? 'Add custom item': 'Add Item'"
          class="full-width"
          type="submit"
        />
      </div>
    </q-slide-transition>
    <VariantSearchDialog
      v-model="showVariantSearchDialog"
      @ok="onVariantSelected"
      :excludeVariantIds="excludeVariantIds"
      hide-scanner
    >
      <template v-slot:no-item="ctx">
        <q-item v-if="!ctx?.searchVal">
          <q-item-section class="text-center text-grey">
            <q-item-label>Search item</q-item-label>
          </q-item-section>
        </q-item>
        <div v-else></div>
      </template>
      <template v-slot:before-options="ctx">
        <q-item
          v-if="(!ctx?.variantOpts?.length || ctx?.loading) && ctx?.searchVal"
          clickable v-ripple
          @click="() => setCustomItem({ itemName: ctx?.searchVal })"
        >
          <q-item-section class="text-center">
            <q-item-label class="text-subtitle1 text-underline">
              Add item '{{ ctx?.searchVal }}'
            </q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </VariantSearchDialog>
  </q-form>
</template>
<script>
import { setup } from 'axios-cache-adapter';
import { backend } from 'src/marketplace/backend'
import { Variant } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { debounce, useQuasar } from 'quasar'
import { computed, defineComponent, ref, watch } from 'vue'
import { StreamBarcodeReader } from "vue-barcode-reader";
import VariantSearchDialog from './VariantSearchDialog.vue'


const cachedBackend = setup(Object.assign({}, backend.defaults,
  {
    cache: {
      maxAge: 15 * 60 * 1000,
      exclude: { query: false },
    }
  },
))

export default defineComponent({
  name: 'AddItemPanel',
  components: {
    VariantSearchDialog,
    StreamBarcodeReader,
  },
  emits: [
    'submit',
  ],
  props: {
    disable: Boolean,
    excludeVariantIds: Array,
    withCostPrice: Boolean,
    persistScanner: Boolean,
    disableCustomItem: Boolean,
  },
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    const hideFieldsForScan = computed(() => scanner.value.show)
    const formData = ref({
      customItem: false,
      variant: [].map(Variant.parse)[0],
      itemName: '',
      price: null,
      quantity: null,
      costPrice: null,
    })

    const form = ref()
    function clearForm() {
      formData.value.customItem = false
      formData.value.variant = null
      formData.value.itemName = ''
      formData.value.price = null
      formData.value.quantity = null
      formData.value.costPrice = null
      setTimeout(() => form.value?.resetValidation?.(), 10)
    }

    const scanner = ref({
      show: false,
      loading: false,
      error: '',
    })

    watch(() => [scanner.value.show], () => {
      if (!scanner.value.show) return
      scanner.value.error = ''
    })
    
    const onScannerDecode = debounce((content='') => {
      if (!props.persistScanner) scanner.value.show = false
      scanner.value.loading = true
      const params = {
        code: content,
        limit: 1,
        shop_id: marketplaceStore.activeShopId,
      }

      const dialog = $q.dialog({
        title: 'Searching item',
        progress: true,
        ok: false, cancel: false,
        color: 'brandblue',
        persistent: true
      })
      cachedBackend.get('variants/', { params })
        .finally(() => {
          scanner.value.error = ''
        })
        .then(response => {
          if (!response?.data?.results?.length) {
            scanner.value.error = 'No variant found'
            return response
          }

          onVariantSelected(Variant.parse(response?.data?.results[0]), { keepScannerOn: true })
          if (!formData.value.quantity) formData.value.quantity = 1
          submit()
          return response
        })
        .catch(error => {
          console.error(error)
          scanner.value.error = 'Failed to retrieve item details'
        })
        .finally(() => {
          scanner.value.loading = false
          dialog.hide()
        })
    }, 500, true)
    function onScannerError(...args) {
      console.error(...args)
    }

    const showVariantSearchDialog = ref(false)
    function selectVariant() {
      showVariantSearchDialog.value = true
    }
    function onVariantSelected(variant, opts={ keepScannerOn: false }) {
      formData.value.customItem = false
      formData.value.variant = variant
      if (hideFieldsForScan.value && !opts?.keepScannerOn) scanner.value.show = false
    }

    /**
     * @param {Object} opts
     * @param {String} opts.itemName
     * @param {Number} opts.price
     * @param {Number} opts.quantity
     */
    function setCustomItem(opts={ itemName: '',  price: undefined, quantity: undefined }) {
      formData.value.customItem = true
      formData.value.variant = null
      formData.value.itemName = opts?.itemName
      formData.value.price = opts?.price
      formData.value.quantity = opts?.quantity
      showVariantSearchDialog.value = false
      if (hideFieldsForScan.value) scanner.value.show = false
    }

    function submit() {
      const data = {
        customItem: formData.value.customItem,
        variant: formData.value.variant,
        itemName: formData.value.itemName || undefined,
        price: formData.value.price || undefined,
        quantity: formData.value.quantity,
        costPrice: formData.value.costPrice,
      }
      if (!props.withCostPrice) delete data.costPrice
      if (data.customItem) {
        delete data.variant
      } else {
        delete data.itemName
        delete data.price
      }

      const isValidcustomItemItem = Boolean(data.customItem && data.itemName && data.price)
      if (
        (data?.variant?.id || isValidcustomItemItem) &&
        data?.quantity > 0 &&
        (!props.withCostPrice || data?.costPrice > 0)
      ) {
        $emit('submit', data)
        clearForm()
      }
    }
  
    return {
      marketplaceStore,
      hideFieldsForScan,
      formData,
      form,

      scanner,
      onScannerDecode,
      onScannerError,

      showVariantSearchDialog,
      selectVariant,
      onVariantSelected,
      setCustomItem,

      submit,
    }
  },
})
</script>
<style lang="scss" scoped>
.q-tab-panels .q-tab-panel{
  padding: 0;
}
</style>