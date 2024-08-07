<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide">
    <q-card style="width: min(500px, 90vw);">
      <q-card-section>
        <div class="row items-center no-wrap">
          <div class="text-h6">Order Dispute</div>
          <q-space/>
          <q-btn v-close-popup flat icon="close" class="q-r-mr-sm"/>
        </div>
        <div v-if="innerReadonly" class="text-subtitle1">{{ $t('Issues')}}</div>
        <div v-else class="text-subtitle1">{{ $t('ListReasons', {}, 'List reasons') }}</div>
        <TransitionGroup name="slide-group" tag="div" style="overflow:hidden;">
          <div
            v-for="(reason, index) in formData.reasons" :key="reason"
            class="row items-start no-wrap q-mb-sm q-pl-sm"
          >
            <div class="q-space q-py-xs">
              {{ index+1 }}. {{ reason }}
            </div>
            <q-btn
              v-if="!innerReadonly"
              flat
              color="red"
              icon="close"
              padding="none xs"
              @click="() => formData.reasons = formData.reasons.filter(element => element != reason)"
            />
          </div>
        </TransitionGroup>
        <q-slide-transition>
          <div v-if="!innerReadonly">
            <q-select
              dense
              model-value=""
              use-input
              hide-dropdown-icon
              :options="filteredReasonOptions"
              behavior="menu"
              :placeholder="$t('Issue')"
              bottom-slots
              @new-value="(inputValue, done) => done(inputValue, 'add-unique')"
              @update:model-value="val => appendReason(val)"
              @filter="(needle, update) => update(() => updateReasonOptions(needle))"
            />
            <q-btn
              no-caps
              :label="orderDispute?.id ? 'Update dispute': 'Dispute'"
              class="button full-width"
              @click="() => submit()"
            />
          </div>
        </q-slide-transition>
        <template v-if="innerReadonly && editable && !orderDispute?.resolvedAt">
          <q-btn
            outline
            no-caps
            :label="$t('Edit')"
            color="brandblue"
            class="full-width"
            @click="() => innerReadonly = false"
          />
        </template>
        <q-banner
          v-if="innerReadonly && orderDispute?.resolvedAt"
          rounded dense
          class="text-white bg-green q-r-mx-sm"
        >
          <div class="row items-center justify-between">
            <q-icon name="check_circle" :size="resolveActionText ? '2.5em' : '1.2em'"/>
            <div>
              {{ $t('Resolved') }}
              <div v-if="resolveActionText" class="text-caption bottom text-grey-4">
                {{ resolveActionText }}
              </div>
            </div>
            <q-space/>
            <div>{{ formatDateRelative(orderDispute?.resolvedAt) }}</div>
          </div>
        </q-banner>
        <q-expansion-item
          v-if="innerReadonly && !orderDispute?.resolvedAt"
          no-caps :label="$t('Resolve')"
          header-class="bg-brandblue text-white text-weight-medium"
          header-style="border-radius:4px;"
        >
          <q-btn
            no-caps :label="$t('CompleteOrder', {}, 'Complete order')"
            color="green"
            class="full-width q-mt-sm"
            @click="() => resolve(OrderDispute.resolveActions.completeOrder)"
          />
          <q-btn
            no-caps :label="$t('CancelOrder', {}, 'Cancel order')"
            color="red"
            class="full-width q-mt-sm"
            @click="() => resolve(OrderDispute.resolveActions.cancelOrder)"
          />
        </q-expansion-item>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script setup>
import { OrderDispute } from 'src/marketplace/objects';
import { formatDateRelative } from 'src/marketplace/utils';
import { useDialogPluginComponent } from 'quasar'
import { computed, onMounted, ref, watch } from 'vue';


const $emit = defineEmits([
  'update:modelValue',
  'update:readonly',
  ...useDialogPluginComponent.emits,
])

const props = defineProps({
  modelValue: Boolean,
  readonly: Boolean, 
  editable: Boolean,
  orderDispute: [Object, OrderDispute],
})

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const innerVal = ref(props.modelValue)
watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
watch(innerVal, () => $emit('update:modelValue', innerVal.value))

const innerReadonly = ref(props.readonly)
watch(() => [props.modelValue], () => innerReadonly.value = props.readonly)
watch(innerReadonly, () => $emit('update:readonly', innerReadonly.value))

const resolveActionText = computed(() => {
  const resolveAction = props.orderDispute?.resolveAction
  if (resolveAction == OrderDispute.resolveActions.cancelOrder) return $t('OrderCancelled', {}, 'Order cancelled')
  if (resolveAction == OrderDispute.resolveActions.completeOrder) return $t('OrderCompleted', {}, 'Order completed')
  return ''
})

const reasonOptions = [
  $t('DefectiveOrDamagedGoods', {}, 'Defective or Damaged Goods'),
  $t('NonDeliveryOrLateDelivery', {}, 'Non-Delivery or Late Delivery'),
  $t('InaccurateProductDescriptions', {}, 'Inaccurate Product Descriptions'),
]

const filteredReasonOptions = ref([...reasonOptions])
function updateReasonOptions(needle) {
  if (needle) {
    const parsedNeedle = String(needle)?.toLocaleLowerCase()
    filteredReasonOptions.value = reasonOptions.filter(opt => opt?.toLocaleLowerCase()?.includes(parsedNeedle))
  } else {
    filteredReasonOptions.value = reasonOptions
  }
  filteredReasonOptions.value = filteredReasonOptions.value.filter(opt => !formData.value.reasons?.includes(opt))
}

const formData = ref({
  reasons: [],
})
onMounted(() => resetFormData())
function resetFormData() {
  formData.value.reasons = Array.isArray(props.orderDispute?.reasons) ? [...props.orderDispute?.reasons] : []
}

function appendReason(val) {
  if (!val) return
  if (!formData.value.reasons.includes(val)) {
    formData.value.reasons.push(val)   
  }
}

function submit() {
  onDialogOK({
    action: 'submit',
    data: { reasons: [...formData.value.reasons] },
  })
}

function resolve(resolveAction) {
  onDialogOK({
    action: 'resolve',
    data: { resolveAction },
  })
}
</script>
<style scoped>
.slide-group-enter-active,
.slide-group-enter-active {
  transition: all 0.5s ease-out;
}
.slide-group-enter-from {
  opacity: 0;
}
.slide-group-leave-to {
  opacity: 0;
}
</style>
