<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom" :persistent="formData.loading">
    <q-card>
      <q-card-section>
        <div class="text-h6">
          Add Stock
        </div>
        <q-form @submit="() => createStock()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-sm">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>
          <div>Variant*</div>
          <q-select
            dense
            outlined
            use-input
            :disable="formData.loading"
            :options="variantOpts"
            option-label="name"
            option-value="id"
            v-model="formData.variant"
            bottom-slot
            @filter="filterVariantOpts"
            :error="Boolean(formErrors?.variant)"
            :error-message="formErrors?.variant"
            :rules="[
              val => Boolean(val?.id) || 'Required',
            ]"
          >
            <template v-slot:selected-item="{ opt }">
              {{ opt?.product?.name }}
              <template v-if="opt?.name && opt?.name !== 'Default variant'">
                - {{ opt?.name }}
              </template>
            </template>
            <template v-slot:option="{ opt, toggleOption }">
              <q-item
                clickable
                :active="opt?.id === formData?.variant?.id"
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
                  <q-item-label class="text-caption">Qty: {{ opt.totalStocks }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <div>Quantity*</div>
          <q-input
            dense
            outlined
            :disable="formData.loading"
            type="number"
            v-model.number="formData.quantity"
            :error="Boolean(formErrors?.quantity)"
            :error-message="formErrors?.quantity"
            :rules="[
              val => Boolean(val) || 'Required',
              val => val > 0 || 'Invalid',
            ]"
          />
          <div>Cost Price</div>
          <q-input
            dense
            outlined
            :disable="formData.loading"
            :suffix="marketplaceStore?.currency"
            :placeholder="formData?.variant?.price"
            type="number"
            v-model.number="formData.costPrice"
            :error="Boolean(formErrors?.costPrice)"
            :error-message="formErrors?.costPrice"
            :rules="[
              val => (!val || val > 0) || 'Invalid',
            ]"
          />
          <div>
            <q-btn
              type="submit"
              :loading="formData.loading"
              :disable="formData.loading"
              color="brandblue"
              no-caps
              label="Add Stock"
              class="full-width"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent, ref } from 'vue'
import { debounce, useDialogPluginComponent } from 'quasar'
import { Stock, Variant } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'

export default defineComponent({
  name: 'CreateStockFormDialog',
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    variant: Variant,
  },
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()

    const formData = ref({
      loading: false,
      variant: props.variant,
      costPrice: null,
      quantity: null,
    })

    const variantOpts = ref([].map(Variant.parse))
    function filterVariantOpts(val, update, abortUpdate) {
      const params = {
        s: val,
        shop_id: marketplaceStore.activeShopId,
        limit: 5 + 2**(val?.length || 0),
      }

      backend.get('variants', { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          update(() => {
            variantOpts.value = response.data?.results.map(Variant.parse)
          })
          return response
        })
        .catch(() => abortUpdate())
    }
    filterVariantOpts = debounce(filterVariantOpts)


    const formErrors = ref({
      detail: [],
      shop: '',
      variant: '',
      costPrice: '',
      quantity: '',
    })
    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.shop = ''
      formErrors.value.variant = ''
      formErrors.value.costPrice = ''
      formErrors.value.quantity = ''
    }

    function createStock() {
      const payload = {
        variant_id: formData.value.variant.id,
        quantity: formData.value.quantity,
        cost_price: formData.value.costPrice || undefined,
      }

      formData.value.loading = true
      return backend.post('/stocks/', payload)
        .finally(() => clearFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          setTimeout(() => {
            onDialogOK(Stock.parse(response.data))
          }, 500)
          return response
        })
        .catch(error => {
          if (error?.response?.data) {
            const data = error?.response?.data
            formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
            formErrors.value.variant = errorParser.firstElementOrValue(data?.variant_id)
            formErrors.value.quantity = errorParser.firstElementOrValue(data?.quantity)
            formErrors.value.costPrice = errorParser.firstElementOrValue(data?.cost_price)

            if (formErrors.value.variant?.match?.(/.*does not exist.*/)) formErrors.value.variant = 'Variant not found'

            if (Array.isArray(data)) formErrors.value.detail = data
            if (data?.detail) formErrors.value.detail = [data?.detail]
          }

          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered errors in adding stock']
          }

          return Promise.reject(error)
        })
        .finally(() => {
          formData.value.loading = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      marketplaceStore,
      formData,
      variantOpts,
      filterVariantOpts,
      formErrors,
      createStock,
    }
  },
})
</script>
