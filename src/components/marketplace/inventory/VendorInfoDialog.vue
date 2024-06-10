<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card>
      <q-card-section>
        <div class="text-h6">
          {{ title }}
        </div>
        <div class="row">
          <div class="col-12 col-sm-6 q-pa-xs">
            <div class="text-body1">
              {{ vendor?.name }}
            </div>
            <div class="text-caption bottom">{{ $t('Name') }}</div>
          </div>
          <div class="col-12 col-sm-6 q-pa-xs">
            <div class="text-body1">
              <template v-if="vendor?.phoneNumber">
                {{ vendor?.phoneNumber }}
              </template>
              <span v-else class="text-grey">{{ $t('None') }}</span>
            </div>
            <div class="text-caption bottom">{{ $t('PhoneNumber') }}</div>
          </div>
          <div class="col-12 q-pa-xs">
            <div class="text-body1">
              <template v-if="vendor?.location?.formatted">
                {{ vendor?.location?.formatted }}
              </template>
              <span v-else class="text-grey">{{ $t('None') }}</span>
            </div>
            <div class="text-caption bottom">{{ $t('Address') }}</div>
          </div>
        </div>
        <slot name="bottom"></slot>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { Vendor } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import { useMarketplaceStore } from 'src/stores/marketplace'

export default defineComponent({
  name: 'VendorInfoDialog',
  emits: [
    'update:model-value',
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    title: { type: String, default: 'Supplier' },
    modelValue: Boolean,
    vendor: Vendor,
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const marketplaceStore = useMarketplaceStore()
    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:model-value', innerVal.value))

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      marketplaceStore,
      innerVal,
    }
  }
})
</script>
