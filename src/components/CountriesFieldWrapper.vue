<template>
  <slot v-bind="{ countriesOpts, filteredCountriesOpts, filterCountriesOpts }">
  </slot>
</template>
<script>
import { computed, defineComponent, ref } from 'vue'
import countriesJson from 'src/assets/countries.json'

export default defineComponent({
  name: 'CountriesFieldWrapper',
  setup() {
    const countriesOpts = computed(() => {
      if (!Array.isArray(countriesJson)) return []
      return countriesJson
        .map(countryJson => countryJson?.name)
        .filter(Boolean)
        .filter((e,i,s) => s.indexOf(e) === i)
    })
    const filteredCountriesOpts = ref([])
    function filterCountriesOpts (val, update) {
      if (!val) {
        filteredCountriesOpts.value = countriesOpts.value
      } else {
        const needle = String(val).toLowerCase()
        filteredCountriesOpts.value = countriesOpts.value
          .filter(country => String(country).toLowerCase().indexOf(needle) >= 0)
      }
      update()
    }

    return {
      countriesOpts,
      filteredCountriesOpts,
      filterCountriesOpts,
    }
  },
})
</script>
