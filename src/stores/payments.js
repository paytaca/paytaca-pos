import { defineStore } from "pinia";

// for partial payment tracking

export const usePaymentsStore = defineStore('payments', {
  state: () => {
    return {
      paid: 0,  // BCH
      total: 0,  // BCH
    }
  },

  actions: {
    resetPayment () {
      this.paid = 0
    },
    addPayment (amount) {
      this.paid += amount
    },
    setTotalPayment (amount) {
      this.total = amount
    }
  }
})
