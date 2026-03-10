import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { useWalletStore } from 'stores/wallet'
import { backend } from './backend.js';
import { loadSignerFromWIF } from './keypair.js';

const TOKEN_STORAGE_KEY = 'card-auth-key'
const WIF_STORAGE_KEY = 'card-auth-wif'

/**
 * Merchant user authentication and card-data utilities.
 *
 * This module:
 * - Manages challenge/response login
 * - Loads and caches auth session data
 */

/**
 * Represents a Merchant User session.
 */
export class MerchantUser {
    /**
     * @param {object} data
     */
    constructor(data) {
        this.raw = data;
    }

    /**
     * @param {object} data
     * @returns {MerchantUser}
     */
    static parse(data) {
        return new MerchantUser(data);
    }

    /**
     * Raw response payload from backend.
     * @returns {object}
     */
    get raw() {
        return this._rawData;
    }
    
    /**
     * @param {object} data
     */
    set raw(data) {
        this._rawData = data;
        this.id = data?.id;
        this.public_key = data?.public_key;
        this.is_authenticated = data?.is_authenticated;
    }

    // ================ FACTORIES ==================

    /**
     * Creates a MerchantUser and loads the signer
     * @param {object} data
     * @returns {Promise<MerchantUser>}
     */
    static async createWithSigner(data) {
        const user = MerchantUser.parse(data);
        const wif = await getPrivateKeyWif();
        user.signer = loadSignerFromWIF(wif);
        return user;
    }

    // ================ AUTHENTICATION ==================

    /**
     * Requests an auth challenge from backend.
     * @param {string} publicKey
     * @returns {Promise<string>}
     */
    async getChallenge(publicKey) {
        try {
            const payload = { public_key: publicKey };
            const { data: { challenge } } = await backend.post('/auth/challenge/', payload);
            return challenge;
        } catch (error) {
            console.error('Failed to get challenge:', error);
            throw new Error('Failed to obtain authentication challenge');
        }
    }

    /**
     * Verifies the signed challenge and obtains session data.
     * @param {string} publicKey
     * @param {string} signature
     * @returns {Promise<object>}
     */
    async verifyChallenge(publicKey, signature) {
        try {
            const body = {
                public_key: publicKey,
                signature: signature
            };
            const verifyResponse = await backend.post('/auth/verify/', body);
            return verifyResponse.data;
        } catch (error) {
            console.error('Failed to verify challenge:', error);
            throw new Error('Challenge verification failed');
        }
    }

    /**
     * Authenticates the user by signing a challenge with the signer.
     * @returns {Promise<void>}
     */
    async login() {
        console.log('Starting Card User login process...');

        try {
            const keypair = this.signer.keypair();
        
            // obtain challenge from backend
            const challenge = await this.getChallenge(keypair.publicKey);

            // produce a signature with the challenge
            const signature = this.signer.signMessage(challenge);

            // send to backend to verify and create card session
            const loginResp = await this.verifyChallenge(keypair.publicKey, signature);
            
            // Save token if provided
            if (loginResp?.token) {
                await saveAuthToken(loginResp);
            }

        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }
}

/**
 * Fetches MerchantUser data for a wallet from backend.
 * @param {object} wallet
 * @returns {Promise<MerchantUser>}
 */
export async function fetchCardMerchantUser(publicKey) {
    try {
        const response = await backend.get(`/auth/merchant/${publicKey}/`);
        return new MerchantUser(response.data);
    } catch (error) {
        console.error('Card Merchant User fetch failed:', error.response?.status || error.message);
        throw error;
    }
}

/**
 * Loads MerchantUser for active wallet and ensures authenticated session.
 * @returns {Promise<MerchantUser>}
 */
export async function loadCardMerchantUser() {
    try {
        const keypairWif = await getPrivateKeyWif();
        if (!keypairWif) {
            throw new Error('No private key WIF found for current wallet');
        }

        const signer = loadSignerFromWIF(keypairWif);
        const publicKey = signer.keypair().publicKey;
        console.log('publicKey:', publicKey);

        const user = await fetchCardMerchantUser(publicKey);
        
        console.log('Card Merchant User loaded:', user);
        if (!user.is_authenticated) {
            await user.login();
        }
        
        return user;
    } catch (error) {
        console.error('Error loading Card Merchant User:', error);
        if (error.response && error.response.status === 404) {
            console.error('Card Merchant User not found for this wallet.');
            await clearAuthToken();
        }
        throw error;
    }
}

/**
 * Reads the full auth session from secure storage.
 * @returns {Promise<object|string|null>}
 */
export async function getAuthSession () {
    try {
        const result = await SecureStoragePlugin.get({ key: TOKEN_STORAGE_KEY });
        const rawValue = result.value;
        if (rawValue == null) {
            return null;
        }

        try {
            return JSON.parse(rawValue);
        } catch {
            return rawValue;
        }
    } catch (error) {
        console.error(`Item with key ${TOKEN_STORAGE_KEY} does not exist:`, error);
        return null;
    }
}

/**
 * Returns the auth token string from secure storage.
 * @returns {Promise<string|null>}
 */
export async function getAuthToken () {
    const session = await getAuthSession();
    if (session == null) {
        return null;
    }

    if (typeof session === 'object') {
        return session.token ?? null;
    }

    return session;
}

/**
 * Persists auth token or session object into secure storage.
 * @param {string|object} value
 * @returns {Promise<string|undefined>}
 */
export async function saveAuthToken (value) {
    console.log('Saving auth token...');
    try {
        const storedValue = typeof value === 'string' ? value : JSON.stringify(value);
        const result = await SecureStoragePlugin.set({ key: TOKEN_STORAGE_KEY, value: storedValue });
        return result.value;
    } catch (error) {
        console.error('Failed to save auth token:', error);
        throw error;
    }
}

/**
 * Clears auth token from secure storage.
 * @returns {Promise<void>}
 */
export async function clearAuthToken () {
    console.log('Clearing auth token...');
    try {
        SecureStoragePlugin.remove({ key: TOKEN_STORAGE_KEY })
        console.log('Card auth token deleted');
    } catch (error) {
        console.error('Failed to clear auth token:', error);
        throw error;
    }
}

export async function savePrivateKeyWif(wif) {
    console.log('Saving private key WIF...');
    try {
        const storedValue = typeof wif === 'string' ? wif : JSON.stringify(wif);
        const result = await SecureStoragePlugin.set({ key: WIF_STORAGE_KEY, value: storedValue });
        return result.value;
    } catch (error) {
        console.error('Failed to save private key WIF:', error);
        throw error;
    }
}

export async function getPrivateKeyWif() {
    try {
        const result = await SecureStoragePlugin.get({ key: WIF_STORAGE_KEY });
        const rawValue = result.value;
        if (rawValue == null) {
            return null;
        }

        try {
            return JSON.parse(rawValue);
        } catch {
            return rawValue;
        }
    } catch (error) {
        console.error(`Item with key ${WIF_STORAGE_KEY} does not exist:`, error);
        return null;
    }
}

export async function clearPrivateKeyWif() {
    console.log('Clearing private key WIF...');
    try {
        SecureStoragePlugin.remove({ key: WIF_STORAGE_KEY })
        console.log('Private key WIF deleted');
    } catch (error) {
        console.error('Failed to clear private key WIF:', error);
        throw error;
    }
}