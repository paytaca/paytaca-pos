<template>
  <div>
    <div class="main-header text-brandblue">
      <q-toolbar class="main-header-toolbar">
        <q-btn
          flat
          round
          size="1.5rem"
          padding="xs"
          icon="arrow_back"
          aria-label="Back"
          class="back-button"
          @click="handleBack"
        />
        <slot name="title">
          <q-toolbar-title class="text-center text-h4">
            {{ route.meta?.title ||  title || '' }}
          </q-toolbar-title>
        </slot>
        <slot name="right-actions"></slot>
      </q-toolbar>
    </div>
    <!-- Spacer to prevent content from overlapping fixed header -->
    <div class="main-header-spacer"></div>
  </div>
</template>
<script>
import { defineComponent } from 'vue'
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
  /* Position header at the very top of viewport */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2000;
  /* No padding on header itself - toolbar will handle safe area */
}

.main-header-toolbar {
  /* Ensure toolbar content is properly spaced */
  min-height: 50px;
  /* Add safe area padding only here, once, to push content below status bar/notch */
  /* On Android, env(safe-area-inset-top) will be 0, so no extra padding */
  padding-top: constant(safe-area-inset-top); /* iOS 11.0-11.2 */
  padding-top: env(safe-area-inset-top); /* iOS 11.2+ */
  padding-bottom: 0;
  /* Center content vertically within toolbar */
  display: flex;
  align-items: center;
  position: relative; /* Add this for absolute positioning of title */
}

.back-button {
  /* Ensure back button is clickable and properly positioned */
  position: relative;
  z-index: 1;
  margin-right: 8px;
  /* Ensure button is large enough to be easily clickable */
  min-width: 40px;
  min-height: 40px;
  flex-shrink: 0; /* Prevent button from shrinking */
}

/* Center the title absolutely to ensure it's truly centered */
.main-header-toolbar :deep(.q-toolbar-title) {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  width: auto;
  max-width: calc(100% - 120px); /* Account for buttons on both sides */
  pointer-events: auto; /* Allow interactions with title if needed */
}

.main-header-spacer {
  /* Spacer matches header height to prevent content overlap */
  /* Toolbar min-height (50px) + safe area padding */
  /* Base height for Android and devices without safe area */
  height: 50px;
  /* Add safe area padding for iOS devices with notches */
  height: calc(50px + constant(safe-area-inset-top)); /* iOS 11.0-11.2 */
  height: calc(50px + env(safe-area-inset-top)); /* iOS 11.2+ */
}
</style>