<template>
  <q-header class="main-header text-brandblue">
    <q-toolbar class="q-mt-md main-header-toolbar">
      <div style="position:relative;">
        <q-btn
          flat
          round
          size="1.5rem"
          padding="xs"
          icon="arrow_back"
          aria-label="Back"
          style="position:absolute;transform:translateY(-50%)"
          @click="handleBack"
        />
      </div>
      <slot name="title">
        <q-toolbar-title class="text-center text-h4">
          {{ route.meta?.title ||  title || '' }}
        </q-toolbar-title>
      </slot>
      <slot name="right-actions"></slot>
    </q-toolbar>
  </q-header>
</template>
<script>
import { defineComponent, ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export default defineComponent({
  name: 'MainHeader',
  props: {
    title: String,
    backTo: {
      type: String,
      default: null
    }
  },
  setup(props) {
    const router = useRouter()
    const route = useRoute()
    
    function handleBack(event) {
      if (event) {
        event.preventDefault()
        event.stopPropagation()
      }
      
      // Defer navigation to avoid recursive updates
      if (props.backTo) {
        // Don't navigate if we're already on the target route
        const currentRouteName = route.name
        if (currentRouteName === props.backTo) return
        
        setTimeout(() => {
          router.push({ name: props.backTo }).catch((err) => {
            // Silently handle navigation errors (e.g., already navigating)
            console.error('Navigation error:', err)
          })
        }, 0)
      } else {
        setTimeout(() => {
          router.go(-1)
        }, 0)
      }
    }
    
    return {
      handleBack,
      route
    }
  },
})
</script>
<style scoped>
.main-header {
  background-color: rgba(0,0,0,0);
  /* Add safe area padding for devices with notches */
  padding-top: env(safe-area-inset-top);
}

.main-header-toolbar {
  /* Ensure toolbar content is properly spaced */
  min-height: 50px;
}
</style>