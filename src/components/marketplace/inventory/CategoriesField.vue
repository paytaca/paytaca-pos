<template>
  <CategoriesSearchWrapper
    :filterOpts="filterOpts"
    v-slot="{ result, loading, runSearch }"
    @search="() => openMenu = true"
    @result="() => {
      openMenu = true
      updateMenuPosition()
    }"
  >
    <OptionsField
      :placeholder="placeholder"
      :disableAddOnComma="disableAddOnComma"
      v-model="innerVal"
      v-model:input="inputVal"
      v-bind="fieldProps"
      v-slot="ctx"
      @update:input="val => runSearch(val)"
      @focus="() => openMenu = result?.categories?.length ? true : openMenu"
    >
      <q-menu ref="menu" v-model="openMenu" no-focus no-refocus no-parent-event fit>
        <div v-if="loading" class="text-center q-my-sm">
          <q-spinner/>
        </div>
        <template v-else-if="!result?.categories?.length">
          <q-item
            v-if="ctx?.inputValue == inputVal && ctx?.inputValue"
            clickable v-close-popup
            @click="() => ctx?.addInputValue?.()"
          >
            <q-item-section>
              <q-item-label>
                {{
                  $t(
                    'AddInputValue',
                    { value: ctx?.inputValue }
                    `Add ${ctx?.inputValue}`
                  )
                }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </template>
        <q-item
          v-for="category in result?.categories" :key="category"
          clickable v-ripple
          :active="Boolean(innerVal?.includes?.(category))"
          @click="() => {
            toggleValue(category)
            updateMenuPosition()
          }"
        >
          <q-item-section>
            <q-item-label>
              {{ category }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-menu>
    </OptionsField>
  </CategoriesSearchWrapper>
</template>
<script>
import { computed, defineComponent, ref, watch } from 'vue'
import OptionsField from '../jsonform/OptionsField.vue'
import CategoriesSearchWrapper from './CategoriesSearchWrapper.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export default defineComponent({
  name: 'CategoriesField',
  components: {
    CategoriesSearchWrapper,
    OptionsField,
  },
  emits: [
    'update:modelValue',
  ],
  props: {
    modelValue: Array,
    filterOpts: Object,
    fieldProps: Object,
    disableAddOnComma: Boolean,
    placeholder: { type: String, default: t('InputCategories') },
  },
  setup(props, { emit: $emit }) {
    const inputVal = ref('')
    const innerVal = ref(props.modelValue?.map?.(String) || [])
    const serializedInnerVal = computed(() => JSON.stringify(innerVal.value))
    const serializedModelVal = computed(() => JSON.stringify(props.modelValue))
    watch(serializedInnerVal, () => {
      if (serializedInnerVal.value == serializedModelVal.value) return
      $emit('update:modelValue', innerVal.value?.map?.(String))
    })
    watch(serializedModelVal, () => {
      if (serializedInnerVal.value == serializedModelVal.value) return
      syncInnerVal()
    })

    function syncInnerVal() {
      if (!Array.isArray(props.modelValue)) return
      innerVal.value = props.modelValue.map(String)
    }
    syncInnerVal()

    function toggleValue(category) {
      if (innerVal.value?.includes?.(category)) {
        innerVal.value = innerVal.value.filter(_category => category != _category)
      } else {
        innerVal.value?.push?.(category)
      }
    }

    const menu = ref()
    const openMenu = ref(false)
    window.t = () => menu.value?.updatePosition?.()
    function updateMenuPosition() {
      setTimeout(() => {
        menu.value?.updatePosition?.()
      }, 100)
    }
    return {
      inputVal,
      innerVal,
      toggleValue,
      menu,
      openMenu,
      updateMenuPosition,
    }
  },
})
</script>
