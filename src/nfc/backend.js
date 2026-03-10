import axios from 'axios'
import { getAuthToken } from './user'
import { useWalletStore } from 'src/stores/wallet'

const API_BASE_URL = process.env.CARD_API_BASE_URL || 'http://localhost:8002/api' 

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
  config.headers['wallet-hash'] = walletStore.walletHash
  await getAuthToken().then(token => {
    config.headers.Authorization = `Token ${token}`
  }).catch(error => {
    console.error('Error fetching auth token for request:', error);
  });
  return config
})