<template>
  <q-popup-edit ref="popupEdit" v-bind="popupEditProps" :model-value="0" :cover="false" self="top middle">
    <div>Quantity</div>
    <q-input
      dense outlined
      autofocus
      :disable="loading"
      :placeholder="adjustType === 'set' ? stock?.quantity : 0"
      v-model.number="quantity"
      bottom-slots
    />
    <div>Adjust type</div>
    <q-btn-toggle
      no-caps
      :disable="loading"
      v-model="adjustType"
      toggle-color="brandblue"
      :options="[
        {label: 'Set', value: 'set'},
        {label: 'Add', value: 'add'},
      ]"
      class="q-mt-sm"
      bottom-slots
    />
    <q-separator class="q-mt-md q-mb-sm" />

    <q-btn
      :disable="loading"
      :loading="loading"
      no-caps
      label="Update"
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
        const response = await backend.post('stocks/adjustments/', payload)
        this.reset()
        this.$emit('updated', Stock.parse(response?.data))
        this.$refs['popupEdit']?.hide()
      } catch(error) {
        let errorMsg = error?.response?.data?.detail

        if (error?.response?.status === 403 && !errorMsg) {
          errorMsg = 'Sorry, you do not have sufficient permissions to access the inventory.'
        }

        this.$q.notify({
          message: errorMsg || 'Error encountered in updating stock',
          type: 'negative',
        })
      } finally {
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
