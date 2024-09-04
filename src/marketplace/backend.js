import { useMarketplaceStore } from 'src/stores/marketplace';
import { HEARTBEAT_REQUEST_HEADER, useMarketplaceHeartbeatStore } from 'src/stores/marketplace-heartbeat';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import axios from 'axios'

const marketplaceStore = useMarketplaceStore()
const marketplaceHeartbeatStore = useMarketplaceHeartbeatStore()

const AUTH_TOKEN_STORAGE_KEY = 'marketplace-api-auth-token'
export const TOTP_AUTH_BASE_SECRET_KEY = process.env.MARKETPLACE_AUTH_TOTP_BASE_SECRET

export const backend = axios.create({
  baseURL: process.env.MARKETPLACE_BASE_URL || 'https://commercehub.paytaca.com/api',
})
backend.interceptors.request.use(async (config) => {
  const { value: token } = await getAuthToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  config = heartbeat.parseForRequest(config, token)
  return config
})
backend.interceptors.response.use(null, async (error) => {
  if (error?.response?.status == 401) await setAuthToken(undefined).catch(console.error)
  return Promise.reject(error)
})
backend.interceptors.response.use(
  async (response) => {
    response = heartbeat.parseResponse(response)
    return response
  },
  async (error) => {
    if (!error?.response) return error
    error.response = heartbeat.parseResponse(error?.response)
    return Promise.reject(error)
  }
)


export async function getAuthToken() {
  try {
    const authToken = await SecureStoragePlugin.get({ key: AUTH_TOKEN_STORAGE_KEY })
    return { success: true, value: authToken.value } 
  } catch(error) {
    return { success: false, error: error }
  }
}

export async function setAuthToken(value='') {
  try {
    if (value === undefined) {
      const removeResp = await SecureStoragePlugin.remove({ key: AUTH_TOKEN_STORAGE_KEY })
      return { success: removeResp.value }
    }

    const setResponse = await SecureStoragePlugin.set({ key: AUTH_TOKEN_STORAGE_KEY, value: value })
    return { success: setResponse.value }
  } catch(error) {
    console.error(error)
    return { success: false, error: error }
  }
}

const heartbeat = {
  parseForRequest(config, token) {    
    const forceHeartbeat = config?.customConfig?.forceHeartbeat
    const isLastHeartbeatExpired = marketplaceHeartbeatStore.isLastHeartbeatExpired()
    if (!isLastHeartbeatExpired && !forceHeartbeat) return config

    if (!token || !marketplaceStore.activeShopId) return config 

    config.headers[HEARTBEAT_REQUEST_HEADER] = marketplaceStore.activeShopId
    return config
  },
  /**
   * @param {Object} response
   * @param {{ headers:Object }} response.config
   */
  parseResponse(response) {
    if (!response.config.headers[HEARTBEAT_REQUEST_HEADER]) return response

    const responseHeartbeatTimestamp = parseFloat(response?.headers?.['x-heartbeat-timestamp'])
    const lastHeartbeatTimestamp = Number.isFinite(responseHeartbeatTimestamp) ? responseHeartbeatTimestamp : Date.now()
    marketplaceHeartbeatStore.lastTimestamp = lastHeartbeatTimestamp

    console.log('Updated heartbeat', marketplaceHeartbeatStore.lastTimestamp)
    return response
  },
}
