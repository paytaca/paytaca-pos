import { SecureStoragePlugin } from "capacitor-secure-storage-plugin"
import { reverseHex } from "./utils"
import { compileFile, compileString } from "cashc"
import {
  Contract,
  ElectrumNetworkProvider,
  SignatureTemplate,
} from "cashscript"

import vaultContractSource from './vault.cash'


export class Vault {

  constructor (opts) {
    this.merchantReceiverPk = opts?.params?.merchantReceiverPk
    this.merchantSignerPk = opts?.params?.merchantSignerPk
    this.network = opts?.options?.network
  }

  get contractCreationParams () {
    return [
      this.merchantReceiverPk,
      this.merchantSignerPk,
    ]
  }

  getProviderAndArtifact () {
    const provider = new ElectrumNetworkProvider(this.network)
    const artifact = compileString(vaultContractSource)
    return { provider, artifact }
  }

  getContract () {
    const { provider, artifact } = this.getProviderAndArtifact()
    const contract = new Contract(
      artifact,
      this.contractCreationParams,
      { provider }
    )

    const bytesize = contract.bytesize
    const opcount = contract.opcount
    
    if (opcount > 201) throw new Error(`Opcount max size is 201 bytes. Got ${opcount}`)
    if (bytesize > 520) throw new Error(`Bytesize max is 520 bytes. Got ${bytesize}`)

    return contract
  }

  async claim ({ keyNftCategory, lockNftCategory, merchantReceivingAddress }) {
    const { provider, artifact } = this.getProviderAndArtifact()
    const contract = this.getContract()

    const merchantSignerWif = SecureStoragePlugin.get({ key: 'purelypeerVaultSignerWif' })
    const merchantSignerSig = new SignatureTemplate(merchantSignerWif)
    
    const utxos = await provider.getUtxos(contract.address)
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
  
}
