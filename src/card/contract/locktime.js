import { decodeTransaction, hexToBin } from '@bitauth/libauth'
import { ContractVersionError } from './version.js'

export function decodeServerTransaction(txHex) {
  const hex = typeof txHex === 'string' ? txHex.replace(/^0x/i, '') : ''
  // hexToBin is permissive, so validate the encoding before decoding bytes.
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new ContractVersionError('Malformed server transaction hex')
  }
  const transaction = decodeTransaction(hexToBin(hex))
  if (typeof transaction === 'string') {
    throw new ContractVersionError('Malformed server transaction data')
  }
  return transaction
}

export function buildWithServerLocktime(transaction, locktime) {
  // Never allow an absent locktime to trigger CashScript's implicit height
  // lookup. Zero is a valid locktime and must also be passed explicitly.
  if (!Number.isInteger(locktime) || locktime < 0 || locktime > 0xffffffff) {
    throw new ContractVersionError('Invalid server transaction locktime')
  }
  return transaction.withTime(locktime).build()
}
