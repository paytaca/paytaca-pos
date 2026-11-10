// Deterministic selection matching the contract-api V2 builder.
// Inputs are independently fetched by the POS, never adopted from the server.
export const V2_FT_DUST_SATS = 1000n

export function selectV2FtUtxos(availableFtUtxos, requestedFtAmount) {
  const target = BigInt(requestedFtAmount)
  const pool = [...availableFtUtxos].sort((a, b) => {
    const diff = BigInt(a.token.amount) - BigInt(b.token.amount)
    if (diff !== 0n) return diff < 0n ? -1 : 1
    if (a.txid === b.txid) return a.vout - b.vout
    return a.txid.localeCompare(b.txid)
  })
  const total = pool.reduce((sum, u) => sum + BigInt(u.token.amount), 0n)
  if (total < target) {
    throw new Error(
      `Insufficient fungible token balance: need ${target}, have ${total}`
    )
  }
  const single = pool.find((u) => BigInt(u.token.amount) === target)
  if (single) return { ftUtxos: [single], selectedFtAmount: target }
  const capped = pool.slice(0, 50)
  for (let i = 0; i < capped.length; i++) {
    for (let j = i + 1; j < capped.length; j++) {
      if (
        BigInt(capped[i].token.amount) + BigInt(capped[j].token.amount) ===
        target
      ) {
        return { ftUtxos: [capped[i], capped[j]], selectedFtAmount: target }
      }
    }
  }
  const covering = pool.find((u) => BigInt(u.token.amount) > target)
  if (covering) {
    return {
      ftUtxos: [covering],
      selectedFtAmount: BigInt(covering.token.amount),
    }
  }
  const picked = []
  let sum = 0n
  for (const utxo of pool) {
    picked.push(utxo)
    sum += BigInt(utxo.token.amount)
    if (sum >= target) break
  }
  return { ftUtxos: picked, selectedFtAmount: sum }
}

export function selectV2BchUtxos(
  sortedBchUtxos,
  { totalFtSats, merchantDust, ftChangeAmount, ftLen, feeFn }
) {
  const needFtDust = ftChangeAmount > 0n ? V2_FT_DUST_SATS : 0n
  const outCount = ftChangeAmount > 0n ? 5 : 4
  const baseInputs = 2 + ftLen
  if (totalFtSats >= merchantDust + needFtDust + feeFn(baseInputs, outCount)) {
    return []
  }
  const bySats = [...sortedBchUtxos].sort((a, b) => {
    const diff = BigInt(a.satoshis) - BigInt(b.satoshis)
    if (diff !== 0n) return diff < 0n ? -1 : 1
    if (a.txid === b.txid) return a.vout - b.vout
    return a.txid.localeCompare(b.txid)
  })
  const selected = []
  let haveBch = 0n
  for (const utxo of bySats) {
    selected.push(utxo)
    haveBch += BigInt(utxo.satoshis)
    const fee = feeFn(baseInputs + selected.length, outCount)
    if (haveBch + totalFtSats >= merchantDust + needFtDust + fee) break
  }
  const finalFee = feeFn(baseInputs + selected.length, outCount)
  if (haveBch + totalFtSats < merchantDust + needFtDust + finalFee) {
    throw new Error(
      `Insufficient BCH to cover fee and dust: need ${
        merchantDust + needFtDust + finalFee
      }, have ${haveBch + totalFtSats}`
    )
  }
  return selected
}
