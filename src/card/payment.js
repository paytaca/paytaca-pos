import { getPrivateKeyWif } from "./user"
import { signPreimages } from "./utils"
import { backend } from "./backend"
import { getPublicKeyFromPrivate } from "./utils"
import { TapToPayContract } from "./contract/taptopay"

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

async function validatePreimages({ preimages, contractParameters, merchant, recipient}) {
  console.log('Validating preimages with contract parameters');
  // rebuild the contract from the provided parameters
  const constract = new TapToPayContract(
    contractParameters.ownerPkh,
    contractParameters.backendPkh,
    contractParameters.tokenId
  );

  // build the expected preimages based on the contract and provided parameters
  const expectedPreimages = await constract.generateSpendPreimages({
    backendPkh: contractParameters.backendPkh,
    merchant: merchant,
    recipient: recipient
  });
  console.log('expectedPreimages:', expectedPreimages);

  // Compare the expected preimages with the provided preimages
  if (expectedPreimages.length !== preimages.length) {
    throw new Error('Preimage validation failed: length mismatch');
  }

  for (let i = 0; i < expectedPreimages.length; i++) {
    if (expectedPreimages[i].preimage !== preimages[i].preimage) {
      throw new Error(`Preimage validation failed at index ${i}`);
    }
  }

  console.log('Preimage validation successful');
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
  
  const { piccData, cmac } = await parseUrl(url);

  console.log('piccData:', piccData);
  console.log('cmac:', cmac)
  console.log('receivingAddress:', receivingAddress);
  console.log('merchantId:', merchantId);
  console.log('uid:', uid);
  console.log('amountSats:', amountSats);
  console.log('contractParameters:', contractParameters);
  
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
  const preimages = data.preimages;
  console.log('preimages to sign:', preimages);

  // Validate if preimages are correct
  const merchant = { 
    id: merchantId,
    pubkey: getPublicKeyFromPrivate(privkey)
  }
  const recipient = { 
    address: receivingAddress, 
    amount: amountSats 
  }
  console.log('contractParameters:', contractParameters);
  console.log('merchant:', merchant);
  console.log('recipient:', recipient);

  // await validatePreimages({ 
  //   preimages, 
  //   contractParameters, 
  //   merchant: merchant, 
  //   recipient: recipient
  // });

  const signatures = await signPreimages({
    preimages,
    wif: privkey
  });

  console.log('signatures:', signatures);

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
  
  return spendResponse.data
}