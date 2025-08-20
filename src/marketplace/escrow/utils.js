import { binToHex, hexToBin, hash256 } from '@bitauth/libauth'

export function reverseHex(hexString) {
  const bytes = Buffer.from(hexString, 'hex')
  bytes.reverse()
  return bytes.toString('hex')
}

export function intToHexString(num=20, bytelength=20) {
  let numHexBase = num.toString(16)
  if (numHexBase.length % 2 != 0) numHexBase = '0' + numHexBase
  let numBytes = Buffer.from(numHexBase, 'hex')
  numBytes = Buffer.concat([
    Buffer.from(new Array(bytelength - numBytes.length).fill(0)),
    numBytes,
  ])
  const numHex = reverseHex(numBytes.toString('hex'))

  return numHex
}


/**
 * @param {Object} opts
 * @param {Number} opts.nftId
 * @param {Number} opts.amount
 * @param {String} opts.category
 */
export function generateCommitment(opts) {
  if (!opts?.category) {
    return intToHexString(opts?.nftId, 20) + intToHexString(opts?.amount, 20) 
  }
  const tokenNftIdHash = hash256(
    hexToBin(reverseHex(opts.category) + intToHexString(opts.nftId, 20))
  );
  return binToHex(tokenNftIdHash) + intToHexString(opts?.amount, 8);
}
