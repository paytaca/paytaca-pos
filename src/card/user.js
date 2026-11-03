import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { useWalletStore } from 'stores/wallet'
import { backend } from './backend.js';
import { loadSignerFromWIF } from './keypair.js';
import { getPublicKeyFromPrivate } from './utils.js';
import { CARD_API_BASE_URL } from './config.js'
import { createCardAuthStorage } from './auth-storage.js'
import { isCardAuthenticationError } from './errors.js'

const authStorage = createCardAuthStorage(SecureStoragePlugin, CARD_API_BASE_URL)
const WIF_STORAGE_KEY = 'card-auth-wif'
let reauthenticationPromise = null

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
        this.id = data?.ref_id;
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
        const privateKeyWif = await getPrivateKeyWif();
        user.signer = loadSignerFromWIF(privateKeyWif);
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
            const { data: { challenge } } = await backend.post('/auth/merchant/challenge/', payload);
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
            const verifyResponse = await backend.post('/auth/merchant/verify/', body);
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
        return await MerchantUser.createWithSigner(response.data);
    } catch (error) {
        throw error;
    }
}

async function refreshCardSocketAuthentication() {
    const { cardSocket } = await import('./socket.js');
    await cardSocket.refreshAuthentication();
}

/**
 * Clears the current backend's session and performs the existing
 * challenge/signature login. This is deliberately separate from transaction
 * requests so it can never replay a spend or finalization request.
 */
export function reauthenticateCardMerchant() {
    if (reauthenticationPromise) return reauthenticationPromise;

    reauthenticationPromise = (async () => {
        const privateKeyWif = await getPrivateKeyWif();
        if (!privateKeyWif) {
            throw new Error('No private key WIF found for current wallet');
        }

        await clearAuthToken();
        const signer = loadSignerFromWIF(privateKeyWif);
        const publicKey = signer.keypair().publicKey;
        const user = await MerchantUser.createWithSigner({ public_key: publicKey });
        await user.login();

        // A socket may have been warmed up with the invalid session before the
        // HTTP request discovered it. Refresh its handshake without replaying
        // any card transaction.
        await refreshCardSocketAuthentication();
        return fetchCardMerchantUser(publicKey);
    })().finally(() => {
        reauthenticationPromise = null;
    });

    return reauthenticationPromise;
}

/**
 * Loads MerchantUser for active wallet and ensures authenticated session.
 * @returns {Promise<MerchantUser>}
 */
export async function loadCardMerchantUser() {
    try {
        const privateKeyWif = await getPrivateKeyWif();
        if (!privateKeyWif) {
            throw new Error('No private key WIF found for current wallet');
        }

        const signer = loadSignerFromWIF(privateKeyWif);
        const publicKey = signer.keypair().publicKey;
        const user = await fetchCardMerchantUser(publicKey);
        
        if (!user || !user.is_authenticated) {
            await user.login();
            await refreshCardSocketAuthentication();
        }
        
        return user;
    } catch (error) {
        if (isCardAuthenticationError(error)) {
            return reauthenticateCardMerchant();
        }
        if (error.response && error.response.status === 404) {
            await clearAuthToken().catch(() => {
                // Do not mask the original 404 with storage cleanup noise.
                console.warn('Unable to clear card auth session after 404')
            });
        }
        throw error;
    }
}

/**
 * Reads the full auth session from secure storage.
 * @returns {Promise<object|string|null>}
 */
export async function getAuthSession () {
    return authStorage.getSession();
}

/**
 * Returns the auth token string from secure storage.
 * @returns {Promise<string|null>}
 */
export async function getAuthToken () {
    return authStorage.getToken();
}

/**
 * Persists auth token or session object into secure storage.
 * @param {string|object} value
 * @returns {Promise<string|undefined>}
 */
export async function saveAuthToken (value) {
    return authStorage.save(value);
}

/**
 * Clears auth token from secure storage.
 * @returns {Promise<void>}
 */
export async function clearAuthToken () {
    return authStorage.clear();
}

export async function savePrivateKeyWif(wif) {
    console.log('Saving private key WIF...');
    try {
        const storedValue = typeof wif === 'string' ? wif : JSON.stringify(wif);
        const result = await SecureStoragePlugin.set({ key: WIF_STORAGE_KEY, value: storedValue });

        const publicKey = getPublicKeyFromPrivate(wif);
        const walletStore = useWalletStore();
        walletStore.setAuthPublicKey(publicKey);

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
        await SecureStoragePlugin.remove({ key: WIF_STORAGE_KEY })
        console.log('Private key WIF deleted');
    } catch (error) {
        if (isMissingSecureStorageKeyError(error)) {
            console.log('Private key WIF already cleared')
            return
        }
        console.error('Failed to clear private key WIF:', error);
        throw error;
    }
}
