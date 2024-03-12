<template>
<div>
  <q-field v-model="innerValue" v-bind="fieldProps">
    <template v-slot:control="{ id, modelValue, focused }">
      <div v-show="focused || modelValue?.length" class="row q-gutter-sm q-pt-sm" tabindex="0">
        <template v-if="Array.isArray(modelValue)">
          <q-chip
            v-for="(element, index) in modelValue" :key="index"
            square
            removable
            outline
            @remove="() => remove(element)"
          >
            {{ element }}
          </q-chip>
        </template>
        <input
          v-if="focused"
          :id="id"
          v-model="inputValue"
          class="tags-field-input"
          @keydown="onKeyPress"
          @input="emitUpdateOpts"
        />
      </div>
    </template>
  </q-field>
</div>
</template>
<script>
import { debounce } from 'quasar'
import { defineComponent, ref, watch } from 'vue'

export default defineComponent({
  name: 'TagsField',
  emits: [
    'update:modelValue',
    'added',
    'removed',
    'updateOpts',
  ],
  props: {
    modelValue: { type: Array, required: false },
    fieldProps: Object,
  },
  setup(props, { emit: $emit, attrs: $attrs }) {
    const inputValue = ref('')
    const innerValue = ref(props.modelValue)
    watch(() => props.modelValue, () => {
      innerValue.value = props.modelValue
    }, { deep: true })
    watch(innerValue, () => $emit('update:modelValue', innerValue.value))

    function onKeyPress(event) {
      if (event.keyCode === 13) event.preventDefault();

      if (event.keyCode === 13 && inputValue.value) {
        add(inputValue.value)
        inputValue.value = ''
      } else if (event.keyCode === 8 && innerValue.value?.length && !inputValue.value) {
        innerValue.value.splice(innerValue.value.length-1, 1)
      }
    }

    function add(value) {
      console.log($attrs)
      if (innerValue.value?.indexOf?.(value) >= 0) return
      if (!Array.isArray(innerValue.value)) innerValue.value = []
      innerValue.value.push(value)
      $emit('added', value)
    }

    function remove(value) {
      if (!Array.isArray(innerValue.value)) return
      if (!innerValue.value.indexOf(value) < 0) return

      innerValue.value = innerValue.value.filter(element => element !== value)
      $emit('removed', value)
    }

    const opts = ref([].map(String))
    const updatingOpts = ref(false)
    function updateOpts(newOpts=[].map(String)) {
      if (!Array.isArray(newOpts)) opts.value = []
      opts.value = newOpts
    }

    const emitUpdateOpts = debounce(function () {
      return
      const callbacks = {
        done: (...args) => {
          updateOpts(...args)
          updatingOpts.value = false
        },
        cancel: () => {
          updatingOpts.value = false
        },
      }

      updatingOpts.value = true
      $emit(
        'updateOpts',
        inputValue.value,
        callbacks,
      )
    }, 500, false)

    return {
      inputValue,
      innerValue,
      onKeyPress,
      add,
      remove,
      emitUpdateOpts,
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
