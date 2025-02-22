import { boot } from 'quasar/wrappers'
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app'
import { registerPlugin } from '@capacitor/core'
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Platform } from 'quasar'
import { reactive } from 'vue';
import { markRaw } from 'vue';
import { useNotificationsStore } from 'src/stores/notifications';

const PushNotificationSettings = registerPlugin('PushNotificationSettings'); 

/**
 * This is a proxy events emitter for PushNotification plugin's events
 * - Created a proxy emitter class since the original event emitter lack removing specific event listeners
 * - This is meant to be singleton class, use `PushNotificationsEventEmitter.getInstance()` to access
 */
export class PushNotificationsEventEmitter {
  static events = [
    'registration',
    'registrationError',
    'pushNotificationReceived',
    'pushNotificationActionPerformed',
  ]

  /**
   * @returns {PushNotificationsEventEmitter}
   */
  static getInstance() {
    if (!PushNotificationsEventEmitter.instance) {
      PushNotificationsEventEmitter.instance = new PushNotificationsEventEmitter()
    }

    return PushNotificationsEventEmitter.instance
  }

  constructor() {
    if (PushNotificationsEventEmitter.instance) return PushNotificationsEventEmitter.instance
    PushNotificationsEventEmitter.instance = this

    this.listeners = {}

    this.eventHandlers = {}
    PushNotificationsEventEmitter.events.forEach(eventName => {
      this.eventHandlers[eventName] = eventData => this.emitEvent(eventName, eventData)
    })
    this.setupEventHandlers()
  }

  setupEventHandlers() {
    Object.getOwnPropertyNames(this.eventHandlers)
      .forEach(eventName => {
        PushNotifications.addListener(eventName, this.eventHandlers[eventName])
      })
  }

  addEventListener(eventName='', callback) {
    if (!eventName || typeof callback !== 'function') return
    if (!Array.isArray(this.listeners[eventName])) this.listeners[eventName] = []
    if (this.listeners[eventName].indexOf(callback) >= 0) return
    this.listeners[eventName].push(callback)
  }

  removeEventListener(eventName='', callback) {
    if (!Array.isArray(this.listeners[eventName])) return

    const index = this.listeners[eventName].indexOf(callback)
    if (index >= 0) {
      this.listeners[eventName].splice(index, 1);
    }
  }

  emitEvent(eventName, data) {
    if (!Array.isArray(this.listeners[eventName])) return
    this.listeners[eventName]
      .forEach(callback => {
        try {
          callback(data)
        } catch(error) {
          console.error(error)
        }
      })
  }
}


class PushNotificationsManager {
  constructor() {
    this.events = PushNotificationsEventEmitter.getInstance()
    this.registrationToken = ''
    this.deviceId = ''
    this.appInfo = null
    this.registrationTokenError= 'no error'
    this.permissionStatus = null
    this.isEnabled = null

    if (this.isMobile) {
      this.fetchRegistrationToken()
        .catch(error => {
          this.registrationTokenError = error
        })
    }
  }

  get isMobile() {
    return Platform.is.mobile
  }

  get platform() {
    return Capacitor.getPlatform()
  }

  fetchAppInfo() {
    return App.getInfo()
      .then(response => {
        this.appInfo = response
        return response
      })
  }

  /**
   * @returns {Promise<{ isEnabled:Boolean }>}
   */
  async isPushNotificationEnabled() {
    return PushNotificationSettings.getNotificationStatus()
      .catch(error => {
        if (error.code === 'UNIMPLEMENTED') return { isEnabled: null }
        return Promise.reject(error)
      })
      .then(response => {
        this.isEnabled = response?.isEnabled
        return response
      })
  }

  /**
   * @param {{message: String, title: String}} opts
   * @returns {Promise<{ resultCode:Number, isEnabled:Boolean, data:any }>}
   */
  async openPushNotificationsSettings() {
    if (this._openSettingsPromise) return this._openSettingsPromise
    this._openSettingsPromise = PushNotificationSettings.openNotificationSettingsPrompt(opts)
    return PushNotificationSettings.openNotificationSettings()
      .catch(error => {
        if (error.code === 'UNIMPLEMENTED') return { isEnabled: null }
        return Promise.reject(error)
      })
      .then(response => {
        this.isEnabled = response?.isEnabled
        return response
      })
      .finally(() => {
        this._openSettingsPromise = undefined
      })
  }

  /**
   * @param {{message: String, title: String}} opts
   * @returns {Promise<{ resultCode:Number, isEnabled:Boolean, data:any } | null>}
   */
  async openPushNotificationsSettingsPrompt(opts) {
    if (this._openSettingsPromptPromise) return this._openSettingsPromptPromise
    this._openSettingsPromptPromise = PushNotificationSettings.openNotificationSettingsPrompt(opts)
    return this._openSettingsPromptPromise
      .catch(error => {
        if (error.code === 'UNIMPLEMENTED') return { isEnabled: null }
        return Promise.reject(error)
      })
      .then(response => {
        this.isEnabled = response?.isEnabled
        return response
      })
      .finally(() => {
        this._openSettingsPromptPromise = undefined
      })
  }

  checkPermissions() {
    return PushNotifications.checkPermissions()
      .then(response => {
        this.permissionStatus = response?.receive
        return Promise.resolve(response)
      })
  }

  requestPermission() {
    return PushNotifications.requestPermissions()
      .then(response => {
        this.permissionStatus = response?.receive 
        return Promise.resolve(response)
      })
  }

  fetchDeviceId() {
    return Device.getId()
      .then(response => {
        if (!response?.uuid) throw response
        this.deviceId = response.uuid
        return this.deviceId
      })
  }

  /**
   * @param {Object} opts 
   * @param {Number} opts.timeout
   */
  fetchRegistrationToken(opts) {
    const manager = this
    return new Promise((resolve, reject) => {
      const registrationSuccessHandler = token => {
        manager.registrationToken = token?.value || token
        resolve(token)
        removeListeners()
      }
      const registrationErrorHandler = error => {
        reject(error)
        removeListeners()
      }

      const removeListeners = () => {
        this.events.removeEventListener('registration', registrationSuccessHandler)
        this.events.removeEventListener('registrationError', registrationErrorHandler)
      }

      this.events.addEventListener('registration', registrationSuccessHandler)
      this.events.addEventListener('registrationError', registrationErrorHandler)
      setTimeout(() => {
        const error = new Error('Timeout exceeded')
        error.name = 'RegistrationTokenTimeout'
        reject(error)
        removeListeners()
      }, opts?.timeout || 30 * 1000)

      PushNotifications.register()
    })
  }
}

export const pushNotificationsManager = new PushNotificationsManager()

export default boot(({ app }) => {
  if (pushNotificationsManager.isMobile) {
    const manager = reactive(
      markRaw(pushNotificationsManager)
    )

    app.config.globalProperties.$pushNotifications = manager
    app.provide('$pushNotifications', manager)

    // Pinia notification module will act as the event bus for events when user opens app using
    // push notifications, any page expected to do something when a push notification arrives
    // should be handled within the page itself
    // The reason is to have the same handlers for both cases where the app is closed/open
    const notificationStore = useNotificationsStore()
    manager.events.addEventListener(
      'pushNotificationActionPerformed',
      notificationAction => {
        console.log('Notification action:', JSON.stringify(notificationAction, null, 2))
        notificationStore.setOpenedNotification(notificationAction?.notification)
        notificationStore.handleOpenedNotification()
      },
    )
  }
})
