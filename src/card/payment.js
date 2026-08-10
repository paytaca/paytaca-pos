import { getPrivateKeyWif } from "./user"
import { signPreimages } from "./utils"
import { backend } from "./backend"
import { cardSocket } from "./socket"
import { getPublicKeyFromPrivate } from "./utils"
import { TapToPayContract } from "./contract/taptopay"

const SOCKET_CONNECT_TIMEOUT_MS = 5000


/**
 * Parses the NFC URL to extract the piccData and cmac values.
 * @param {string} url - The NFC URL containing the piccData and cmac values
 * @returns {Promise<{ piccData: string, cmac: string }>} The parsed piccData and cmac values from the URL
 */
async function parseUrl(url) {  
    if (!url) {
        throw new Error('Missing NFC URL')
    }

    let parsedUrl
    try {
        parsedUrl = new URL(url)
    } catch (error) {
        throw new Error('Invalid NFC URL format')
    }

    const piccData = parsedUrl.searchParams.get('e') || parsedUrl.searchParams.get('E')
    const cmac = parsedUrl.searchParams.get('c') || parsedUrl.searchParams.get('C')

    if (!piccData || !cmac) {
        throw new Error('Invalid NFC URL: missing e or c query parameter')
    }

    return { piccData, cmac }
}

/**
 * Validates the server provided preimages against the expected preimages generated locally.
 * @param {{ preimages: Array, contractParameters: Object, merchant: Object, recipient: Object }} param0
 * @param {Array} param0.preimages - The preimages to validate
 * @param {Object} param0.contractParameters - The contract parameters for rebuilding the contract
 * @param {string} param0.contractParameters.backendPk - The backend public key
 * @param {string} param0.contractParameters.category - The category of the contract
 * @param {Object} param0.merchant - The merchant information
 * @param {string} param0.merchant.id - The merchant ID
 * @param {string} param0.merchant.pubkey - The merchant public key
 * @param {Object} param0.recipient - The recipient information
 * @param {string} param0.recipient.address - The recipient Bitcoin address
 * @param {bigint} param0.recipient.amount - The amount to send in satoshis
 * @returns {Promise<void>} Resolves if validation is successful, otherwise throws an error
 */
async function validatePreimages({ preimages, contractParameters, merchant, recipient}) {
  // time the validation process
  console.log('Validating preimages...');
  const startTime = performance.now();

  // rebuild the contract from the provided parameters
  const contract = new TapToPayContract(
    contractParameters.backendPk,
    contractParameters.category
  );

  // build the expected preimages based on the contract and provided parameters
  const { preimages: expectedPreimages } = await contract.generateSpendPreimages({
    merchant: merchant,
    recipient: recipient
  });

  // Compare the expected preimages with the provided preimages
  if (preimages.length !== expectedPreimages.length) {
    throw new Error('Preimage validation failed: length mismatch');
  }

  for (let i = 0; i < preimages.length; i++) {
    if (preimages[i].preimage !== expectedPreimages[i].preimage) {
      throw new Error(`Preimage validation failed at index ${i}`);
    }
  }

  const endTime = performance.now();
  console.log(`Preimage validation successful in ${(endTime - startTime) / 1000} seconds`);
}

/**
  * Requests preimages from the backend, preferring the persistent WebSocket and
  * falling back to HTTPS when the socket is unavailable or errors.
  * @param {Object} params
  * @param {string} params.merchantId - The ID of the merchant receiving the payment
  * @param {string} params.receivingAddress - The Bitcoin address to receive the payment
  * @param {number} params.amountSats - The amount to spend in satoshis
  * @param {string} params.piccData - The piccData value from the NFC URL
  * @param {string} params.cmac - The cmac value from the NFC URL
  * @returns {Promise<object>} The preimage response data
  */
async function requestPreimages({ merchantId, receivingAddress, amountSats, piccData, cmac }) {
  if (cardSocket.isConnected) {
    try {
      const data = await cardSocket.request('cards.preimage', {
        merchant_id: merchantId,
        to_address: receivingAddress,
        amount_sats: amountSats,
        picc_data: piccData,
        cmac: cmac
      });
      console.log('Preimage response (socket):', data);
      if (data?.success === false) {
        throw new Error(data.error || 'Failed to get preimages for spend transaction');
      }
      return data;
    } catch (error) {
      console.warn('Socket preimage request failed, falling back to HTTPS:', error.message);
    }
  }

  const response = await backend.post(`/cards/preimage/`, {
    merchant_id: merchantId,
    to_address: receivingAddress,
    amount_sats: amountSats,
    picc_data: piccData,
    cmac: cmac
  }).catch(error => {
    const errorMessage = error.response?.data?.error || error.message || 'Error during preimage request'
    console.error(errorMessage);
    throw new Error(errorMessage);
  });

  const data = response.data;
  console.log('Preimage response:', data);
  if (data.success === false) {
    throw new Error(data.error || 'Failed to get preimages for spend transaction');
  }
  return data;
}

/**
  * Submits the signed spend transaction, preferring the persistent WebSocket and
  * falling back to HTTPS. The signed tx payload is reused on fallback so the
  * preimages are never re-requested.
  * @param {string} uid - The card UID
  * @param {Object} params
  * @param {string} params.merchantId - The ID of the merchant receiving the payment
  * @param {Object} params.tx - The signed transaction { hex, signatures, inputs }
  * @returns {Promise<object>} The spend response data
  */
async function requestSpend(uid, { merchantId, tx }) {
  if (cardSocket.isConnected) {
    try {
      const data = await cardSocket.request('cards.spend', {
        merchant_id: merchantId,
        tx: tx
      });
      console.log('Spend response (socket):', data);
      return data;
    } catch (error) {
      console.warn('Socket spend request failed, falling back to HTTPS:', error.message);
    }
  }

  const response = await backend.post(`/cards/${uid}/spend/`, {
    merchant_id: merchantId,
    tx: tx
  }).catch(error => {
    const errorMessage = error.response?.data?.error || error.message || 'Error during spend transaction request'
    console.error(errorMessage);
    throw new Error(errorMessage);
  });

  return response.data
}

/**
  * Spends {amountSats} satoshis from the card to a specified address.
  * @param {object} params
  * @param {string} params.uid - The unique identifier of the card being used for payment
  * @param {string} params.merchantId - The ID of the merchant receiving the payment
  * @param {string} params.receivingAddress - The Bitcoin address to receive the payment
  * @param {number} params.amountSats - The amount to spend in satoshis
  * @param {string} params.url - The NFC URL containing the piccData and cmac values
  * @param {object} params.contractParameters - The contract parameters for rebuilding the contract
  * @returns {Promise<object>} The response data from the spend transaction
  */
export async function payWithCard({ uid, merchantId, receivingAddress, amountSats, url, contractParameters }) {
  // time the entire payWithCard process
  const startTime = performance.now();
  console.log('Starting payWithCard process...');

  const { piccData, cmac } = await parseUrl(url);

  // Connection-state check: make sure the persistent socket is open before
  // processing the tap. If it is not ready yet (handshake in progress or stale),
  // wait for/trigger a reconnect rather than assuming readiness. On failure the
  // per-request helpers fall back to HTTPS so taps still succeed.
  const socketReady = await cardSocket.ensureConnected({ timeout: SOCKET_CONNECT_TIMEOUT_MS });
  if (socketReady) {
    console.log('Card socket connected, using persistent WebSocket for payment.');
  } else {
    console.warn('Card socket not ready, falling back to HTTPS for payment.');
  }

  const data = await requestPreimages({
    merchantId,
    receivingAddress,
    amountSats,
    piccData,
    cmac
  });

  const privkey = await getPrivateKeyWif()
  const merchant = { 
    id: merchantId,
    pubkey: getPublicKeyFromPrivate(privkey)
  }

  const recipient = { 
    address: receivingAddress, 
    amount: amountSats 
  }

  // Validate if preimages are correct
  await validatePreimages({ 
    preimages: data.preimages,
    contractParameters, 
    merchant, 
    recipient
  });

  const preimages = data.preimages;
  const signatures = await signPreimages({
    preimages,
    wif: privkey
  });

  const spendData = await requestSpend(uid, {
    merchantId,
    tx: {
      hex: data.txHex,
      signatures: signatures,
      inputs: data.inputs
    }
  });
  
  const endTime = performance.now();
  console.log('payWithCard process completed successfully in', (endTime - startTime) / 1000, 'seconds');

  return spendData
}