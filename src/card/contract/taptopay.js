import { Contract, placeholderSignature } from "cashscript0.11.5";
import { createSighashPreimage, cashScriptOutputToLibauthOutput } from 'cashscript/dist/utils.js';
import { scriptToBytecode } from '@cashscript/utils';
import { 
    toTokenAddress, 
    reverseHex,
    decodeCommitment,
    encodeMerchantHash,
    decodeOwnershipCommitment,
    sortUtxos,
    pubkeyToPkHash
} from "src/card/utils";
import { binToHex, decodeTransaction, hexToBin } from '@bitauth/libauth';
import artifact from "src/card/contract/artifact.json";
import Watchtower from 'watchtower-cash-js0.3.1';

const watchtower = new Watchtower()

export class TapToPayContract {
    constructor(backendPk, category) {
        this.params = {
            backendPk: backendPk,
            backendPkh: pubkeyToPkHash(backendPk),
            category: category
        };
    }
    
    /**
     * Contract creation parameters extracted from the on-chain contract.
     * @returns {{ backendPkh: string, category: string }}
     */
    get contractCreationParams () {
        return {
            backendPkh: this.params.backendPkh,
            category: reverseHex(this.params.category),
        };
    }

    /**
     * Builds and returns a Cashscript contract instance.
     * @returns {Contract}
     */
    getRawContract () {
        const contractCreationParams = this.contractCreationParams
        const contractParams = [
            contractCreationParams.backendPkh,
            contractCreationParams.category
        ];

        const contract = new Contract(artifact, contractParams)
        return contract;
    }

    /**
     * Estimates the transaction fee based on the number of inputs and outputs.
     * @param {{ numInputs: number, numOutputs: number, satPerByte?: number }} param0
     * @param {number} param0.numInputs - The number of inputs in the transaction
     * @param {number} param0.numOutputs - The number of outputs in the transaction
     * @param {number} [param0.satPerByte=1] - The fee rate in satoshis per byte (default is 1)
     * @returns {bigint}
     */
    estimateFee({ numInputs, numOutputs, satPerByte = 1 }) {
        const txSize = 10 + (numInputs * 300) + (numOutputs * 34)
        return BigInt(txSize * satPerByte)
    }

    /**
     * Fetches BCH UTXOs of the contract.
     * @returns {Promise<{ cumulativeValue: bigint, utxos: Array }>}
     */
    async getBchUtxos () {
        const address = this.getRawContract().address
        let result = { cumulativeValue: 0, utxos: [] }

        result = await watchtower.BCH.getBchUtxos(address)
        return {
            cumulativeValue: result.cumulativeValue,
            utxos: result.utxos.map(utxo => ({
                txid: utxo.tx_hash,
                vout: utxo.tx_pos,
                satoshis: utxo.value,
                address_path: utxo.address_path,
                wallet_index: utxo.wallet_index
            }))
        }
    }

    /**
     * Fetches token UTXOs for a given token ID and token address.
     * @param {string} tokenId - The tokenId or category of the token to fetch
     * @param {string} tokenAddress - The token address that holds the token UTXOs
     * @returns {Promise<Array>}
     */
    async getTokenUtxos(tokenId, tokenAddress) {
        let result = []
        try {
            const response = await watchtower.BCH._api.get(`utxo/ct/${tokenAddress}/${tokenId}/`, {
                params: {
                    is_cashtoken_nft: true
                }}
            )
            result = response.data?.utxos?.map(utxo => ({
                txid: utxo.txid,
                token: {
                    category: utxo.tokenid,
                    amount: BigInt(utxo.amount),
                    nft: {
                        capability: utxo.capability,
                        commitment: utxo.commitment,
                    }
                },
                vout: utxo.vout,
                satoshis: BigInt(utxo.value)
            })) || []
        } catch (error) {
            console.error('Error fetching token UTXOs:', error)
        }
        return result
    }

    /**
     * Gets the token address of the contract.
     * @returns {string} The token address
     */
    getTokenAddress() {
        const contract = this.getRawContract();
        return toTokenAddress(contract.address);
    }

    /**
     * Gets the merchant authentication category and the corresponding auth ownership token.
     * @returns {Promise<{ authOwnershipToken: Object, authCategory: string }>} The auth ownership token and its category
     */
    async getMerchantAuthCategory () {
        // Get ownership tokens
        const ownershipCategory = this.params.category
        const tokenAddress = this.getTokenAddress()
        const ownershipTokens = await this.getTokenUtxos(ownershipCategory, tokenAddress)

        // Find the auth ownership token
        let authCategory
        const authOwnershipToken = ownershipTokens.find(utxo => {
            const decodedCommitment = utxo.token?.nft?.commitment ? decodeOwnershipCommitment(utxo.token.nft.commitment) : undefined
            if (decodedCommitment.type === 'cat') {
                authCategory = decodedCommitment.value
                return true
            }
            return false
        })

        return { authOwnershipToken, authCategory };
    }

    /**
     * Generates the spend preimages for a spend transaction.
     * @param {{ merchant: Object, recipient: Object }} param0
     * @param {Object} param0.merchant - The merchant information
     * @param {string} param0.merchant.id - The merchant ID
     * @param {string} param0.merchant.pubkey - The merchant public key
     * @param {Object} param0.recipient - The recipient information
     * @param {string} param0.recipient.address - The recipient Bitcoin address
     * @param {bigint} param0.recipient.amount - The amount to send in satoshis
     * @returns {Promise<{ txHex: string, preimages: Array }>} The built transaction hex and preimages
     */
    async generateSpendPreimages({ merchant, recipient }) {
        const backendPk = this.params.backendPk
        const contract = this.getRawContract();
        const { utxos } = await this.getBchUtxos()
        const bchUtxos = sortUtxos(utxos.filter(utxo => utxo.token === undefined))
        const tokenAddress = this.getTokenAddress()
        const {authOwnershipToken, authCategory: merchantAuthCategory} = await this.getMerchantAuthCategory()
        const authTokenUtxos = await this.getTokenUtxos(merchantAuthCategory, tokenAddress)

        // Segregate the global auth token and merchant-specific auth tokens
        let globalAuthNft
        let merchantAuthNfts = []
        authTokenUtxos.forEach(utxo => {
            if (utxo.token) {
                const token = utxo.token
                if (token.category === merchantAuthCategory && token.nft) {
                    const commitment = utxo.token.nft.commitment
                    const decodedCommitment = commitment ? decodeCommitment(commitment) : undefined
                    const nftData = { decodedCommitment, utxo }
                    if (decodedCommitment.hash === undefined) {
                        // this is the global auth token
                        globalAuthNft = nftData
                    } else {
                        // these are merchant-specific auth token
                        merchantAuthNfts.push(nftData)
                    }
                }
            }
        })

        // Use the globalAuthNft if it is ON
        let authNft
        let useGlobalAuthNft = globalAuthNft && globalAuthNft.decodedCommitment.authorized
        
        if (useGlobalAuthNft) {
            authNft = globalAuthNft.utxo
        } else {
            const {hex: merchantHash} = encodeMerchantHash({
                merchantId: merchant.id,
                merchantPk: merchant.pubkey
            })
            const merchantAuthNft = merchantAuthNfts.find(nft => {
                return nft.decodedCommitment.hash === merchantHash
            })
            authNft = merchantAuthNft ? merchantAuthNft.utxo : undefined
        }

        if (!authNft) {
            throw new Error('No valid authentication NFT found for this merchant')
        }

        const inputs = [
            authOwnershipToken,
            authNft,
            ...bchUtxos
        ]

        const merchantId = merchant.id.toString()
        const encodedMerchantId = Buffer.from(merchantId, 'utf8');
        const outputs = [
            {
                to: toTokenAddress(contract.address),
                amount: authOwnershipToken.satoshis,
                token: authOwnershipToken.token // auth ownership token not mutated
            },
            {
                to: toTokenAddress(contract.address),
                amount: authNft.satoshis,
                token: authNft.token // merchant auth token not mutated
            },
            {
                to: recipient.address,
                amount: BigInt(recipient.amount)
            }
            // change handled automatically
        ]

        const tx = contract.functions
            .spend(
                encodedMerchantId,
                placeholderSignature(), 
                merchant.pubkey, 
                placeholderSignature(),
                backendPk
            )
            .from(inputs)
            .to(outputs)

        const builtHex = await tx.build()
        const builtTx = decodeTransaction(hexToBin(builtHex))
        if (typeof builtTx === 'string') {
            throw new Error(`Failed to decode built transaction: ${builtTx}`)
        }

        const inputsForPreimage = inputs
        const sourceOutputs = inputsForPreimage.map(utxo => cashScriptOutputToLibauthOutput({
            to: utxo.token ? contract.tokenAddress : contract.address,
            amount: utxo.satoshis,
            token: utxo.token
        }))

        const preimagePerInput = []
        for (let i = 0; i < inputsForPreimage.length; i++) {
            const preimage = createSighashPreimage(
                builtTx, 
                sourceOutputs,
                i,
                scriptToBytecode(contract.redeemScript),
                0x41
            )
            preimagePerInput.push({
                inputIndex: i,
                preimage: binToHex(preimage)
            })
        }

        return {
            txHex: builtHex,
            preimages: preimagePerInput
        }
    }
}