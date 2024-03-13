<template>
  <q-field v-model="innerVal" v-bind="fieldProps">
    <template v-slot:control="{ id, modelValue, focused }">
      <div v-show="focused || modelValue?.length" class="row full-width" tabindex="0">
        <template v-if="Array.isArray(modelValue)">
          <template v-for="(element, index) in modelValue" :key="index">
            <slot name="chip" v-bind="{ value: element, index, remove}">
              <q-chip
                color="brandblue"
                removable
                outline
                @remove="() => remove(element)"
              >
                {{ element }}
              </q-chip>
            </slot>
          </template>
        </template>
        <q-slide-transition :duration="100">
          <div v-if="focused" class="row items-center no-wrap q-space">
            <input
              :id="id"
              v-model="inputValue"
              placeholder="Input option"
              class="tags-field-input"
              style="min-height:24px;"
              @keydown="onKeyPress"
              @input="() => (inputValue?.includes?.(',') && !disableAddOnComma) ? addInputValue() : undefined"
            />
            <q-space/>
            <q-btn
              v-if="inputValue"
              flat
              no-caps label="Add"
              padding="none xs"
              @click="() => addInputValue()"
            />
          </div>
        </q-slide-transition>
      </div>
    </template>
  </q-field>
</template>
<script>
import { defineComponent, ref, computed, watch } from 'vue'

export default defineComponent({
  name: 'OptionsField',
  emits: [
    'update:modelValue',
    'added',
    'removed',
  ],
  props: {
    modelValue: Array,
    fieldProps: Object,
    disableAddOnComma: Boolean,
  },
  setup(props, { emit: $emit }) {
    const inputValue = ref('')
    const innerVal = ref(props.modelValue?.map?.(String) || [])
    watch(() => props.modelValue, () => syncInnerVal())
    // watch(innerVal, () => $emit('update:modelValue', innerVal.value?.map?.(String)), { deep: true })

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

    function onKeyPress(event) {
      const isComma = event.keyCode === 188
      const isEnter = event.keyCode === 13

      if (isEnter || isComma) event.preventDefault();

      if ((isEnter || (isComma && !props.disableAddOnComma)) && inputValue.value) {
        addInputValue()
      } else if (event.keyCode === 8 && innerVal.value?.length && !inputValue.value) {
        innerVal.value.splice(innerVal.value.length-1, 1)
      }
    }

    function addInputValue() {
      if (!inputValue.value) return
      if (props.disableAddOnComma) {
        add(inputValue.value)
      } else {
        inputValue.value.split(',')
          .filter((element, index, array) => array.indexOf(element) === index)
          .filter(Boolean)
          .forEach(add)  
      }
      inputValue.value = '' 
    }

    function add(value) {
      if (innerVal.value?.indexOf?.(value) >= 0) return
      if (!Array.isArray(innerVal.value)) innerVal.value = []
      innerVal.value.push(value)
      $emit('added', value)
    }

    function remove(value) {
      if (!Array.isArray(innerVal.value)) return
      if (!innerVal.value.indexOf(value) < 0) return

      innerVal.value = innerVal.value.filter(element => element !== value)
      $emit('removed', value)
    }

    return {
      inputValue,
      innerVal,
      onKeyPress,
      addInputValue,
      add,
      remove,
    }
  },
})
</script>
<style scoped>
.tags-field-input {
  background: none;
  border: 0;
  color: inherit;
}

.tags-field-input:focus {
  outline-width: 0;
  outline: none;
}
</style>
