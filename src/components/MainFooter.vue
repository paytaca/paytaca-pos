<template>  
  <footer
    elevated
    reveal
    class="layout-footer q-footer fixed-bottom bg-white shadow-up-3"
  >
    <div class="row items-center justify-around">
      <div>
        <q-btn
          color="brandblue"
          flat
          size="1.5rem"
          padding="sm lg"
          icon="home"
          :to="{ name: 'home' }"
        />
      </div>
      <div>
        <div class="receive-page-btn-container bg-white shadow-20">
          <q-btn
            flat
            color="brandblue"
            round
            padding="md"
            size="1.75rem"
            icon="qr_code"
            :to="{ name: 'receive-page' }"
          />
        </div>
      </div>
      <q-btn
        color="brandblue"
        flat
        size="1.5rem"
        padding="sm lg"
        icon="settings"
        :to="{ name: 'settings' }"
      />
    </div>
  </footer>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MainFooter',
  setup() {
    
  },
})
</script>
<style scoped>
.receive-page-btn-container {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -40%);
  border-radius:999px;
}
.layout-footer {
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
  background: none;
}
</style>