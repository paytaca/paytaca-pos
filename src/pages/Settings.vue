<template>
  <q-page>
    <MainHeader title="Settings"/>
  </q-page>
</template>

<script>
import { defineComponent } from 'vue'
import MainHeader from 'src/components/MainHeader.vue'

export default defineComponent({
    name: "SettingsPage",
    components: {
      MainHeader
    }
})
</script>
