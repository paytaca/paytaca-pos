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
    this.dust = 1000n
  }

  get contractCreationParams () {
    return [
      this.merchantReceiverPk,
      this.merchantSignerPk,
    ]
  }

  get provider () {
    return new ElectrumNetworkProvider(this.network)
  }

  get artifact () {
    return compileString(vaultContractSource)
  }

  async getSignerWif () {
    const wif = await SecureStoragePlugin.get({
      key: 'purelypeerVaultSignerWif'
    })
    return wif.value
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

  async claim ({ category, merchantReceivingAddress }) {
    const contract = this.getContract()
    const signerWif = await this.getSignerWif()
    const merchantSignerSig = new SignatureTemplate(signerWif)
    
    const utxos = await this.provider.getUtxos(contract.address)
    const voucherUtxos = utxos.filter(utxo => utxo?.token?.category === category)

    if (voucherUtxos.length === 0) throw new Error(`No category ${category} utxos found`)

    const lockNftUtxo = voucherUtxos.find(utxo => utxo.satoshis !== this.dust)
    const transaction = await contract.functions.claim(
      reverseHex(category),
      merchantSignerSig
    )
    .from(voucherUtxos)
    .to(merchantReceivingAddress, lockNftUtxo.satoshis)
    .withoutTokenChange()
    .withoutChange()
    .send()

    return transaction
  }

  async refund ({ category, merchantReceivingAddress }) {
    const contract = this.getContract()
    const signerWif = await this.getSignerWif()
    const merchantSignerSig = new SignatureTemplate(signerWif)

    const utxos = await this.provider.getUtxos(contract.address)
    const lockNftUtxo = utxos.find(utxo =>
      utxo?.token?.category === category &&
      utxo?.satoshis !== this.dust
    )

    if (!lockNftUtxo) throw new Error(`No lock NFT of category ${category} utxos found`)

    // get latest MTP (median timestamp) from latest block
    const { mediantime } = await axios.get(`${process.env.WATCHTOWER_API}/blockchain/info/`)
    const latestBlockTimestamp = mediantime
    const refundedAmount = lockNftUtxo.satoshis - this.dust

    let transaction = await contract.functions
      .refund(merchantSignerSig)
      .from(lockNftUtxo)
      .to(merchantReceivingAddress, refundedAmount)
      .withoutTokenChange()
      .withHardcodedFee(this.dust)
      .withTime(latestBlockTimestamp)
      .send()

    return transaction
  }
  
}
