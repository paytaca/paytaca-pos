<template>
  <div>
    <div v-for="(addon, index) in addons" :key="index" class="">
      <div class="row items-center">
        <div class="text-body2">{{ addon?.label }}</div>
        <q-icon v-if="!hasOptions(addon) && hasInputRequired(addon)" name="keyboard" size="1.2em" color="grey" class="q-ml-xs"/>
        <q-space/>
        <div class="text-right">
          <div v-if="shouldDisplayMinMaxOpts(addon)" class="q-ml-xs text-grey text-caption" style="line-height:1.1em">
            {{ $t('RequiredSelected') }}:
            {{ addon?.minOpts }}
            <template v-if="addon?.minOpts !== addon?.maxOpts">
              - {{ addon?.maxOpts }}
            </template>
          </div>
          <div v-if="!hasOptions(addon)" class="q-pl-sm">
            {{ addon?.options?.[0]?.price }} {{ currency }}
          </div>
        </div>
      </div>
      <div v-if="hasOptions(addon)" class="q-pl-md text-caption">
        <div
          v-for="(option, index2) in addon.options" :key="`${index}-${index2}`"
          class="row items-center"
        >
          <div>
            {{ option?.label }}
            <q-icon v-if="option?.requireInput" name="keyboard" size="1.2em" color="grey"/>
          </div>
          <q-space/>
          <div>{{ option?.price }} {{ currency }}</div>
        </div>
      </div>
      <q-separator v-if="index < addons?.length-1" spaced />
    </div>
  </div>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'AddonsInfoPanel',
  props: {
    addons: Array,
    currency: String,
  },
  methods: {
    hasOptions(addon) {
      return addon?.options?.length !== 1
    },
    hasInputRequired(addon) {
      return Boolean(addon?.options?.find?.(opt => opt?.requireInput))
    },
    shouldDisplayMinMaxOpts(addon) {
      if (addon?.minOpts <= 0 && addon?.maxOpts >= addon?.options?.length) return false
      return true
    }
  }
})
</script>

