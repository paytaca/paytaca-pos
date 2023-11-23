import { OrderUpdates, PurchaseOrderUpdates } from "./objects";
import { formatTimestampToText, formatDateToText } from "./utils";

/**
 * 
 * @param {OrderUpdates} obj 
 */
export function getOrderUpdatesTexts(obj) {
  if (obj.updateType == obj.UpdateTypes.STATUS_UPDATE) {
    const prevStatus = obj.prevValue?.status
    const newStatus = obj.newValue?.status
    let str = `Updated status`
    if (prevStatus) str += ` from '${formatOrderStatus(prevStatus)}'`
    str += ` to '${formatOrderStatus(newStatus)}'`
    return [str]
  } else if (obj.updateType == obj.UpdateTypes.ITEM_ADD) {
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
    if (obj.prevValue.price != obj.newValue.price) {
      const prevPrice = [obj.prevValue.price, obj.prevValue.currency].filter(Boolean).join(' ')
      const newPrice = [obj.newValue.price, obj.newValue.currency].filter(Boolean).join(' ')
      texts.push(`Changed price from ${prevPrice} to ${newPrice}`)
    }
    if (obj.prevValue.markup_price != obj.newValue.markup_price) {
      const prevMarkupPrice = [obj.prevValue.markup_price, obj.prevValue.currency].filter(Boolean).join(' ')
      const newMarkupPrice = [obj.newValue.markup_price, obj.newValue.currency].filter(Boolean).join(' ')
      texts.push(`Changed markup price from ${prevMarkupPrice} to ${newMarkupPrice}`)
    }
    return texts
  } else if (obj.updateType == obj.UpdateTypes.DELIVERY_ADDRESS_UPDATE) {
    const texts = []
    const prevName = `${obj.prevValue?.first_name} ${obj.prevValue?.last_name}`
    const newName = `${obj.newValue?.first_name} ${obj.newValue?.last_name}`
    if (prevName != newName) {
      texts.push(`Changed name from ${prevName} to ${newName}`)
    }
    if (obj.prevValue?.phone_number != obj.newValue?.phone_number) {
      texts.push(`Changed contact from ${obj.prevValue?.phone_number} to ${obj.newValue?.phone_number}`)
    }
    if (obj.prevValue?.location != obj.newValue?.location) {
      texts.push(`Updated location from '${obj.prevValue.location}' to '${obj.newValue.location}'`)
    }
    if (obj.prevValue?.coordinates != obj.newValue?.coordinates) {
      texts.push(`Updated pin location from ${obj.prevValue.coordinates} to ${obj.newValue.coordinates}`)
    }
    return texts
  }
}

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