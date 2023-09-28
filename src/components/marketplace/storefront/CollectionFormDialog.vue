<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Create Collection</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <q-form @submit="() => createCollection()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>
          <UploadImageField v-model="formData.imageUrl" :loading="loading" :disable="loading"/>
          <div>Name</div>
          <q-input
            dense
            outlined
            :disable="loading"
            v-model="formData.name"
            :error="Boolean(formErrors?.name)"
            :error-message="formErrors?.name"
            :rules="[
              val => Boolean(val) || 'Required',
            ]"
          />
          <div class="q-mb-md">
            <div class="text-subtitle1">Collection type</div>
            <div v-if="formErrors?.auto" class="bg-red text-white text-body2 rounded-borders q-pa-sm">
              {{ formErrors?.auto }}
            </div>
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
              <div class="row items-start">
                <div class="q-my-sm">
                  Must match:
                </div>
                <div>
                  <q-radio
                    label="any condition"
                    v-model="formData.conditionsOperand"
                    val="any"
                    :color="formErrors?.conditionsOperand ? 'red' : undefined"
                    keep-color
                  />
                  <q-radio
                    label="all conditions"
                    v-model="formData.conditionsOperand"
                    val="all"
                    :color="formErrors?.conditionsOperand ? 'red' : undefined"
                    keep-color
                  />
                  <div v-if="formErrors?.conditionsOperand" class="text-red text-caption bottom">
                    {{ formErrors?.conditionsOperand }}
                  </div>
                </div>
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
                      <div
                        v-if="formErrors?.conditions?.[index]?.detail?.length"
                        class="col-12 bg-red text-white text-body2 rounded-borders q-pa-sm q-my-xs"
                      >
                      <div v-if="formErrors?.conditions?.[index]?.detail?.length === 1">
                        {{ formErrors?.conditions?.[index]?.detail[0] }}
                      </div>
                      <ul v-else class="q-pl-md q-my-xs">
                        <li v-for="(err, index) in formErrors?.conditions?.[index]?.detail" :key="index">{{err}}</li>
                      </ul>
                      </div>
                      <q-select
                        dense
                        outlined
                        :disable="loading"
                        v-model="condition.field"
                        emit-value
                        map-options
                        :options="CollectionCondition.fieldOpts"
                        hide-bottom-space
                        :error="Boolean(formErrors?.conditions?.[index]?.field)"
                        :error-message="formErrors?.conditions?.[index]?.field"
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
                        hide-bottom-space
                        :error="Boolean(formErrors?.conditions?.[index]?.expression)"
                        :error-message="formErrors?.conditions?.[index]?.expression"
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
                        :error="Boolean(formErrors?.conditions?.[index]?.value)"
                        :error-message="formErrors?.conditions?.[index]?.value"
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
                        :error="Boolean(formErrors?.conditions?.[index]?.value)"
                        :error-message="formErrors?.conditions?.[index]?.value"
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
                        :error="Boolean(formErrors?.conditions?.[index]?.value)"
                        :error-message="formErrors?.conditions?.[index]?.value"
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
                        :error="Boolean(formErrors?.conditions?.[index]?.value)"
                        :error-message="formErrors?.conditions?.[index]?.value"
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
            :label="collection?.id ? 'Update Collection' : 'Create Collection'"
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
import { Collection, CollectionCondition, Product } from 'src/marketplace/objects'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { defineComponent, onMounted, ref, watch } from 'vue'
import ProductSearchPanel from '../ProductSearchPanel.vue'
import UploadImageField from '../UploadImageField.vue'

export default defineComponent({
  name: 'CollectionFormDialog',
  components: {
    ProductSearchPanel,
    UploadImageField,
  },
  props: {
    modelValue: Boolean,
    collection: Collection,
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
    function createConditionRow(opts = {setDefaults: false }) {
      const field = opts?.setDefaults ? CollectionCondition.fieldOpts?.[0]?.value : ''
      const data = {
        _index: conditionRowCtr++,
        field: field || '',
        expression: CollectionCondition.getFieldExpressions(field)?.[0]?.value || '',
        value: null,
      }

      return data
    }
    function addConditionRow(opts ={setDefaults: false}) {
      const data = createConditionRow(opts)
      formData.value.conditions.push(data)
    }

    onMounted(() => addConditionRow({ setDefaults: true }))
    const loading = ref(false)
    const formData = ref({
      imageUrl: null,
      name: '',
      auto: true,

      conditionsOperand: 'all',
      conditions: [].map(addConditionRow),

      products: [].map(Product.parse),
    })

    onMounted(() => syncCollection())
    watch(() => [props?.collection?.id], () => syncCollection())
    async function syncCollection() {
      if (!props?.collection?.id) return
      try {
        loading.value = true
        formData.value.imageUrl = props.collection.imageUrl
        formData.value.name = props.collection.name
        formData.value.auto = props.collection.auto
        if (!props.collection.auto) await syncCollectionProducts()
        formData.value.conditionsOperand = props.collection.conditionsOperand
        formData.value.conditions = props.collection.conditions.map(condition => {
          const conditionData = createConditionRow()
          conditionData.field = condition.field
          conditionData.expression = condition.expression
          conditionData.value = condition.value
          return conditionData
        })
      } finally {
        loading.value = false
      }
    }

    async function syncCollectionProducts() {
      if (!props.collection?.id) return Promise.reject()
      const params = { collection_id: props.collection?.id }
      const response = await backend.get(`products/`, { params })
      if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
      formData.value.products = response?.data?.results.map(Product.parse)
    }

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

    const formErrors = ref({
      detail: [],
      imageUrl: '',
      name: '',
      auto: '',
      conditionsOperand: '',
      conditions: [0].map(() => {
        return {
          detail: [],
          field: '',
          expression: '',
          value: '',
        }
      })
    })

    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.name = ''
      formErrors.value.auto = ''
      formErrors.value.conditionsOperand = ''
      formErrors.value.conditions = []
    }

    function createCollection() {
      const data = {
        storefront_id: marketplaceStore.storefrontData.id,
        image_url: formData.value.imageUrl,
        name: formData.value.name,
        auto: formData.value.auto,
        conditions_operand: undefined,
        product_ids: [],
        conditions: [],
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
      const request = props.collection?.id
        ? backend.patch(`connecta/collections/${props.collection.id}/`, data)
        : backend.post(`connecta/collections/`, data)

      return request
        .finally(() => clearFormErrors())
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          if (props?.collection?.id == response?.data?.id) props.collection.updateData(response?.data)
          onDialogOK(response?.data)
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          if (!data) {
            formErrors.value.detail = ['Encountered errors in creating collection']
            return
          }

          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.imageUrl = errorParser.firstElementOrValue(data?.image_url)
          formErrors.value.name = errorParser.firstElementOrValue(data?.name)
          formErrors.value.auto = errorParser.firstElementOrValue(data?.auto)
          formErrors.value.conditionsOperand = errorParser.firstElementOrValue(data?.conditions_operand)
          if (Array.isArray(data?.conditions)) {
            data?.conditions.forEach((conditionError, index) => {
              formErrors.value.conditions[index] = {
                detail: errorParser.toArray(conditionError?.non_field_errors),
                field: errorParser.firstElementOrValue(conditionError?.field),
                expression: errorParser.firstElementOrValue(conditionError?.expression),
                value: errorParser.firstElementOrValue(conditionError?.value),
              } 
            })
          }

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]

          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered errors in creating collection']
          }
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

      formErrors,

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
