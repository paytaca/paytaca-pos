import crypto from 'crypto';
import {
  binToHex,
  hexToBin,
  CashAddressType,
  decodeCashAddress,
  encodeCashAddress,
  decodePrivateKeyWif,
  ripemd160,
  secp256k1,
} from "@bitauth/libauth";


export function sha256(data='', encoding='utf8') {
  const _sha256 = crypto.createHash('sha256')
  _sha256.update(Buffer.from(data, encoding))
  return _sha256.digest().toString('hex')
}

export function pubkeyToPkHash(pubkey='') {
  return binToHex(ripemd160.hash(hexToBin(sha256(pubkey, 'hex'))))
}

export function wifToPubkey(wif) {
  const privkey = decodePrivateKeyWif(wif)
  const compressed = secp256k1.derivePublicKeyCompressed(privkey.privateKey)
  if (typeof compressed !== 'string') return binToHex(compressed)
  const uncompressed = secp256k1.derivePublicKeyUncompressed(privkey.privateKey)
  if (typeof uncompressed !== 'string') return binToHex(uncompressed)
  return uncompressed
}

export function addressToPkHash(address) {
  const decoded = decodeCashAddress(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.payload);
}

export function pkhashToCashAddress(pkhash, network='mainnet') {
  const prefix = network === 'mainnet' ? 'bitcoincash' : 'bchtest'
  return encodeCashAddress(prefix, 'p2pkh', hexToBin(pkhash))
}


export function toTokenAddress(address ='') {
  const decodedAddress = decodeCashAddress(address)
  if (typeof decodedAddress == 'string') throw decodedAddress
  const addrType = decodedAddress.type
  const payload = decodedAddress.payload
  switch(addrType) {
    case (CashAddressType.p2pkhWithTokens):
    case (CashAddressType.p2shWithTokens):
      return address
    case (CashAddressType.p2pkh):
      return encodeCashAddress(decodedAddress.prefix, CashAddressType.p2pkhWithTokens, payload)
    case (CashAddressType.p2sh):
      return encodeCashAddress(decodedAddress.prefix, CashAddressType.p2shWithTokens, payload)
  }
}
