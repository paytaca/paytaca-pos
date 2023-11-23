import { PurchaseOrderUpdates } from "./objects";
import { formatTimestampToText, formatDateToText } from "./utils";


/**
 * @param {PurchaseOrderUpdates} obj 
 */
export function getPurchaseOrderUpdatesTexts(obj) {
  if (obj.updateType == obj.UpdateTypes.ITEM_ADD) {
    return [`Added item ${obj.newValue?.item_name}`]
  } else if (obj.updateType == obj.UpdateTypes.ITEM_REMOVE) {
    return [`Removed item ${obj.prevValue?.item_name}`]
  } else if (obj.updateType == obj.UpdateTypes.ITEM_UPDATE) {
    const texts = [
      `Updated item ${obj.prevValue.item_name || obj.newValue.item_name}`
    ]
    if (obj.prevValue.quantity != obj.newValue.quantity) {
      texts.push(`Changed quantity from ${obj.prevValue.quantity} to ${obj.newValue.quantity}`)
    }
    if (obj.prevValue.costPrice != obj.newValue.costPrice) {
      const prevCostPrice = [obj.prevValue.price, obj.prevValue.currency].filter(Boolean).join(' ')
      const newCostPrice = [obj.newValue.price, obj.newValue.currency].filter(Boolean).join(' ')
      texts.push(`Changed cost price from ${prevCostPrice} to ${newCostPrice}`)
    }

    if (!obj.prevValue.delivered_at && obj.newValue.delivered_at) {
      texts.push(`Marked item as delivered`)
    } else if (obj.prevValue.delivered_at && !obj.newValue.delivered_at) {
      texts.push(`Marked item as undelivered`)
    } else if (obj.prevValue.delivered_at) {
      texts.push(`Updated delivery timestamp to ${formatTimestampToText(obj.prevValue.delivered_at)}`)
    }

    if (obj.prevValue.expired_at != obj.newValue.expired_at) {
      if (!obj.prevValue.expired_at && obj.newValue.expired_at) {
        texts.push(`Added expiration date for '${obj.newValue.item_name}'`)
      } else if (obj.prevValue.expired_at && !obj.newValue.expired_at) {
        texts.push(`Removed expiration date for '${obj.newValue.item_name}'`)
      } else if (obj.newValue.expired_at) {
        texts.push(`Changed expiration date to ${formatDateToText(obj.newValue.expired_at)}`)
      }
    }

    return texts
  } else if (obj.updateType == obj.UpdateTypes.OTHER) {
    const texts = []
    if (['complete', 'received'].includes(obj.newValue.status)) {
      texts.push(`Marked as ${obj.newValue.status}`)
    } else if (obj.prevValue.status != obj.newValue.status && obj.newValue.status) {
      if (Object.getOwnPropertyNames(obj.newValue).length === 1) {
        texts.push(`Updated status to ${obj.newValue.status}`)
      }
    }

    if (obj.prevValue.reviewed_by_id != obj.newValue.reviewed_by_id) {
      if (obj.prevValue.reviewed_by_id && !obj.newValue.reviewed_by_id) {
        texts.push(`Removed ${obj.prevValue.reviewed_by_name} as reviewer`)
      } else if (obj.newValue.reviewed_by_id) {
        texts.push(`Assigned ${obj.newValue.reviewed_by_name} as reviewer`)
      }
    }

    if (!obj.prevValue.reviewed_at && obj.newValue.reviewed_at) {
      texts.push(`Reviewed at ${formatTimestampToText(obj.newValue.reviewed_at)}`)
    }

    return texts
  }
}