import { boot } from 'quasar/wrappers'
import { ref } from 'vue'
import events from 'events'
import Ping from 'ping.js'

class NetworkDetect extends events.EventEmitter {
  static windowEvents = ['online', 'offline', 'load']
  
  constructor(opts) {
    super()

    this._ping = new Ping()
    this._pingUrl = opts?.url || 'https://google.com'
    this.check().then(isOnline => this.isOnline = isOnline)
    this._windowEventListener = () => this.check()
    this.initWindowEvents()
  }

  async check() {
    let isOnline
    try {
      const ping = await this._ping.ping(this._pingUrl)
      if (ping || navigator.onLine) isOnline = true
    } catch(error) {
      isOnline = false
    }
    if (isOnline !== this.isOnline) this.emit('network-change', isOnline)
    this.isOnline = isOnline
    return Promise.resolve(this.isOnline)
  }

  initWindowEvents() {
    NetworkDetect.windowEvents.forEach(event => {
      window.removeEventListener(event, this._windowEventListener)
    })
    NetworkDetect.windowEvents.forEach(event => {
      window.addEventListener(event, this._windowEventListener)
    })
  }
}

export default boot(({app}) => {
  const isOnline = ref(false)
  const networkDetect = new NetworkDetect()
  networkDetect.check().then(_isOnline => isOnline.value = _isOnline)
  networkDetect.on('network-change', _isOnline => isOnline.value = _isOnline)

  app.config.globalProperties.$isOnline = isOnline
  app.provide('$isOnline', isOnline)

  app.config.globalProperties.$networkDetect = networkDetect
  app.provide('$networkDetect', networkDetect)
})
