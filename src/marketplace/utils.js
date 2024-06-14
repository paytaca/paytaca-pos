import ago from 's-ago'
import { capitalize } from 'vue'


export function round(value, decimals) {
  const multiplier = 10 ** decimals
  return Math.round(Number(value) * multiplier) / multiplier
}

export function lineItemPropertiesToText(data) {
  if (!data) return ''
  return Object.getOwnPropertyNames(data).map(name => {
    return `${name}: ${data[name]}`
  }).join(', ')
}

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

export function formatDateToText(timestamp) {
  const dateObj = new Date(timestamp)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(dateObj)
}

export function formatStatusGeneric(value='') {
  if (typeof value !== 'string') return
  return capitalize(value).replaceAll('_', ' ')
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
 * @typedef {'pending' | 'confirmed' | 'preparing' | 'picked_up' | 'ready_for_pickup' | 'on_delivery' | 'delivered' | 'completed' | 'cancelled'} OrderStatus
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
 * @returns 
 */
export function formatOrderStatusAction(value) {
  switch(value) {
    case 'pending':
      return 'Mark pending'
    case 'confirmed':
      return 'Confirm order'
    case 'preparing':
      return 'Prepare order'
    case 'ready_for_pickup':
      return 'Ready for pickup'
    case 'picked_up':
      return 'Order picked up'
    default:
      return `Order ${formatOrderStatus(value)}`
  }
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
    case 'picked_up':
      return 'green'
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
    case 'payment_in_escrow':
    case 'partial_payment_in_escrow':
    case 'partially_refunded':
      return 'cyan'
    case 'payment_pending':
      return 'amber'
    case 'refunded':
      return 'grey'
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

export const time = {
  to12Hour(timeStr='') {
    if (!timeStr) return ''

    // Check if the input is in 12-hour format (e.g., "1:30 PM" or "11:45 AM")
    if (/^(0?[1-9]|1[0-2]):[0-5][0-9](:[0-5][0-9])? (AM|PM)$/i.test(timeStr)) {
      return timeStr; // Return the input as it is in 12-hour format
    }

    // Extract hours and minutes from the military time string
    const hours = parseInt(timeStr.slice(0, 2), 10);
    const minutes = parseInt(timeStr.slice(3), 10);

    // Determine AM or PM
    const period = hours >= 12 ? 'PM' : 'AM';

    // Convert hours to 12-hour format
    const hours12 = hours % 12 || 12;

    // Format the time as a string in AM/PM format
    const AMPMTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;

    return AMPMTime;
  },
  to24Hour(timeStr='') {
    if (!timeStr) return ''
    const timeRegex = /^(\d{1,2}):(\d{2})(:\d{2})?\s*(AM|PM)?$/i;
    const match = timeStr.match(timeRegex);
  
    if (!match) return ''
  
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3] ? match[3].toLowerCase() : null;
  
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0;
    }
  
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  },
  toInteger(timeStr='') {
    if (typeof timeStr !== 'string') return NaN

    timeStr = this.to24Hour(timeStr)
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },
  fromInteger(val=0) {
    if (isNaN(val)) return ''

    const hours = Math.floor(val / 60).toString().padStart(2, '0')
    const minutes = (val % 60).toString().padStart(2, '0')
    return `${hours}:${minutes}`
  },
  /**
   * @param {{startTime: String, endTime: String }} range1
   * @param {{startTime: String, endTime: String }} range2
   * @link https://stackoverflow.com/questions/3269434/whats-the-most-efficient-way-to-test-if-two-ranges-overlap
   */
  isConflict(range1, range2) {
    const start1 = this.toInteger(range1?.startTime)
    const end1 = this.toInteger(range1?.endTime)
    const start2 = this.toInteger(range2?.startTime)
    const end2 = this.toInteger(range2?.endTime)

    return start1 <= end2 && start2 <= end1
  }
}
