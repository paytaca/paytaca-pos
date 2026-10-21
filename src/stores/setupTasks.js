import { defineStore } from 'pinia'

/**
 * Dismissal state for the "next steps" tasks.
 *
 * Two levels of dismissal, both scoped per shop (`${shopId}:${slug}`):
 *
 * - `dismissedKeys` ("not now"): in-memory only — the store opts out of
 *   persisting it, so those dismissals are forgotten when the app is reloaded.
 * - `permanentDismissKeys` ("do not show again"): persisted (see `persist`),
 *   so those tasks stay hidden across reloads.
 */
export const useSetupTasksStore = defineStore('setupTasks', {
  persistedState: {
    includePaths: ['permanentDismissKeys'],
  },
  state: () => ({
    dismissedKeys: [],
    permanentDismissKeys: [],
  }),
  actions: {
    /** Dismissed either just for this session or permanently. */
    isDismissed(key) {
      if (!key) return false
      return this.dismissedKeys.includes(key) || this.permanentDismissKeys.includes(key)
    },
    /** Dismiss until the app is reloaded. */
    dismiss(key) {
      if (!key || this.dismissedKeys.includes(key)) return
      this.dismissedKeys.push(key)
    },
    /** Dismiss until the merchant explicitly brings the task back. */
    dismissPermanent(key) {
      if (!key) return
      if (!this.permanentDismissKeys.includes(key)) this.permanentDismissKeys.push(key)
    },
    /** Forgets session dismissals only; permanent ones are kept. */
    reset() {
      this.dismissedKeys = []
    },
  },
})
