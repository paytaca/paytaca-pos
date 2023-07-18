import ago from 's-ago'
import { capitalize } from 'vue'

/**
 * @param {Date} value 
 */
export function formatDateRelative(value) {
  if (!value?.getDate?.()) value = new Date(value)
  return ago(value)
}

/**
 * @param {Date | String | Number} timestamp 
 */
export function formatTimestampToText(timestamp) {
  const dateObj = new Date(timestamp)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(dateObj)
}

/** 
 * @param {'shop_admin' | 'inventory_control_manager' | 'cashier' | 'storefront_staff' } value
 */
export function formatRole(value) {
  switch(value) {
    case 'shop_admin':
      return 'Admin'
    case 'inventory_control_manager':
      return 'Inventory'
    case 'cashier':
      return 'Cashier'
    case 'storefront_staff':
      return 'Storefront'
    default:
      if (typeof value === 'string') return capitalize(value).replaceAll('_', ' ')
  }
}

/**
 * @param { 'draft' | 'pending' | 'partial' | 'received' | 'complete' } value
 */
export function formatPurchaseOrderStatus(value) {
  switch(value) {
    case 'partial':
      return 'Partially received'
    case 'draft':
    case 'pending':
    case 'received':
    case 'complete':
    default:
      if (typeof value === 'string') return capitalize(value).replaceAll('_', ' ')
  }
}

/**
 * @param { 'draft' | 'pending' | 'partial' | 'received' | 'complete' } value
 */
export function parsePurchaseOrderStatusColor(value) {
  switch(value) {
    case 'partial':
      return 'cyan'
    case 'draft':
      return 'grey'
    case 'pending':
      return 'amber'
    case 'received':
      return 'teal'
    case 'complete':
      return 'green'
    default:
      return undefined
  }
}

/**
 * @typedef {'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'on_delivery' | 'delivered' | 'completed' | 'cancelled'} OrderStatus
 */

/**
 * @param {OrderStatus} value
 */
export function formatOrderStatus(value) {
  if (typeof value !== 'string') return ''

  return capitalize(value.replaceAll('_', ' '))
}

/**
 * 
 * @param {OrderStatus} value 
 */
export function parseOrderStatusColor(value) {
  switch (value) {
    case 'pending':
      return 'amber'
    case 'confirmed':
      return 'blue'
    case 'preparing':
      return 'amber-7'
    case 'ready_for_pickup':
      return 'amber-8'
    case 'on_delivery':
      return 'green'
    case 'delivered':
      return 'green-7'
    case 'completed':
      return 'green-8'
    case 'cancelled':
      return 'red'
    default:
      return undefined
  }
}

export function parsePaymentStatusColor(value) {
  switch(value) {
    case 'paid':
      return 'green'
    case 'partially_paid':
      return 'cyan'
    case 'payment_pending':
      return 'amber'
    default:
      return undefined
  }
}

export const errorParser = {
  toArray(value) {
    if (Array.isArray(value)) return value
    if (value?.detail) return [value?.detail]
    if (value) return [value]
    return []
  },
  firstElementOrValue(array=[]){
    let data = Array.isArray(array) ? array[0] : array
    if (data?.detail) return data?.detail
    return data
  },
}

/**
 * @param {Object} transaction tx data from watchtower, only attributes needed in this object is documented 
 * @param {{ key: String, value: any }[]} transaction.attributes
 * @returns {String | Number | undefined}
 */
export function resolveTransactionSalesOrderId(transaction) {
  return transaction?.attributes?.find?.(attr => attr?.key == 'commerce_hub_sales_order_id')?.value
}
