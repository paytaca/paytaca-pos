<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" no-refocus position="bottom">
    <q-card class="q-dialog-plugin">
      <q-form @submit="checkAmount()">
        <q-card-section>
          <div class="q-mb-md">
            <div class="text-h5">{{ $t('SetAmount') }}</div>
          </div>
          <div v-if="message" class="text-subtitle1 q-mb-sm">
            {{ message }}
          </div>
          <div class="row items-center no-wrap q-gutter-x-sm">
            <q-input
              :label="$t('Amount')"
              type="number"
              inputmode="decimal"
              :step="10 ** -(selectedCurrency?.decimals || 0)"
              v-model.number="amountValue"
              outlined
              autofocus
              clearable
              class="q-space"
            />
            <q-select
              outlined
              v-model="selectedCurrency"
              :options="filteredCurrencyOpts"
              :option-label="resolveAssetSymbol"
            >
              <template v-slot:option="ctx">
                <q-item :active="ctx?.selected" clickable @click="() => ctx.toggleOption(ctx.opt)">
                  <q-item-section>
                    <q-item-label>{{ ctx.label }}</q-item-label>
                    <q-item-label v-if="ctx.opt?.name" caption>{{ ctx?.opt?.name }}</q-item-label>
                    <q-item-label
                      v-if="ctx?.opt?.id?.startsWith?.('ct/') && ctx?.opt?.valid === false"
                      caption style="text-overflow: ellipsis; overflow:hidden;"
                    >
                      {{ ctx?.opt?.id }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section v-if="ctx?.opt?.imageUrl" avatar>
                    <img
                      height="35"
                      :src="convertIpfsUrl(ctx?.opt?.imageUrl)"
                      :fallback-src="convertIpfsUrl(ctx?.opt?.imageUrl, 1)"
                      @error="onImgErrorIpfsSrc"
                    />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
        </q-card-section>

        <q-card-actions class="row items-center justify-around q-gutter-x-md">
          <q-btn
            no-caps
            color="brandblue"
            size="1rem"
            padding="sm md"
            :label="$t('CreatePaymentQR')"
            class="q-space"
            type="submit"
            icon="mdi-qrcode"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
<script>
import { bchAsset, parseAsset, resolveAssetSymbol } from '../utils/assets.js'
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { useDialogPluginComponent } from 'quasar'
import { useCashtokenStore } from 'src/stores/cashtoken.js'

export default defineComponent({
  name: 'SetAmountFormDialog',
  props: {
    initialValue: Object,
    currencies: Array,
    title: String,
    message: String,
    hideInvalidOptions: Boolean,
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const cashtokenStore = useCashtokenStore();

    const amountValue = ref(props.initialValue?.amount || null);
    const selectedCurrency = ref(parseAsset(props.initialValue?.currency))
    const currencyOpts = computed(() => {
      const initialCurrency = parseAsset(props?.initialValue?.currency)
      let opts = [bchAsset]
      if (Array.isArray(props.currencies)) opts = [...props.currencies].map(parseAsset).filter(Boolean)
      if (!opts.find(asset => asset?.id === initialCurrency?.id)) {
        opts.unshift(initialCurrency)
      }
      return opts
    })
    const filteredCurrencyOpts = computed(() => {
      if (props.hideInvalidOptions) return currencyOpts.value.filter(asset => asset?.valid !== false)
      return currencyOpts.value
    })  

    onMounted(() => fetchMissingCashtokenDataFromOptions())
    watch(currencyOpts, () => fetchMissingCashtokenDataFromOptions())
    function fetchMissingCashtokenDataFromOptions() {
      for (const asset of currencyOpts.value) {
        if (!asset?.id?.startsWith?.('ct/') || asset?.valid !== false) continue

        const category = asset.id.replace('ct/', '');
        cashtokenStore.fetchTokenMetadata(category);
      }
    }

    function checkAmount () {
      const assetId = selectedCurrency.value?.id;

      let tokenCategory;
      if (assetId?.startsWith?.('ct/')) tokenCategory = assetId.replace('ct/', '');

      const data = {
        value: amountValue.value,
        currency: selectedCurrency.value?.symbol,
        assetId,
        tokenCategory,
      }
      onDialogOK({ amount: data })
    }

    return {
      dialogRef,
      checkAmount,
      onDialogHide,
      onDialogOK,
      onDialogCancel,
      amountValue,
      selectedCurrency,
      currencyOpts,
      filteredCurrencyOpts,

      resolveAssetSymbol,
      convertIpfsUrl,
      onImgErrorIpfsSrc,
    }
  },
})
</script>
