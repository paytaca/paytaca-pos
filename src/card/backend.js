import axios from 'axios'
import { getAuthToken } from './user'
import { useWalletStore } from 'src/stores/wallet'
import { CARD_API_BASE_URL } from './config.js'

if (!process.env.CARD_API_BASE_URL && process.env.NODE_ENV === 'development') {
  console.warn('[card/backend] CARD_API_BASE_URL is not set, using development localhost fallback')
}

export const backend = axios.create({
  baseURL: CARD_API_BASE_URL,
  timeout: 100000,
  headers: {
    'Content-Type': 'application/json',
  },
})

backend.interceptors.request.use(async (config) => {
  if (config.authorize === false) {
    return config
  }
  const walletStore = useWalletStore();
  config.headers = config.headers || {}
  config.headers['public-key'] = walletStore.authPublicKey
  try {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
  } catch (_) {
    // A missing session is handled by the endpoint-specific authentication
    // flow. Never include storage errors or credentials in request logs.
  }
  return config
})
