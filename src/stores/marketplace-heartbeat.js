import { defineStore } from "pinia"
import { useMarketplaceStore } from "./marketplace"

export const DEFAULT_MAX_AGE = 30 * 1000
export const HEARTBEAT_REQUEST_HEADER = 'X-Heartbeat-Shop-Id'
export const useMarketplaceHeartbeatStore = defineStore('marketplace-heartbeat', {
  state: () => {
    return {
      lastTimestamp: 0,
      maxAge: DEFAULT_MAX_AGE,
    }
  },
  getters: {
    maxAgeSafe() {
      const maxAge = parseFloat(this.maxAge)
      if (!Number.isFinite(maxAge)) return maxAge
      return DEFAULT_MAX_AGE
    },
  },
  actions: {
    isLastHeartbeatExpired() {
      const timeSinceLastHeartbeat = Date.now() - this.lastTimestamp
      return !(timeSinceLastHeartbeat < this.maxAgeSafe)
    },
    triggerHeartbeat() {
      const isLastHeartbeatExpired = this.isLastHeartbeatExpired()
      if (!isLastHeartbeatExpired) return 'Last heartbeat not yet expired'

      // this can be any authenticated api call using
      // the backend instance for marketplace
      const marketplaceStore = useMarketplaceStore()
      return marketplaceStore.refreshUser({ silent: true })
    }
  }
})
