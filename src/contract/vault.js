import { SecureStoragePlugin } from "capacitor-secure-storage-plugin"
import { reverseHex } from "./utils"
import { compileFile, compileString } from "cashc"
import {
  Contract,
  ElectrumNetworkProvider,
  SignatureTemplate,
} from "cashscript"


// TODO: find a way to read vault.cash file (fs.readFileSync currently not working)
const string = `
pragma cashscript ^0.8.0;


contract Vault(
    pubkey merchantReceiverPK,
    pubkey merchantSignerPK
) {

    function claim(
        bytes32 keyNftCategory,
        sig merchantSignerSig
    ) {
        require(checkSig(merchantSignerSig, merchantSignerPK));

        // 2 outputs: lock & key nft
        // 1 output: recipient of BCH stored in lock NFT
        require(tx.inputs.length >= 2);
        require(tx.outputs.length >= 1);

        // key NFT must be an immutable NFT
        require(tx.inputs[1].tokenCategory == keyNftCategory);

        // lock & key nft must have the same commitment
        // 20 bytes - questOwnerPubkeyHash
        // 10 bytes - collection timestamp
        // 10 bytes - claim amount
        require(tx.inputs[0].nftCommitment == tx.inputs[1].nftCommitment);

        // sent amount must be equal to the commitment data
        bytes amountAndTimestampBytes = tx.inputs[1].nftCommitment.split(20)[1];
        bytes feeAmountBytes = amountAndTimestampBytes.split(10)[1];
        int feeAmount = int(feeAmountBytes);
        require(tx.outputs[0].value == feeAmount);

        // the amount sent must be from lock nft's output
        require(tx.inputs[this.activeInputIndex].value == feeAmount);

        // the funds must be sent to the merchant receiving address
        bytes20 merchantPKH = hash160(merchantReceiverPK);
        bytes25 merchant = new LockingBytecodeP2PKH(merchantPKH);
        require(tx.outputs[0].lockingBytecode == merchant);
    }

}
`

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
    const artifact = compileString(string)
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
