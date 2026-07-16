import { Contract, placeholderSignature } from "cashscript";
import { createSighashPreimage, cashScriptOutputToLibauthOutput } from 'cashscript/dist/utils.js';
import { 
    convertCashAddressToTokenAddress, 
    reverseHex,
    encodeCommitment,
    decodeCommitment,
    encodeMerchantHash
} from "src/card/utils";
import { hexToBin } from "@bitauth/libauth";
import artifact from "src/card/contract/artifact.json";
import Watchtower from 'watchtower-cash-js';

const watchtower = new Watchtower()

export class TapToPayContract {
    constructor(ownerPkh, backendPkh, tokenId) {
        this.params = {
            ownerPkh: ownerPkh,
            backendPkh: backendPkh,
            tokenId: tokenId
        };
    }
    
    /**
     * Contract creation parameters extracted from the on-chain contract.
     * @returns {{ ownerPkh: string, backendPkh: string, tokenId: string }}
     */
    get contractCreationParams () {
        return {
            ownerPkh: this.params.ownerPkh,
            backendPkh: this.params.backendPkh,
            tokenId: this.params.tokenId,
        };
    }

    /**
     * Builds and returns a CashScript contract instance.
     * @returns {Contract}
     */
    getContract () {
        const contractCreationParams = this.contractCreationParams
        const contractParams = [
            contractCreationParams.ownerPkh,
            contractCreationParams.backendPkh,
            contractCreationParams.tokenId
        ];

        const contract = new Contract(artifact, contractParams)
        return contract;
    }

    async getBchUtxos () {
        const cashAddress = this.getContract().address
        console.log(`Fetching BCH UTXOs for address ${cashAddress}...`)
        try {
            const result = await watchtower.BCH.getBchUtxos(cashAddress)
            console.log('Raw BCH UTXOs:', result)

            return {
                cumulativeValue: result?.cumulativeValue,
                utxos: result?.utxos?.map(utxo => ({
                    txid: utxo.tx_hash,
                    vout: utxo.tx_pos,
                    satoshis: BigInt(utxo.value)
                })) || []
            }
        } catch (error) {
            console.error(`Error fetching BCH UTXOs for address ${cashAddress}:`, error)
            return {
                cumulativeValue: 0n,
                utxos: []
            }
        }
    }

    async getTokenUtxos (tokenId, tokenAddress) {          
        console.log(`Fetching token UTXOs for tokenId ${tokenId} and tokenAddress ${tokenAddress}...`)
        let result = []
        try {
            const response = await watchtower.BCH._api.get(`utxo/ct/${tokenAddress}/${tokenId}/`, {
                params: {
                    is_cashtoken_nft: true
                }}
            )
            console.log('result:', result)
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

    estimateFee({ numInputs, numOutputs, satPerByte = 1 }) {
        const txSize = 10 + (numInputs * 300) + (numOutputs * 34)
        return BigInt(txSize * satPerByte)
    }

    async generateSpendPreimages ({ backendPkh, merchant, recipient }) {
        
        const coSignerPkh = backendPkh

        const contract = this.getContract();
        const { utxos } = await this.getBchUtxos()
        const bchUtxos = sortUtxos(utxos.filter(utxo => utxo.token === undefined))

        const tokenAddress = convertCashAddressToTokenAddress(contract.address)
        const ctUtxos = await this.getTokenUtxos(reverseHex(this.params.authCategory), tokenAddress)

        console.log('BCH UTXOs:', bchUtxos)
        console.log('CT UTXOs:', ctUtxos)
        // const ctUtxos = utxos.filter(utxo => utxo.token !== undefined)

        // Find the global auth token
        let globalAuthNft
        let merchantAuthNfts = []

        const authCategory = reverseHex(this.params.authCategory)
        ctUtxos.forEach(utxo => {
            if (utxo.token) {
                const token = utxo.token
                if (token.category === authCategory && token.nft) {
                    const commitment = utxo.token.nft.commitment
                    const decodedCommitment = commitment ? decodeCommitment(commitment) : undefined
                    const nftData = { decodedCommitment, utxo }
                    if (decodedCommitment.hash === undefined) {
                        // this is the global auth token
                        globalAuthNft = nftData
                    } else {
                        // this is a merchant-specific auth token
                        merchantAuthNfts.push(nftData)
                    }
                }
            }
        })

        let authNft

        // Uses the globalAuthNft if it is ON
        if (globalAuthNft && globalAuthNft.decodedCommitment.authorized) {
            authNft = globalAuthNft.utxo
        }

        if (!authNft) {
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

        const encodedMerchantId = Buffer.from(merchant.id, 'utf8');
        const outputs = [
            {
                to: convertCashAddressToTokenAddress(contract.address),
                amount: authNft.satoshis,
                token: authNft.token // auth token mustn't be mutated
            },
            {
                to: recipient.address,
                amount: recipient.amount
            }
            // change handled automatically
        ]
        
        const hardcodedFee = 1000n
        const estimatedFee = hardcodedFee + this.estimateFee({
            numInputs: 1 + bchUtxos.length, // authNft + bchUtxos
            numOutputs: outputs.length + 1 // outputs + change
        })

        console.log(`Estimated fee: ${estimatedFee} satoshis`)
        const tx = contract.functions
            .spend(
                encodedMerchantId,
                placeholderSignature(), 
                merchant.pubkey, 
                placeholderSignature(),
                coSignerPk
            )
            .from(authNft) // present the NFT to use as authentication
            .from(bchUtxos)
            .to(outputs)
            .withHardcodedFee(estimatedFee)

        const builtHex = await tx.build()

        const builtTx = decodeTransaction(hexToBin(builtHex))
        if (typeof builtTx === 'string') {
            throw new Error(`Failed to decode built transaction: ${builtTx}`)
        }

        const inputsForPreimage = [authNft, ...bchUtxos]
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