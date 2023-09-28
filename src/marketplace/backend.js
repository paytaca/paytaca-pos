import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import axios from 'axios'

const AUTH_TOKEN_STORAGE_KEY = 'marketplace-api-auth-token'

export const backend = axios.create({
  baseURL: process.env.MARKETPLACE_BASE_URL || 'https://commercehub.paytaca.com/api',
})
backend.interceptors.request.use(async (config) => {
  const { value: token } = await getAuthToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})
backend.interceptors.response.use(null, async (error) => {
  if (error?.response?.status == 401) await setAuthToken(undefined).catch(console.error)
  return Promise.reject(error)
})


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
