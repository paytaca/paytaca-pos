<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Create Collection</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form @submit="() => createCollection()">
          <div>Name</div>
          <q-input
            dense
            outlined
            :disable="loading"
            v-model="formData.name"
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <div class="q-mb-md">
            <div class="text-subtitle1">Collection type</div>
            <q-radio
              :disable="loading"
              v-model="formData.auto"
              :val="true"
            >
              <div>Automated</div>
              <div class="text-caption">Products are added by some condition/s</div>
            </q-radio>
            <q-radio
              :disable="loading"
              v-model="formData.auto"
              :val="false"
            >
              <div>Manual</div>
              <div class="text-caption">Manually select products</div>
            </q-radio>
          </div>

          <q-slide-transition>
            <div v-if="formData.auto" class="q-mb-md">
              <div class="row items-start">
                <div class="text-subtitle1 q-space">Conditions</div>
                <q-btn
                  flat
                  padding="xs"
                  no-caps
                  label="Add another condition"
                  icon="add"
                  @click="() => addConditionRow()"
                />  
              </div>
              <div>
                Must match: 
                <q-radio
                  label="any condition"
                  v-model="formData.conditionsOperand"
                  val="any"
                />
                <q-radio
                  label="all conditions"
                  v-model="formData.conditionsOperand"
                  val="all"
                />
              </div>
              <div style="max-height:35vh;overflow:auto;">
                <TransitionGroup name="fade">
                  <div
                    v-for="(condition, index) in formData.conditions" :key="condition._index"
                    class="row items-start no-wrap"
                  >
                    <div class="row items-start q-space">
                      <div class="col-12 q-mx-xs text-caption top text-grey">
                        Condition {{ index+1 }}
                      </div>
                      <q-select
                        dense
                        outlined
                        :disable="loading"
                        v-model="condition.field"
                        emit-value
                        map-options
                        :options="CollectionCondition.fieldOpts"
                        class="q-space q-ma-xs"
                        style="min-width:10em;"
                      />
                      <q-select
                        dense
                        outlined
                        :disable="loading"
                        v-model="condition.expression"
                        emit-value
                        map-options
                        :options="CollectionCondition.getFieldExpressions(condition.field)"
                        class="q-space q-ma-xs"
                        style="min-width:10em;"
                      />
                      <q-select
                        v-if="condition.field === CollectionCondition.fields.categories"
                        dense
                        outlined
                        :disable="loading"
                        multiple
                        use-chips
                        use-input
                        new-value-mode="add-unique"
                        behavior="menu"
                        :options="categoriesOpts"
                        v-model="condition.value"
                        bottom-slots
                        @new-value="(inputValue, done) => done(inputValue)"
                        @filter="categoriesFilter"
                        class="q-space q-ma-xs"
                      >
                        <template v-slot:before-options="props">
                          {{ props }}
                        </template>
                      </q-select>
                      <q-input
                        v-else-if="condition.field === CollectionCondition.fields.price"
                        dense
                        outlined
                        :disable="loading"
                        type="number"
                        v-model.number="condition.value"
                        :suffix="marketplaceStore?.currency"
                        bottom-slots
                        class="q-space q-ma-xs"
                      />
                      <q-input
                        v-else-if="condition.field === CollectionCondition.fields.created"
                        dense
                        outlined
                        :disable="loading"
                        placeholder="YYYY-MM-DD"
                        mask="####-##-##"
                        v-model="condition.value"
                        bottom-slots
                        class="q-space q-ma-xs"
                      >
                        <template v-slot:append>
                          <q-icon name="calendar_today">
                            <q-popup-proxy breakpoint="0">
                              <q-date v-model="condition.value" mask="YYYY-MM-DD">
                                <div class="row items-center justify-end">
                                  <q-btn v-close-popup label="Close" color="brandblue" flat />
                                </div>
                              </q-date>
                            </q-popup-proxy>
                          </q-icon>
                        </template>
                      </q-input>
                      <q-input
                        v-else
                        dense
                        outlined
                        :disable="loading"
                        v-model="condition.value"
                        bottom-slots
                        class="q-space q-ma-xs"
                      />
                    </div>
                    <q-btn
                      flat
                      icon="close"
                      padding="sm"
                      color="red"
                      class="q-mt-xs"
                      @click="() => formData.conditions = formData.conditions.filter(_condition => _condition !== condition)"
                    />
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </q-slide-transition>
          <!-- <q-slide-transition>
            <div v-if="formData.auto" class="q-mb-md">
              <div class="text-subtitle1">Conditions</div>
              <div>Categories</div>
              <q-select
                dense
                outlined
                :disable="loading"
                multiple
                use-chips
                use-input
                new-value-mode="add-unique"
                behavior="menu"
                :options="categoriesOpts"
                v-model="formData.categories"
                bottom-slots
                @new-value="(inputValue, done) => done(inputValue)"
                @filter="categoriesFilter"
              >
                <template v-slot:before-options="props">
                  {{ props }}
                </template>
              </q-select>

              <div class="row no-wrap q-gutter-xs">
                <div class="q-space">
                  <div>Price greater than</div>
                  <q-input
                    dense
                    outlined
                    :disable="loading"
                    :suffix="marketplaceStore.currency"
                    type="number"
                    v-model.number="formData.priceGreaterThan"
                    bottom-slots
                  />
                </div>
                <div class="q-space">
                  <div>Price less than</div>
                  <q-input
                    dense
                    outlined
                    :disable="loading"
                    :suffix="marketplaceStore.currency"
                    type="number"
                    v-model.number="formData.priceLessThan"
                    bottom-slots
                  />
                </div>
              </div>
            </div>
          </q-slide-transition> -->
          <q-slide-transition>
            <div v-if="!formData.auto" class="q-mb-md">
              <div class="text-subtitle1">Products</div>
              <ProductSearchPanel v-model="formData.products" :disable="loading">
                <template v-slot:option="props">
                  <q-item clickable @click="() => props.toggleProduct(props.product)" class="q-px-none">
                    <q-item-section side>
                      <q-checkbox
                        :disable="loading"
                        :model-value="props.productIdExists(props.product?.id)"
                        @click="() => props.toggleProduct(props.product)"
                      />
                    </q-item-section>
                    <q-item-section v-if="props.product?.displayImageUrl" avatar class="q-pr-xs">
                      <img
                        :src="props.product?.displayImageUrl"
                        width="50"
                        class="rounded-borders"
                      />
                    </q-item-section>
                    <q-item-section top>
                      <q-item-label>{{ props.product?.name }}</q-item-label>
                      <q-item-label class="text-caption">#{{ props.product?.id }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </ProductSearchPanel>
            </div>
          </q-slide-transition>

          <q-btn
            no-caps
            :disable="loading"
            :loading="loading"
            label="Create Collection"
            type="submit"
            color="brandblue"
            class="full-width"
          />
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { CollectionCondition, Product } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { defineComponent, onMounted, ref, watch } from 'vue'
import ProductSearchPanel from '../ProductSearchPanel.vue'

export default defineComponent({
  name: 'CollectionCreateFormDialog',
  components: {
    ProductSearchPanel,
  },
  props: {
    modelValue: Boolean,
  },
  emits: [
    'update:modelValue',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    let conditionRowCtr = 0
    function addConditionRow(opts = {setDefaults: false }) {
      const field = opts?.setDefaults ? CollectionCondition.fieldOpts?.[0]?.value : ''
      const data = {
        _index: conditionRowCtr++,
        field: field || '',
        expression: CollectionCondition.getFieldExpressions(field)?.[0]?.value || '',
        value: null,
      }

      formData.value.conditions.push(data)
      return data
    }

    onMounted(() => addConditionRow({ setDefaults: true }))
    const loading = ref(false)
    const formData = ref({
      name: '',
      auto: true,

      conditionsOperand: 'all',
      conditions: [].map(addConditionRow),

      products: [].map(Product.parse),
    })

    const categoriesOpts = ref([].map(String))
    function categoriesFilter(val, done) {
      const params = {
        s: val,
        storefront_id: Number(marketplaceStore.storefrontData.id),
        limit: 5,
      }

      backend.get(`product-categories/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          done(() => {
            categoriesOpts.value = response?.data?.results.map(category => category?.name).filter(Boolean)
          })
          return response
        })
        .catch(() => {
          done(() => {
            categoriesOpts.value = []
          })
        })
    }

    function createCollection() {
      const data = {
        storefront_id: marketplaceStore.storefrontData.id,
        name: formData.value.name,
        auto: formData.value.auto,
        conditions_operand: undefined,
        product_ids: undefined,
        conditions: undefined,
      }

      if (data?.auto) {
        data.conditions_operand = formData.value.conditionsOperand 
        data.conditions = formData.value.conditions.map(condition => {
          return {
            field: condition?.field,
            expression: condition?.expression,
            value: { value: condition?.value },
          }
        })
      } else {
        data.product_ids = formData.value.products.map(product => product?.id)
      }

      loading.value = true
      return backend.post(`connecta/collections/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          onDialogOK(response?.data)
          return response
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      CollectionCondition,
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      marketplaceStore,
      innerVal,
      addConditionRow,
      loading,
      formData,

      categoriesOpts,
      categoriesFilter,

      createCollection,
    }
  },
})
</script>
<style scoped>
/* 1. declare transition */
.fade-move,
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}

/* 2. declare enter from and leave to state */
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(30px, 0);
}

/* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
/* .fade-leave-active {
  position: absolute;
} */
</style>
