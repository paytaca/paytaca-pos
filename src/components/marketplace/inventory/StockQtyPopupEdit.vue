<template>
  <q-popup-edit ref="popupEdit" v-bind="popupEditProps" :model-value="0" :cover="false" self="top middle">
    <div>{{ $t('Quantity') }}</div>
    <q-input
      dense outlined
      autofocus
      :disable="loading"
      :placeholder="adjustType === 'set' ? stock?.quantity : 0"
      v-model.number="quantity"
      bottom-slots
    />
    <div>{{ $t('AdjustType') }}</div>
    <q-btn-toggle
      no-caps
      :disable="loading"
      v-model="adjustType"
      toggle-color="brandblue"
      :options="[
        {label: $t('Set'), value: 'set'},
        {label: $t('Add'), value: 'add'},
      ]"
      class="q-mt-sm"
      bottom-slots
    />
    <q-separator class="q-mt-md q-mb-sm" />

    <q-btn
      :disable="loading"
      :loading="loading"
      no-caps
      :label="$t('Update')"
      color="brandblue"
      class="full-width"
      @click="adjustInventoryQuantity()"
    />
  </q-popup-edit>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { Stock } from 'src/marketplace/objects'
import { defineComponent } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export default defineComponent({
  name: 'StockQtyPopupEdit',
  props: {
    stock: Stock,
    popupEditProps: Object,
  },
  emits: [
    'updated',
  ],
  data() {
    return {
      loading: false,
      adjustType: 'add',
      quantity: null,
    }
  },
  methods: {
    async adjustInventoryQuantity() {
      this.loading = true
      const payload = {
        stock_id: this.stock?.id,
        adjust_type: this.adjustType,
        quantity: this.quantity,
        source: 'paytaca_pos',
      }
      if (payload.adjustment_type === 'add' && !payload.quantity) return
      if (payload.adjustment_type === 'set' && payload.quantity === this.inventory?.quantity) return

      try {
        this.stock.$state.updatingFields.add('quantity')
        const response = await backend.post('stocks/adjustments/', payload)
        this.reset()
        this.$emit('updated', Stock.parse(response?.data))
        this.$refs['popupEdit']?.hide()
      } catch(error) {
        let errorMsg = error?.response?.data?.detail

        if (error?.response?.status === 403 && !errorMsg) {
          errorMsg = t('InsufficientPermissionToAccessInventory')
        }

        this.$q.notify({
          message: errorMsg || t('UpdateStockErrorMsg'),
          type: 'negative',
        })
      } finally {
        this.stock.$state.updatingFields.delete('quantity')
        this.loading = false
      }
    },
    reset() {
      this.adjustType = 'add'
      this.quantity = null
    }
  }
})
</script>
