import vaultContractSource from "./contracts/vault.cash"
import Watchtower from 'watchtower-cash-js'
import { reverseHex } from "../utils"
import { compileString } from "cashc"
import axios from "axios"
import BCHJS from "@psf/bch-js"
import {
  Contract,
  ElectrumNetworkProvider,
} from "cashscript"


const bchjs = new BCHJS()


export class Vault {

  constructor (opts) {
    this.merchantReceiverPk = opts?.params?.merchantReceiverPk
    this.network = opts?.options?.network
    this.dust = 1000n
  }

  get contractCreationParams () {
    return [
      this.merchantReceiverPk,
    ]
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

  async claim ({ category, voucherClaimerAddress }) {
    const contract = this.getContract()
    let voucherUtxos = []
    
    while (voucherUtxos.length !== 2) {
      const utxos = await this.provider.getUtxos(contract.address)
      voucherUtxos = utxos.filter(utxo => utxo?.token?.category === category)
    }

    if (voucherUtxos.length === 0) throw new Error(`No category ${category} utxos found`)

    const lockNftUtxo = voucherUtxos.find(utxo => utxo.satoshis !== this.dust)
    const transaction = await contract.functions.claim(reverseHex(category))
      .from(voucherUtxos)
      .to(voucherClaimerAddress, lockNftUtxo.satoshis)
      .withoutTokenChange()
      .withoutChange()
      .send()

    return transaction
  }

  async refund ({ category, voucherClaimerAddress }) {
    const contract = this.getContract()
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

    const transaction = await contract.functions
      .refund()
      .from(lockNftUtxo)
      .to(voucherClaimerAddress, refundedAmount)
      .withoutTokenChange()
      .withHardcodedFee(this.dust)
      .withTime(latestBlockTimestamp)
      .send()

    return transaction
  }
  
}
