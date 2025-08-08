<template>
  <q-form @submit="save">
    <div class="text-subtitle1 q-px-sm">{{ $t('AcceptedTokens') }}</div>
    <q-input
      dense
      outlined
      v-model="formData.searchVal"
      :placeholder="$t('FungibleTokenFilterPlaceholder')"
      bottom-slots
      class="q-mx-sm"
    />
    <q-list style="max-height:50vh; overflow-y:auto;">
      <TransitionGroup tag="ul" name="fade" class="container">
        <q-item
          v-for="fungibleCashtoken in filteredFungibleCt"
          :key="fungibleCashtoken.category"
          clickable
          :disable="loading"
          @click="toggleAcceptedToken(fungibleCashtoken)"
        >
          <q-item-section side>
            <q-checkbox
              :modelValue="isSelected(fungibleCashtoken)"
              :disable="loading"
              @click="toggleAcceptedToken(fungibleCashtoken)"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ fungibleCashtoken?.name }}</q-item-label>
            <q-item-label caption>{{ fungibleCashtoken?.symbol }}</q-item-label>
          </q-item-section>
          <q-item-section v-if="fungibleCashtoken.imageUrl" avatar>
            <img
              height="35"
              :src="convertIpfsUrl(fungibleCashtoken.imageUrl)"
              :fallback-src="convertIpfsUrl(fungibleCashtoken.imageUrl, 1)"
              @error="onImgErrorIpfsSrc"
            />
          </q-item-section>
        </q-item>
        <q-item
          v-if="canAppendFungibleCtList"
          clickable
          :disable="fetchingFungibleTokens"
          @click="() => fetchFungibleTokens({ append: true })"
        >
          <q-item-section>
            <q-item-label class="text-center">
              Load more
              <q-spinner v-if="fetchingFungibleTokens"/>
            </q-item-label>
          </q-item-section>
        </q-item>
      </TransitionGroup>
    </q-list>

    <q-btn
      no-caps :label="$t('OK')"
      :loading="loading"
      color="brandblue"
      class="full-width q-mt-md"
      type="submit"
    />
  </q-form>
</template>
<script>
import { backend } from 'src/marketplace/backend';
import { FungibleCashToken } from 'src/marketplace/objects';
import { useMarketplaceStore } from 'src/stores/marketplace';
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { computed, defineComponent, onMounted, ref } from 'vue';

export default defineComponent({
  name: 'StorefrontPaymentSettingsForm',
  emits: [
    'saved',
  ],
  setup(props, { emit: $emit }) {
    const marketplaceStore = useMarketplaceStore();

    onMounted(async () => {
      fetchFungibleTokens();
      marketplaceStore.fetchAcceptedTokens().finally(() => resetFormData());
    })

    const loading = ref(false);
    const formData = ref({
      searchVal: '',
      acceptedTokens: [].map(FungibleCashToken.parse),
    })

    function isSelected(fungibleCashtoken=FungibleCashToken.parse()) {
      return Boolean(
        formData.value?.acceptedTokens?.find(_fungibleCashtoken => {
          return _fungibleCashtoken.category === fungibleCashtoken.category
        })
      )
    }

    function toggleAcceptedToken(fungibleCashtoken=FungibleCashToken.parse()) {
      const index = formData.value.acceptedTokens.findIndex(_fungibleCashtoken => {
        return _fungibleCashtoken.category === fungibleCashtoken.category
      })
      if (index >= 0) formData.value.acceptedTokens.splice(index, 1)
      else formData.value.acceptedTokens.push(fungibleCashtoken)
    }

    function resetFormData() {
      formData.value.acceptedTokens = [...marketplaceStore.acceptedTokens];
    }

    const filteredFungibleCt = computed(() => {
      const result = [
        ...formData.value.acceptedTokens,
        ...fungibleCashtokens.value,
        ...marketplaceStore.acceptedTokens,
      ]
        .filter((element, index, list) => {
          return index === list.findIndex(_element => _element.category === element.category)
        })
      if (!formData.value.searchVal) return result;
      const searchVal = formData.value.searchVal;
      return result.filter(token => {
        if (searchVal === token?.symbol) return true;
        if (searchVal === token?.category) return true;
        return token?.name?.indexOf(searchVal) >= 0;
      })
    })

    const fungibleCashtokens = ref([].map(FungibleCashToken.parse))
    const fungibleCashtokenPagination = ref({ offset: 0, limit: 0, count: 0 })
    const canAppendFungibleCtList = computed(() => {
      const { offset, limit, count } = fungibleCashtokenPagination.value;
      return offset+limit < count;
    })
    const fetchingFungibleTokens = ref(false)
    function fetchFungibleTokens(opts = { limit: 100, offset: 0, append: false }) {
      const params = {
        is_active: true,
        limit: opts?.limit || 100,
        offset: opts?.offset || undefined,
        ordering: 'name',
      }
      if (opts?.append) params.offset = fungibleCashtokens.value.length;
      fetchingFungibleTokens.value = true
      return backend.get(`cashtokens/fungible/`, { params })
        .finally(() => {
          fetchingFungibleTokens.value = false 
        })
        .then(response => {
          const data = response?.data;
          if (!Array.isArray(data?.results)) return Promise.reject({ response })
          const parsedResults = data?.results?.map(FungibleCashToken.parse);
          if (opts?.append) {
            fungibleCashtokens.value.push(...parsedResults)
            fungibleCashtokenPagination.value = {
              offset: data?.offset,
              limit: fungibleCashtokens.value.length,
              count: data?.count,
            }
          } else {
            fungibleCashtokens.value = parsedResults;
            fungibleCashtokenPagination.value = {
              offset: data?.offset,
              limit: data?.limit,
              count: data?.count,
            }
          }
          return response
        })
    }

    function save() {
      const storefrontId = marketplaceStore.storefrontData?.id || null;
      const data = {
        accepted_token_categories: formData.value.acceptedTokens
          .map(fungibleCashtoken => fungibleCashtoken.category)
          .filter((element, index, list) => list.indexOf(element) === index)
      }

      loading.value = true
      return backend.patch(`connecta/storefronts/${storefrontId}/accepted_tokens/`, data)
        .finally(() => {
          loading.value = false
        })
        .then(response => {
          const data = response?.data
          $emit('saved', data)
          return response
        })
    }

    return {
      loading,
      formData,
      isSelected,
      toggleAcceptedToken,
      filteredFungibleCt,
      fungibleCashtokens,
      canAppendFungibleCtList,
      fetchingFungibleTokens,
      fetchFungibleTokens,
      save,

      convertIpfsUrl,
      onImgErrorIpfsSrc,
    }
  }
})
</script>
<style scoped>
.container {
  position: relative;
  padding: 0;
  list-style-type: none;
}

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
  transform: scaleY(0.01) translate(30px, 0);
}

/* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
.fade-leave-active {
  position: absolute;
}
</style>
