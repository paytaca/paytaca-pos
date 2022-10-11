<template>
  <q-header class="main-header text-brandblue">
    <q-toolbar class="q-mt-md">
      <div style="position:relative;">
        <q-btn
          flat
          round
          size="1.5rem"
          padding="xs"
          icon="arrow_back"
          aria-label="Back"
          style="position:absolute;transform:translateY(-50%)"
          @click="$router.go(-1)"
        />
      </div>
      <q-toolbar-title class="text-center text-h4">
        {{ $route.meta?.title ||  title || '' }}
      </q-toolbar-title>
    </q-toolbar>
  </q-header>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MainHeader',
  props: {
    title: String,
  },
  setup() {
    
  },
})
</script>
<style scoped>
.main-header {
  background-color: rgba(0,0,0,0);
}
</style>