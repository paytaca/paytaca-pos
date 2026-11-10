import { placeholderSignature } from 'cashscript0.11.5'
import {
  createSighashPreimage,
  cashScriptOutputToLibauthOutput,
} from 'cashscript/dist/utils.js'
import { scriptToBytecode } from '@cashscript/utils'
import { binToHex, utf8ToBin } from '@bitauth/libauth'
import { decodeCommitment, encodeMerchantHash, sortUtxos } from '../utils.js'
import { buildWithServerLocktime, decodeServerTransaction } from './locktime.js'
import { selectV2FtUtxos, selectV2BchUtxos } from './ft-selection.js'

export async function buildSpendPreimages({
  contract,
  version,
  revision = 'current',
  backendPk,
  merchant,
  recipient,
  bchUtxos,
  authOwnershipToken,
  authCategory,
  authTokenUtxos,
  ftUtxos = [],
  locktime,
  timing,
}) {
  const hasCategory = recipient.token_category != null
  const hasAmount = recipient.token_amount != null
  if (hasCategory !== hasAmount)
    throw new Error('Both token category and amount are required')
  const isFt = hasCategory && hasAmount
  if (isFt && version !== 2)
    throw new Error('Fungible token payments require a V2 contract')
  if (
    isFt &&
    (!/^[0-9a-f]{64}$/i.test(recipient.token_category) ||
      !/^[1-9][0-9]*$/.test(String(recipient.token_amount)))
  ) {
    throw new Error('Invalid fungible token category or amount')
  }
  if (!authOwnershipToken) throw new Error('Missing contract ownership token')
  let globalAuth
  const merchantAuth = []
  for (const utxo of authTokenUtxos) {
    if (utxo.token?.category !== authCategory || !utxo.token.nft) continue
    const commitment = utxo.token.nft.commitment
    if (typeof commitment !== 'string' || /^(?:0x)?02/i.test(commitment))
      continue
    const decoded = decodeCommitment(commitment)
    const item = { utxo, decoded }
    if (decoded.hash === undefined) globalAuth = item
    else merchantAuth.push(item)
  }
  const merchantHash = encodeMerchantHash({
    merchantId: merchant.id,
    merchantPk: merchant.pubkey,
  }).hex
  const authorization = globalAuth?.decoded.authorized
    ? globalAuth
    : merchantAuth.find(
        (item) => item.decoded.authorized && item.decoded.hash === merchantHash
      )
  if (!authorization)
    throw new Error('No valid authentication NFT found for this merchant')
  const authNft = authorization.utxo
  const amount = BigInt(recipient.amount)
  const limit =
    revision === 'pre-mutate-v1' && authorization.decoded.hash === undefined
      ? 100000n
      : authorization.decoded.spendLimitSats
  if (amount <= 0n || amount > limit)
    throw new Error('Spend amount exceeds authorization limit or is invalid')
  let funding = sortUtxos(bchUtxos.filter((utxo) => !utxo.token))
  let selectedFt = []
  if (isFt) {
    const availableFt = ftUtxos.filter(
      (utxo) =>
        utxo.token?.category === recipient.token_category &&
        !utxo.token.nft &&
        BigInt(utxo.token.amount ?? 0) > 0n
    )
    const picked = selectV2FtUtxos(availableFt, BigInt(recipient.token_amount))
    selectedFt = picked.ftUtxos
    funding = selectV2BchUtxos(funding, {
      totalFtSats: selectedFt.reduce(
        (sum, utxo) => sum + BigInt(utxo.satoshis),
        0n
      ),
      merchantDust: amount,
      ftChangeAmount: picked.selectedFtAmount - BigInt(recipient.token_amount),
      ftLen: selectedFt.length,
      feeFn: (numInputs, numOutputs) =>
        BigInt(10 + numInputs * 1500 + numOutputs * 34),
    })
  }
  const inputs = [authOwnershipToken, authNft, ...selectedFt, ...funding]
  const refs = inputs.map((input) => `${input.txid}:${input.vout}`)
  if (new Set(refs).size !== refs.length)
    throw new Error('Duplicate contract inputs')
  const outputs = [
    ...inputs
      .slice(0, 2)
      .map((input) => ({
        to: contract.tokenAddress,
        amount: BigInt(input.satoshis),
        token: input.token,
      })),
    {
      to: recipient.address,
      amount,
      ...(isFt
        ? {
            token: {
              category: recipient.token_category,
              amount: BigInt(recipient.token_amount),
            },
          }
        : {}),
    },
  ]
  const tx = contract.functions
    .spend(
      utf8ToBin(String(merchant.id)),
      placeholderSignature(),
      merchant.pubkey,
      placeholderSignature(),
      backendPk
    )
    .from(inputs)
    .to(outputs)
  const build = () => buildWithServerLocktime(tx, locktime)
  const txHex = await (timing
    ? timing.stage('validation_tx_build', build)
    : build())
  const transaction = decodeServerTransaction(txHex)
  const sourceOutputs = inputs.map((input) =>
    cashScriptOutputToLibauthOutput({
      to: input.token ? contract.tokenAddress : contract.address,
      amount: BigInt(input.satoshis),
      token: input.token,
    })
  )
  const preimages = inputs.map((_, inputIndex) => ({
    inputIndex,
    preimage: binToHex(
      createSighashPreimage(
        transaction,
        sourceOutputs,
        inputIndex,
        scriptToBytecode(contract.redeemScript),
        0x41
      )
    ),
  }))
  return { txHex, preimages, inputs }
}
