import axios from 'axios'
import { getAuthToken } from './user'
import { useWalletStore } from 'src/stores/wallet'

const DEV_FALLBACK_API_BASE_URL = 'http://localhost:8002/api'
const API_BASE_URL = process.env.CARD_API_BASE_URL || (
  process.env.NODE_ENV === 'development' ? DEV_FALLBACK_API_BASE_URL : ''
)

if (!API_BASE_URL) {
  throw new Error('CARD_API_BASE_URL is required outside development builds')
}

if (!process.env.CARD_API_BASE_URL && process.env.NODE_ENV === 'development') {
  console.warn('[card/backend] CARD_API_BASE_URL is not set, using development localhost fallback')
}

export const backend = axios.create({
  baseURL: API_BASE_URL,
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
  config.headers['public-key'] = walletStore.authPublicKey
  try {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
  } catch (error) {
    console.error('Error fetching auth token for request:', error);
  }
  return config
})