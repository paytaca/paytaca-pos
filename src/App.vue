<template>
  <router-view />
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'App',
  created() {
    const theme = localStorage.getItem('app_theme')
    let darkMode = 'auto'
    switch(theme) {
      case 'true':
        darkMode = true
        break
      case 'false':
        darkMode = false
        break
      default:
        darkMode = 'auto'
    }
    this.$q.dark.set(darkMode)
  },
  watch: {
    '$q.dark.isActive': function () {
      localStorage.setItem('app_theme', this.$q.dark.isActive)
    }
  }
})
</script>
