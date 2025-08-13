import { isHex } from '@bitauth/libauth';
import fiatCurrencies from '../assets/currencies.json'
import { useCashtokenStore } from '../stores/cashtoken.js'

const cashtokenStore = useCashtokenStore();
/**
 * @typedef {Object} AssetInfo
 * @property {String} id `bch`, `fiat/<iso_code>`, or `ct/<category>`
 * @property {String} name
 * @property {String} symbol
 * @property {Number} decimals
 * @property {String} imageUrl
 * @property {Boolean} [valid] Some cashtokens may not have metadata available
 */

export const bchAsset = Object.freeze({
  id: 'bch', name: 'Bitcoin Cash', symbol: 'BCH', decimals: 8, imageUrl: ''
})

/**
 * @param {String | AssetInfo} value
 */
export function parseAsset(value) {
  if (typeof value === 'string') return resolveAssetFromString(value);

  return resolveAssetFromObject(value);
}

/**
 * @param {AssetInfo} obj 
 */
function resolveAssetFromObject(obj) {
  let assetInfo;
  if (typeof obj?.id === 'string') assetInfo = resolveAssetFromString(obj?.id)
  if (assetInfo) return assetInfo

  if (typeof obj?.symbol === 'string') assetInfo = resolveAssetFromString(obj?.symbol)
  if (assetInfo) return assetInfo
}

function resolveAssetFromString(value) {
  if (typeof value !== 'string') return
  if (value.toLocaleLowerCase() === 'bch') return bchAsset

  if (/^(ct\/)?([a-fA-F0-9]{64})$/.test(value)) return resolveFungibleToken(value)

  return resolveFiat(value)
}


function resolveFungibleToken(categoryOrAssetId='') {
  const category = categoryOrAssetId.replace('ct/', '');
  if (!isHex(category) && category.length !== 64) return

  const assetInfo = { id: `ct/${category}`, name: '', symbol: '', decimals: 0, imageUrl: '', valid: false }
  const tokenMetadata = cashtokenStore.getTokenMetadata(category);
  if (!tokenMetadata) return assetInfo

  assetInfo.name = tokenMetadata.name
  assetInfo.symbol = tokenMetadata.symbol
  assetInfo.decimals = tokenMetadata.decimals
  assetInfo.imageUrl = tokenMetadata.imageUrl
  assetInfo.valid = true

  return assetInfo;
}

function resolveFiat(codeOrAssetId='') {
  if (typeof codeOrAssetId !== 'string') return
  
  const code = codeOrAssetId.replace('fiat/', '')

  const info = fiatCurrencies.find(fiatInfo => fiatInfo.code === code)
  if (!info) return

  return {
    id: `fiat/${info.code}`,
    name: info.name,
    symbol: info.code,
    decimals: 2,
  }
}


export function resolveAssetSymbol(assetInfo) {
  if (assetInfo?.symbol) return assetInfo.symbol
  /**
   * for cashtokens, `ct/<first-6-chars-of-token-category>`
   * for fiat it will resolve to iso code by removing `fiat/` prefix
   * for bch, will resolve to 'bch'
   */
  return assetInfo?.id?.substring?.(0, 9)?.replace('fiat/', '');
}

    