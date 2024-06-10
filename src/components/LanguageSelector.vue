<template>
  <q-select
    v-model="locale"
    :options="localeOptions"
    :label="$t('SelectLanguage')"
    dense
    borderless
    emit-value
    map-options
    options-dense
    style="min-width: 150px"
  />
</template>

<script>
import { useI18n } from 'vue-i18n'

export default {
  setup () {
    const { locale, t } = useI18n({ useScope: 'global' })

    return {
      locale,
      localeOptions: [
        { value: 'af', label: t('Afrikaans') },
        { value: 'ceb', label: t('Cebuano') },
        { value: 'zh-cn', label: t('ChineseSimplified') },
        { value: 'zh-tw', label: t('ChineseTraditional') },
        { value: 'nl', label: t('Dutch') },
        { value: 'en-us', label: t('English') },
        { value: 'de', label: t('German') },
        { value: 'ha', label: t('Hausa') },
        { value: 'id', label: t('Indonesian') },
        { value: 'it', label: t('Italian') },
        { value: 'ja', label: t('Japanese') },
        { value: 'ko', label: t('Korean') },
        { value: 'pt', label: t('Portuguese') },
        { value: 'pt-br', label: t('PortugueseBrazil') },
        { value: 'es', label: t('Spanish') },
        { value: 'es-ar', label: t('SpanishArgentina') },
      ]
    }
  }
}
</script>
