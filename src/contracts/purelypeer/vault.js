import { SecureStoragePlugin } from "capacitor-secure-storage-plugin"
import vaultContractSource from "./contracts/vault.cash"
import Watchtower from 'watchtower-cash-js'
import { reverseHex } from "../utils"
import { compileString } from "cashc"
import axios from "axios"
import BCHJS from "@psf/bch-js"
import {
  Contract,
  ElectrumNetworkProvider,
  SignatureTemplate,
} from "cashscript"


const bchjs = new BCHJS()


export class Vault {

  constructor (opts) {
    this.merchantReceiverPk = opts?.params?.merchantReceiverPk
    this.merchantSignerPk = opts?.params?.merchantSignerPk
    this.network = opts?.options?.network
    this.feeFunder = opts?.feeFunder
  }

  get contractCreationParams () {
    return [
      this.merchantReceiverPk,
      this.merchantSignerPk,
    ]
  }

  get signerWif () {
    return SecureStoragePlugin.get({ key: 'purelypeerVaultSignerWif' })
  }

  get provider () {
    return new ElectrumNetworkProvider(this.network)
  }

  get artifact () {
    return compileString(vaultContractSource)
  }

  getContract () {
    const contract = new Contract(
      this.artifact,
      this.contractCreationParams,
      { provider: this.provider }
    )

    const bytesize = contract.bytesize
    const opcount = contract.opcount
    
    if (opcount > 201) throw new Error(`Opcount max size is 201 bytes. Got ${opcount}`)
    if (bytesize > 520) throw new Error(`Bytesize max is 520 bytes. Got ${bytesize}`)

    return contract
  }

  async claim ({ keyNftCategory, lockNftCategory, merchantReceivingAddress }) {
    const contract = this.getContract()
    const merchantSignerSig = new SignatureTemplate(this.signerWif)
    
    const utxos = await this.provider.getUtxos(contract.address)
    const keyNftUtxo = utxos.find(utxo => utxo?.token?.category === keyNftCategory)
    const lockNftUtxo = utxos.find(utxo => utxo?.token?.category === lockNftCategory)

    if (!keyNftUtxo) throw new Error(`No key NFT of category ${keyNftCategory} utxos found`)
    if (!lockNftUtxo) throw new Error(`No lock NFT of category ${lockNftCategory} utxos found`)
    
    const transaction = contract.functions.claim(
      reverseHex(keyNftCategory),
      merchantSignerSig
    )
    .from([ lockNftUtxo, keyNftUtxo ])
    .to(merchantReceivingAddress, lockNftUtxo.satoshis)
    .withoutTokenChange()
    .withoutChange()
    .send()

    return transaction
  }

  async refund ({ lockNftCategory, merchantReceivingAddress }) {
    const contract = this.getContract()
    const merchantSignerSig = new SignatureTemplate(this.signerWif)

    const utxos = await this.provider.getUtxos(contract.address)
    const lockNftUtxo = utxos.find(utxo => utxo?.token?.category === lockNftCategory)

    if (!lockNftUtxo) throw new Error(`No lock NFT of category ${lockNftCategory} utxos found`)

    // get latest MTP (median timestamp) from latest block
    const { mediantime } = await axios.get('https://watchtower.cash/api/blockchain/info/')
    const latestBlockTimestamp = mediantime

    let transaction = contract.functions
      .refund(merchantSignerSig)
      .from(lockNftUtxo)
      .to(merchantReceivingAddress, lockNftUtxo.satoshis)
      .withoutTokenChange()
      .withHardcodedFee(1000n)
      .withTime(latestBlockTimestamp)

    transaction = await this.fundTransaction(transaction)
    transaction = await transaction.send()
    return transaction
  }

  async fundTransaction (transaction) {
    let fundingUtxos = await this.provider.getUtxos(this.feeFunder.address)
    
    fundingUtxos = fundingUtxos.filter(
      utxo => !utxo?.token && utxo?.satoshis
    ).map(utxo => {
      utxo.wif = this.feeFunder.wif
      return utxo
    })

    let temp = transaction.address
    transaction.address = this.feeFunder.address
  
    for (var i = 0; i < fundingUtxos?.length; i++) {
      const utxo = fundingUtxos?.[i]
      try {
        await transaction.setInputsAndOutputs()
        break
      } catch(error) {
        if (!error?.message?.startsWith?.('Insufficient funds')) throw error
        if (utxo.wif) {
          const keyPair = bchjs.ECPair.fromWIF(utxo.wif)
          const sig = new SignatureTemplate(keyPair)
          transaction.fromP2PKH(utxo, sig)
        } else {
          transaction.from(utxo)
        }
      }
    }
  
    await transaction.setInputsAndOutputs()
    transaction.address = temp
    return transaction
  }
  
}
