<template>
  <q-select
    v-model="selectedAsset"
    :options=assetOptions
    option-value="id"
    :option-label="resolveAssetSymbol"
    borderless
  >
    <template v-slot:option="ctx">
      <q-item
        :active="ctx?.selected"
        clickable
        @click="() => ctx.toggleOption(ctx.opt)"
      >
        <q-item-section
          v-if="ctx?.opt?.imageUrl || ctx?.opt?.id === 'bch' || ctx?.opt?.id?.startsWith('ct/')"
          avatar
        >
          <img
            v-if="ctx?.opt?.imageUrl"
            height="30"
            :src="convertIpfsUrl(ctx?.opt?.imageUrl)"
            :fallback-src="convertIpfsUrl(ctx?.opt?.imageUrl, 1)"
            @error="onImgErrorIpfsSrc"
          />
          <img
            v-else-if="ctx?.opt?.id === 'bch'"
              src="/bch-logo.png"
            height="30"
          />
          <img
            v-else-if="ctx?.opt?.id?.startsWith('ct/')"
            height="30"
            :src="convertIpfsUrl(ctx?.opt?.iconUrl)"
            :fallback-src="convertIpfsUrl(ctx?.opt?.iconUrl, 1)"
            @error="onImgErrorIpfsSrc"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ ctx.label }}</q-item-label>
          <q-item-label v-if="ctx.opt?.name" caption>{{ ctx?.opt?.name }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template v-slot:selected-item="ctx">
      <div class="flex row items-center no-wrap q-gutter-x-xs">
        <img
          v-if="ctx.opt?.imageUrl"
          height="24"
          :src="convertIpfsUrl(ctx.opt?.imageUrl)"
          :fallback-src="convertIpfsUrl(ctx.opt?.imageUrl, 1)"
          @error="onImgErrorIpfsSrc"
        />
        <img
          v-else-if="ctx.opt?.id === 'bch'"
          src="/bch-logo.png"
          height="24"
        />
        <img
          v-else-if="ctx.opt?.id?.startsWith('ct/')"
          height="24"
          :src="convertIpfsUrl(ctx.opt?.iconUrl)"
          :fallback-src="convertIpfsUrl(ctx.opt?.iconUrl, 1)"
          @error="onImgErrorIpfsSrc"
        />
        <span class="q-ml-xs">{{ resolveAssetSymbol(ctx.opt) }}</span>
      </div>
    </template>
  </q-select>
</template>
<script>
import { convertIpfsUrl, onImgErrorIpfsSrc } from "src/utils/ipfs";
import { bchAsset, parseAsset, resolveAssetSymbol } from "src/utils/assets.js";
import { useCashtokenStore } from 'src/stores/cashtoken'
import { useSettingsStore } from 'src/stores/settings'
import { useWalletStore } from 'src/stores/wallet'
import { defineComponent, computed, onMounted } from 'vue';

export default defineComponent({
  name: 'DefaultAssetSelector',
  setup() {
    const cashtokenStore = useCashtokenStore();
    const walletStore = useWalletStore();
    const settingsStore = useSettingsStore();

    const selectedAsset = computed({
      get() {
        return assetOptions.value.find(asset => asset.id === settingsStore.defaultAssetSelected)
      },
      set(value) {
        settingsStore.defaultAssetSelected = value.id
      }
    })
    const assetOptions = computed(() => {
      const acceptedTokensData = walletStore.acceptedTokensData?.accepted_tokens;
      const musdTokenCategory = "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366";
      let tokenCategories = [
        "2469acc5afa4b10cb5b5c04afb89c3a3ffd61c5da9c01e26d00951cae2a02544", // pusd
        "b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366", // musd
      ]

      if (Array.isArray(acceptedTokensData)) {
        tokenCategories.push(...acceptedTokensData.map((tokenData) => tokenData?.category));
      }
      tokenCategories = tokenCategories.filter((category, index, list) => list.indexOf(category) === index);

      const parsedAssets = tokenCategories.map(parseAsset);
      return [bchAsset, ...parsedAssets];
    })

    function fetchMissingCashtokenDataFromOptions() {
      for (const asset of assetOptions.value) {
        if (!asset?.id?.startsWith?.("ct/") || asset?.valid !== false) continue;

        const category = asset.id.replace("ct/", "");
        cashtokenStore.fetchTokenMetadata(category);
      }
    }

    onMounted(async () => {
      try {
        await walletStore.fetchAcceptedTokens()
      } finally {
        fetchMissingCashtokenDataFromOptions()
      }
    })

    return {
      settingsStore,
      selectedAsset,
      assetOptions,
      convertIpfsUrl,
      onImgErrorIpfsSrc,
      resolveAssetSymbol,
    }
  }
})
</script>