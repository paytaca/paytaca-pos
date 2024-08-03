import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'
import { useSettingsStore } from 'src/stores/settings'

// Create I18n instance
export const i18n = createI18n({
  locale: 'en-us',
  legacy: false, // comment this out if not using Composition API
  messages
})

export default ({ app }) => { 
  // Tell app to use the I18n instance
  app.use(i18n)

  const settingsStore = useSettingsStore()
  if (messages[settingsStore.language]) {
    i18n.global.locale.value = settingsStore.language
  }
}
