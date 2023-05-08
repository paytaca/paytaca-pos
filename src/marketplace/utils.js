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