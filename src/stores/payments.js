import { defineStore } from "pinia";

// for partial payment tracking

export const usePaymentsStore = defineStore('payments', {
  state: () => {
    return {
      // for fungible cashtokens, values must be in normalized amount
      // e.g. If 123 token units with 2 decimals, value must be 1.23
      paid: 0,  // BCH
      total: 0,  // BCH
    }
  },

  actions: {
    resetPayment () {
      this.paid = 0
      this.total = 0
    },
    addPayment (amount) {
      this.paid += amount
    },
    setTotalPayment (amount) {
      this.total = amount
    }
  }
})
