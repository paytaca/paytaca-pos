<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="() => $router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">
            <template v-if="marketplaceStore?.storefrontData?.id">
              Storefront settings
            </template>
            <template v-else>
              Storefront Setup
            </template>
          </div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-tabs v-model="tab">
      <q-tab v-for="(tabOpt, index) in tabs" :key="index" v-bind="tabOpt"/>
    </q-tabs>
    <q-tab-panels v-model="tab" animated style="background:inherit;">
      <q-tab-panel name="info" class="q-px-none">
        <StorefrontInfoForm @saved="() => onStorefrontInfoSaved()"/>
      </q-tab-panel>
      <q-tab-panel name="hours" class="q-px-none">
        <StorefrontHoursForm/>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>
<script>
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { defineComponent, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import StorefrontInfoForm from 'src/components/marketplace/storefront/settings/StorefrontInfoForm.vue'
import StorefrontHoursForm from 'src/components/marketplace/storefront/settings/StorefrontHoursForm.vue'

export default defineComponent({
  name: 'SetupStorefronPage.vue',
  components: {
    MarketplaceHeader,
    StorefrontInfoForm,
    StorefrontHoursForm,
  },
  props: {
    tabParam: String,
  },
  setup(props) {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    const tab = ref(props.tabParam || 'info')
    const tabs = ref([
      { label: 'Info', name: 'info', disable: false, },
      { label: 'Hours', name: 'hours', disable: !Boolean(marketplaceStore?.storefrontData?.id), },
    ])

    watch(tab, () => $router.replace({ params: { tabParam: tab.value } }))
    watch(()=> [props.tabParam], () => {
      if (!props.tabParam) return
      tab.value = props.tabParam
    })

    function onStorefrontInfoSaved() {
      $q.dialog({
        title: marketplaceStore?.storefrontData?.id ? 'Storefront updated' : 'Storefront created',
        ok: { color: 'brandblue' },
      }).onDismiss(() => $router.go(-1))
    }

    return {
      marketplaceStore,
      tab,
      tabs,

      onStorefrontInfoSaved,
    }
  },
})
</script>
