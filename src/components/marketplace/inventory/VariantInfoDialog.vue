<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" full-width>
    <q-card>
      <q-card-section>
        <div class="text-h6">
          {{ title }}
        </div>
        <div class="row">
          <div class="col-12 col-sm-8 q-mb-sm row items-center justify-center">
            <img
              v-if="variant?.imageUrl || variant?.product?.imageUrl"
              :src="variant?.imageUrl || variant?.product?.imageUrl"
              style="max-height:200px;max-width:max(80vw,300px);"
              class="rounded-borders"
            />
          </div>
          <div class="col-12 col-sm-4 q-pa-sm">
            <div>
              <div class="text-body1">
                {{ variant?.product?.name }}
                <template v-if="variant?.name">- {{ variant?.name }}</template>
              </div>
              <div class="text-caption bottom">{{ $t('Product') }}</div>
            </div>

            <div v-if="variant?.code">
              <div class="text-body1">{{ variant?.code }}</div>
              <div class="text-caption bottom">{{ $t('Code') }}</div>
            </div>
            <div>
              <div class="text-body1">{{ variant?.price }} {{ marketplaceStore?.currency }}</div>
              <div class="text-caption bottom">{{ $t('Price') }}</div>
            </div>
            <div v-if="variant?.markupPrice">
              <div class="text-body1">{{ variant?.markupPrice }} {{ marketplaceStore?.currency }}</div>
              <div class="text-caption bottom">{{ $t('MarkupPrice') }}</div>
            </div>
            <div>
              <div class="text-body1">
                <template v-if="variant?.totalStocks">{{ variant?.totalStocks }}</template>
                <span v-else class="text-grey text-body2">{{ $t('NoInventory') }}</span>
              </div>
              <div class="text-caption bottom">{{ $t('InStock') }}</div>
            </div>
          </div>
        </div>
        <slot name="bottom" v-bind="{ variant }"></slot>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { Variant } from 'src/marketplace/objects'
import { useDialogPluginComponent } from 'quasar'
import { defineComponent, ref, watch } from 'vue'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export default defineComponent({
  name: 'VariantInfoDialog',
  emits: [
    'update:model-value',
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  props: {
    title: { type: String, default: t('ProductVariant') },
    modelValue: Boolean,
    variant: Variant
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
