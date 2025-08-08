import { binToHex, CashAddressType, decodeCashAddress, encodeCashAddress } from "@bitauth/libauth";

export function addressToPkHash(address) {
  const decoded = decodeCashAddress(address);
  if (typeof decoded === 'string') throw new Error(decoded);
  return binToHex(decoded.payload);
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
