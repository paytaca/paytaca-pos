<template>
  <div class="q-pa-xs col-6">
    <q-card style="height:100%;position: relative;" class="br-15" v-ripple="Boolean(ripple)">
      <q-card-section
        class="q-px-md q-py-sm"
        style="min-height:7rem;max-height:10rem;overflow-y:hidden;"
      >
        <slot name="header">
          <div class="row items-center no-wrap">
            <div class="text-subtitle1 ellipsis">
              {{ title }}
            </div>
            <q-spinner v-if="loading" class="q-ml-xs"/> 
            <q-badge v-if="badge" class="q-ml-xs" color="brandblue">{{ badge }}</q-badge>
          </div>
        </slot>
        <slot name="default">
        </slot>
      </q-card-section>
    </q-card>
  </div>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'DashboardCard',
  props: {
    title: String,
    loading: Boolean,
    badge: [String, Number],
    ripple: Boolean,
  },
})
</script>
