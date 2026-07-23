import { getPrivateKeyWif } from "./user"
import { signPreimages } from "./utils"
import { backend } from "./backend"
import { getPublicKeyFromPrivate } from "./utils"
import { TapToPayContract } from "./contract/taptopay"


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

  const spendResponse = await backend.post(`/cards/${uid}/spend/`, {
    merchant_id: merchantId,
    tx: {
      hex: data.txHex,
      signatures: signatures,
      inputs: data.inputs
    }
  }).catch(error => {
    const errorMessage = error.response?.data?.error || error.message || 'Error during spend transaction request'
    console.error(errorMessage);
    throw new Error(errorMessage);
  });
  
  const endTime = performance.now();
  console.log('payWithCard process completed successfully in', (endTime - startTime) / 1000, 'seconds');

  return spendResponse.data
}