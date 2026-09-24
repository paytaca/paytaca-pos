import { getPrivateKeyWif } from "./user"
import { signPreimages } from "./utils"
import { backend } from "./backend"
import { cardSocket, delay } from "./socket"
import { getPublicKeyFromPrivate } from "./utils"
import { TapToPayContract } from "./contract/taptopay"
import {
  NfcMaintenanceError,
  isNfcMaintenanceError,
  fetchNfcMaintenanceStatus,
  applyNfcMaintenanceErrorToCache,
  shouldBlockNfcTap,
} from "./maintenance"
import { extractServerMessage, serverError, errorTexts } from "./errors"

export { NfcMaintenanceError, isNfcMaintenanceError, extractServerMessage }

const SOCKET_CONNECT_TIMEOUT_MS = 5000

// Server-side persistence window for the preimage result (TRANSACTION_TTL_SECONDS).
// The spend step must start within this window or the server reports the tx_id as expired.
const PREIMAGE_TTL_MS = 120 * 1000
const PREIMAGE_TTL_MARGIN_MS = 5000

// Retry policy for concurrent-finalize conflicts on the spend endpoint.
const SPEND_RETRY_MAX = 3
const SPEND_RETRY_BACKOFF_MS = 250

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
 * @param {string} [param0.contractParameters.version] - The contract version reported by the backend
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
    contractParameters.category,
    contractParameters.version
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

export const FT_DUST_SATS = 1000

/**
  * Requests preimages from the backend, preferring the persistent WebSocket and
  * falling back to HTTPS when the socket is unavailable or errors.
  * For FT taps pass tokenCategory + tokenAmount (base units as string or int);
  * to_address must then be the merchant's token address and amountSats is dust.
  * Omit both token fields for a normal BCH tap.
  * cards.spend is unchanged: tx_id + signatures are replayed from the stored record.
  * @param {Object} params
  * @param {string} params.merchantId - The ID of the merchant receiving the payment
  * @param {string} params.receivingAddress - BCH address, or token address for FT taps
  * @param {number} params.amountSats - Sats to send (dust, e.g. 1000, for FT taps)
  * @param {string} params.piccData - The piccData value from the NFC URL
   * @param {string} params.cmac - The cmac value from the NFC URL
   * @param {string} [params.tokenCategory] - FT category hex, omit for BCH taps
   * @param {string|number} [params.tokenAmount] - FT base units, omit for BCH taps
   * @returns {Promise<object>} The preimage response data ({ tx_id, contract_version, txHex, preimages, inputs })
   */
function getRunningAppVersion() {
  const env = typeof process !== 'undefined' ? process.env || {} : {}
  return (
    env.APP_VERSION ||
    env.npm_package_version ||
    (typeof window !== 'undefined' && window.__POS_APP_VERSION__) ||
    ''
  )
}

async function ensureNfcNotUnderMaintenance() {
  let status
  try {
    status = await fetchNfcMaintenanceStatus(
      (path, config) => backend.get(path, config),
      getRunningAppVersion()
    )
  } catch (_) {
    return
  }
  if (status?.fetchFailed) return
  const { blocked } = shouldBlockNfcTap(status, getRunningAppVersion())
  if (blocked) {
    throw new NfcMaintenanceError({
      message: status.message,
      eta: status.eta,
      retryAfterSec: status.retryAfterSec,
    })
  }
}

async function requestPreimages({ merchantId, receivingAddress, amountSats, piccData, cmac, tokenCategory, tokenAmount }) {
  await ensureNfcNotUnderMaintenance()

  let socketMaintenanceError = null
  const buildPayload = () => {
    const payload = {
      merchant_id: merchantId,
      to_address: receivingAddress,
      amount_sats: amountSats,
      picc_data: piccData,
      cmac: cmac
    };
    if (tokenCategory != null && tokenAmount != null) {
      payload.token_category = tokenCategory;
      payload.token_amount = String(tokenAmount);
    }
    return payload;
  };

  if (cardSocket.isReady) {
    let data;
    try {
      data = await cardSocket.request('cards.preimage', buildPayload());
    } catch (error) {
      console.warn('Socket preimage request failed, falling back to HTTPS:', error.message);
    }
    if (data !== undefined) {
      console.log('Preimage response (socket):', data);
      if (data?.success === false) {
        const failure = serverError(data, 'Failed to get preimages for spend transaction');
        failure.code = data.code
        throw failure;
      }
      return data;
    } catch (error) {
      if (isNfcMaintenanceError(error)) {
        socketMaintenanceError = error
      } else {
        console.warn('Socket preimage request failed, falling back to HTTPS:', error.message);
      }
    }
  }

  const response = await backend.post(`/cards/preimage/`, buildPayload()).catch(error => {
    if (isNfcMaintenanceError(error) || socketMaintenanceError) {
      throw applyNfcMaintenanceErrorToCache(error?.response ? error : (socketMaintenanceError || error))
    }
    const failure = serverError(error.response?.data, error.message || 'Error during preimage request')
    console.error(failure.message);
    throw failure;
  });

  const data = response.data;
  console.log('Preimage response:', data);
  if (data.success === false) {
    const failure = serverError(data, 'Failed to get preimages for spend transaction');
    failure.code = data.code
    if (isNfcMaintenanceError(failure)) {
      throw applyNfcMaintenanceErrorToCache(failure)
    }
    throw failure;
  }
  if (socketMaintenanceError) {
    console.warn('Socket preimage hit maintenance but HTTPS succeeded; proceeding with HTTPS result.');
  }
  return data;
}

/**
 * True when the server rejected a concurrent-finalize attempt. Retrying the
 * same tx_id is safe and should be surfaced to the UI as retryable.
 */
function isRetryableConflictError(error) {
  return errorTexts(error).includes('already being finalized by another request')
}

/**
  * True when the persisted preimage record expired before the spend step. The
  * record cannot be revived; the full preimage -> sign -> spend flow must be
  * restarted, so the error is terminal and not worth retrying.
  */
function isExpiredTransactionError(error) {
  const message = (error?.message || '').toLowerCase().trim()
  return message.includes('transaction not found or expired')
}

/**
 * True for FT preimage rejections that should be surfaced directly:
 * missing/non-positive token amount, insufficient FT balance, or
 * insufficient BCH to cover fee and dust.
 */
export function isFtPreimageError(error) {
  const message = (error?.message || '').toLowerCase().trim()
  return message.includes('token amount is required')
    || message.includes('token amount must be positive')
    || message.includes('insufficient fungible token balance')
    || message.includes('insufficient bch to cover fee and dust')
}

/**
 * True for FT preimage rejections that should be surfaced directly:
 * missing/non-positive token amount, insufficient FT balance, or
 * insufficient BCH to cover fee and dust.
 */
export function isFtPreimageError(error) {
  const message = (error?.message || '').toLowerCase().trim()
  return message.includes('token amount is required')
    || message.includes('token amount must be positive')
    || message.includes('insufficient fungible token balance')
    || message.includes('insufficient bch to cover fee and dust')
}

/**
 * Runs a single spend attempt over the persistent WebSocket, falling back to
 * HTTPS when the socket is unavailable or errors. Because the server keys the
 * built transaction by tx_id, a lost/errored socket response can be safely
 * replayed against HTTPS: the server returns the recorded outcome without
 * rebroadcasting.
 * @param {string} uid - The card UID
 * @param {Object} params
 * @param {string} params.merchant_id - The ID of the merchant receiving the payment
 * @param {string} params.uid - The card UID echoed on the request
 * @param {string} params.tx_id - The tx_id from the preimage response
 * @param {Array<{ inputIndex: number, merchantSigHex: string }>} params.signatures
 * @returns {Promise<object>} The spend response data
 */
async function attemptSpend(uid, params) {
  if (cardSocket.isReady) {
    try {
      const data = await cardSocket.request('cards.spend', params);
      console.log('Spend response (socket):', data);
      if (data?.success === false) {
        throw serverError(data, 'Failed to finalize spend transaction');
      }
      if (data?.success === true && data?.replay === true) {
        console.warn('Spend record was already finalized by a previous attempt; replay treated as success:', data);
      }
      return data;
    } catch (error) {
      console.warn('Socket spend request failed, falling back to HTTPS:', error.message);
    }
  }

  const response = await backend.post(`/cards/${uid}/spend/`, params).catch(error => {
    const failure = serverError(error.response?.data, error.message || 'Error during spend transaction request')
    console.error(failure.message);
    throw failure;
  });

  const data = response.data;
  if (data?.success === false) {
    throw serverError(data, 'Failed to finalize spend transaction');
  }
  return data;
}

/**
  * Submits the signed spend for a preimage-recorded tx_id, preferring the
  * persistent WebSocket and falling back to HTTPS. The server looks up the
  * stored transaction by tx_id, so a lost socket response can be retried over
  * HTTPS as an idempotent replay. Concurrent-finalize conflicts are retried a
  * bounded number of times; expired-record errors are terminal.
  * @param {string} uid - The card UID
  * @param {Object} params
  * @param {string} params.merchantId - The ID of the merchant receiving the payment
  * @param {string} params.toAddress - The Bitcoin address receiving the payment (optional)
  * @param {string} params.txId - The tx_id echoed from the preimage response
  * @param {Array<{ inputIndex: number, merchantSigHex: string }>} params.signatures
  * @returns {Promise<object>} The spend response data
  */
/**
 * Spend/broadcast path is NEVER gated on card-server maintenance: in-flight
 * NFC taps must drain, not fail. No status check and no NfcMaintenanceError
 * mapping here; the existing conflict-retry behaviour is unchanged.
 */
async function requestSpend(uid, { merchantId, toAddress, txId, signatures }) {
  const params = {
    merchant_id: merchantId,
    uid: uid,
    tx_id: txId,
    signatures: signatures
  };
  if (toAddress) {
    params.to_address = toAddress;
  }

  // Bounded retries for the retryable conflict error ("Transaction is already
  // being finalized by another request; please retry"). Expired-record and
  // other errors are terminal and surface immediately.
  let retries = SPEND_RETRY_MAX;
  for (;;) {
    try {
      return await attemptSpend(uid, params);
    } catch (error) {
      if (retries > 0 && isRetryableConflictError(error)) {
        retries -= 1;
        console.warn(`Spend request conflicted, retrying (${retries} left):`, error.message);
        await delay(SPEND_RETRY_BACKOFF_MS * (SPEND_RETRY_MAX - retries));
        continue;
      }
      if (isExpiredTransactionError(error)) {
        throw new Error(`Transaction record expired or missing; please tap the card again to retry (${error.message})`);
      }
      throw error;
    }
  }
}

/**
  * Spends {amountSats} satoshis, or an FT amount, from the card.
  * For FT taps receivingAddress must be the merchant token address,
  * amountSats is dust (e.g. FT_DUST_SATS), and tokenCategory/tokenAmount
  * carry the FT transfer in base units. Omit both token fields for BCH.
  * cards.spend is unchanged: tx_id + signatures replay the stored record.
  * Note: spendLimit caps BCH sats only; dust always passes, so enforce any
  * per-tap FT cap in POS before calling.
  * @param {object} params
  * @param {string} params.uid - The unique identifier of the card being used for payment
  * @param {string} params.merchantId - The ID of the merchant receiving the payment
  * @param {string} params.receivingAddress - BCH address, or token address for FT taps
  * @param {number} params.amountSats - Sats to spend (dust for FT taps)
  * @param {string} params.url - The NFC URL containing the piccData and cmac values
  * @param {object} params.contractParameters - The contract parameters for rebuilding the contract
  * @param {string} [params.tokenCategory] - FT category hex, omit for BCH taps
  * @param {string|number} [params.tokenAmount] - FT base units, omit for BCH taps
  * @returns {Promise<object>} The response data from the spend transaction
  */
export async function payWithCard({ uid, merchantId, receivingAddress, amountSats, url, contractParameters, tokenCategory, tokenAmount }) {
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

  const isFtTap = tokenCategory != null && tokenAmount != null;
  const data = await requestPreimages({
    merchantId,
    receivingAddress,
    amountSats,
    piccData,
    cmac,
    ...(isFtTap ? { tokenCategory, tokenAmount } : {})
  });

  // The backend reports which contract version the tapped card uses. The
  // contract must be rebuilt from the matching artifact so the locally derived
  // preimages line up with the transaction the server built.
  const contractVersion = data.contract_version;
  console.log('Card contract version from preimage response:', contractVersion ?? '(default)');

  // The preimage record is bound to this server-generated tx_id for the whole
  // preimage -> card-signing -> spend flow. The spend step echoes it back.
  const txId = data.tx_id;
  if (!txId) {
    throw new Error('Preimage response did not include a tx_id; cannot finalize the spend');
  }
  const preimageReceivedAt = performance.now();

  const privkey = await getPrivateKeyWif()
  if (!privkey) {
    throw new Error('Merchant private key not found. Please enable NFC payments in Settings first.')
  }
  const merchant = { 
    id: merchantId,
    pubkey: getPublicKeyFromPrivate(privkey)
  }

  const recipient = { 
    address: receivingAddress, 
    amount: amountSats 
  }

  // Local validation rebuilds the BCH-only spend; the server-built FT tx
  // carries extra FT inputs/outputs, so FT taps skip it and rely on tx_id
  // replay from the server's stored record in the spend step.
  if (!isFtTap) {
    await validatePreimages({ 
      preimages: data.preimages,
      contractParameters: { ...contractParameters, version: contractVersion }, 
      merchant, 
      recipient
    });
  }

  const preimages = data.preimages;
  const signatures = (await signPreimages({
    preimages,
    wif: privkey
  })).map(({ inputIndex, merchantSigHex }) => ({ inputIndex, merchantSigHex }));

  // Guard against slow card signing crossing the server's record window
  // (TRANSACTION_TTL_SECONDS). If the tx_id has likely expired, a new tap is
  // required and retrying the spend would only fail.
  const elapsedMs = performance.now() - preimageReceivedAt;
  if (elapsedMs > PREIMAGE_TTL_MS - PREIMAGE_TTL_MARGIN_MS) {
    throw new Error('Spend preimage record expired; please tap the card again to retry');
  }

  const spendData = await requestSpend(uid, {
    merchantId,
    toAddress: receivingAddress,
    txId,
    signatures
  });
  
  const endTime = performance.now();
  console.log('payWithCard process completed successfully in', (endTime - startTime) / 1000, 'seconds');

  return spendData
}