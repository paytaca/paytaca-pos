<template>
  <q-page class="q-pb-lg">
    <MainHeader>
      <template #title>
        <q-toolbar-title class="q-ml-md q-pl-xl text-h5">
          Receive Payment
        </q-toolbar-title>
      </template>
    </MainHeader>
    <div class="q-mt-lg q-px-lg">
      <div class="text-subtitle1 q-mb-md">Select payment terminal</div>
      <q-card>
        <q-item
          class="select-item"
          clickable v-ripple
          :to="{ name: 'receive-page', query: { paymentFrom: 'paytaca'} }"
        >
          <q-item-section avatar>
            <img src="~assets/paytaca_logo.png" height="50"/>
          </q-item-section>
          <q-item-section top class="q-py-sm">
            <q-item-label class="text-subtitle1">Paytaca</q-item-label>
            <q-item-label caption>Receive payments from paytaca app</q-item-label>
          </q-item-section>
        </q-item>
      </q-card>
      <q-card>
        <q-item
          class="select-item"
          :clickable="isOnline"
          :v-ripple="isOnline"
          :disable="!isOnline"
          :to="{ name: 'receive-page', query: { paymentFrom: 'other'} }"
        >
          <q-item-section avatar>
            <img src="~assets/bch-logo.png" height="50"/>
          </q-item-section>
          <q-item-section top class="q-py-sm">
            <q-item-label class="text-subtitle1">Other</q-item-label>
            <q-item-label caption>Receive payments from other wallets</q-item-label>
          </q-item-section>
        </q-item>
      </q-card>
    </div>
    <MainFooter/>
  </q-page>
</template>
<script>
import MainFooter from 'src/components/MainFooter.vue'
import MainHeader from 'src/components/MainHeader.vue'
import { defineComponent, inject } from 'vue'

export default defineComponent({
  components: {
    MainHeader,
    MainFooter,
  },
  setup() {
    const isOnline = inject('$isOnline')
    return {
      isOnline,
    }
  },
})
</script>
<style scoped>
.select-item {
  /* border: 2px solid grey; */
  border-radius: 8px;
  margin-bottom: 16px;
}
</style>