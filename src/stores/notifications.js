import { defineStore } from 'pinia';
import { getRouter } from 'src/router';

/**
 * @typedef {Object} AndroidNotificationPayload
 * @property {String} id
 * @property {Object} data values passed as extra is stored here. some extra values are
 * 
 * @typedef {Object} IOSNotificationPayload
 * @property {String} id
 * @property {String} badge
 * @property {String} title
 * @property {String} subtitle
 * @property {String} body
 * @property {Object} data values passed as extra is stored here
 * 
 * @typedef {Object} NotificationAction
 * @property {String} actionId
 * @property {AndroidNotificationPayload | IOSNotificationPayload} notification
 */

export const useNotificationsStore = defineStore('notifications', {
  state: () => {
    return {
      /** @type {AndroidNotificationPayload | IOSNotificationPayload} */
      openedNotification: {
        /**
         * It's better to use global state like vuex/pinia (than to implement another) for a
         * global event bus functionality.
         * https://stackoverflow.com/a/70442724/13022138
         * 
         * - This object should contain the latest opened push notification
         * - Should immediately be cleared after proper routing & displaying of info
         */
        // ios
        badge: '',
        title: '',
        subtitle: '',
        body: '',

        // ios & android
        id: '',
        data: {
          type: '',
          // <key> : <value> pairs taken from `extra` data
        }
      },
    }
  },
  getters: {
    types() {
      return {
        MARKETPLACE_ORDER_CREATE: 'marketplace_order_created',
        MARKETPLACE_ORDER_STATUS_UPDATE: 'marketplace_order_status_update',
      }
    }
  },
  actions: {
    /**
     * @param {Object} state 
     * @param {Object} payload
     * @param {String} payload.id
     * @param {String} [payload.badge]
     * @param {String} [payload.title]
     * @param {String} [payload.subtitle]
     * @param {String} [payload.body]
     * @param {Map<String, any>} payload.data
     */
    setOpenedNotification(payload) {
      // Using Object.assign to capture any undocumented data in payload
      Object.assign(this.openedNotification, payload, {
        id: payload?.id,
        badge: payload?.badge,
        title: payload?.title,
        subtitle: payload?.subtitle,
        body: payload?.body,
        data: payload?.data,
      }, this.openedNotification)
    },
    clearOpenedNotification() {
      this.openedNotification = {
        badge: '',
        title: '',
        subtitle: '',
        body: '',
        id: '',
        data: { type: '' }
      }
    },
    /**
     * @param {AndroidNotificationPayload | IOSNotificationPayload} openedNotification
     */
    resolvePushNotificationRoute(openedNotification) {
      const $router = getRouter()
    
      let route = null
      switch(openedNotification?.data?.type) {
        case (this.types.MARKETPLACE_ORDER_CREATE):
          route = {
            name: 'marketplace-storefront-order',
            params: { orderId: openedNotification?.data?.order_id },
          }
          break
      }
    
      try {
        return $router.resolve(route)
      } catch (error) { console.error(error) }
      return null
    },
    getOpenedNotificationRoute() {
      return this.resolvePushNotificationRoute(this.openedNotification)
    },
    /**
     * Handles the routing of an opened notification
     * NOTE: Clear the notification using .clearOpenedNotification()
     *       inside the page component after handling the notification
     */
    async handleOpenedNotification() {
      const $router = getRouter()
      const route = await this.getOpenedNotificationRoute()
      if (route) $router.push(route)
    }    
  },
})
