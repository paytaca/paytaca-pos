import { defineStore } from 'pinia'

/**
 * Dismissal state for the "next steps" tasks.
 *
 * Intentionally in-memory only (not persisted): dismissals are scoped per shop
 * (`${shopId}:${slug}`) and reset whenever the app is reloaded. The store opts
 * out of persistence simply by not declaring a `persist` option.
 */
export const useSetupTasksStore = defineStore('setupTasks', {
  state: () => ({
    dismissedKeys: [],
  }),
  actions: {
    isDismissed(key) {
      return this.dismissedKeys.includes(key)
    },
    dismiss(key) {
      if (!key || this.dismissedKeys.includes(key)) return
      this.dismissedKeys.push(key)
    },
    reset() {
      this.dismissedKeys = []
    },
  },
})
