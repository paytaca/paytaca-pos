<template>
  <slot v-bind="{ result, error, loading, runSearch }"></slot>
</template>
<script>
import { debounce } from 'quasar'
import { backend } from 'src/marketplace/backend'
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'CategoriesSearchWrapper',
  emits: [
    'update:searchNeedle',
    'result',
    'error',
    'search',
  ],
  props: {
    filterOpts: Object,
  },
  setup(props, { emit: $emit }) {
    const loading = ref(false)
    const error = ref()
    const result = ref({
      needle: '',
      categories: [].map(String),
    })
    function runSearch(val='') {
      const params = Object.assign({
        limit: 5,
      }, props.filterOpts, { s: val })

      loading.value = true
      $emit('search', val)
      backend.get(`product-categories/`, { params })
        .finally(() => {
          error.value = undefined
        })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          result.value = {
            needle: params?.s,
            categories: response?.data?.results.map(category => category?.name).filter(Boolean),
          }
          $emit('result', result.value)
          return response
        })
        .catch(err => {
          error.value = err
          $emit('error', error.value)
        })
        .finally(() => {
          loading.value = false
        })
    }
    runSearch = debounce(runSearch, 500)

    return {
      loading,
      error,
      result,
      runSearch,

    }
  },
})
</script>
