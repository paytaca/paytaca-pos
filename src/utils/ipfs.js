
export const IPFS_DOMAINS = [
  'https://ipfs.paytaca.com/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
]

export function convertIpfsUrl(url='', ipfsDomainIndex=0) {
  if (typeof url !== 'string') return url
  if (!url.startsWith('ipfs://')) return url

  const index = parseInt(ipfsDomainIndex) || 0;
  const convertedUrl = url.replace('ipfs://', IPFS_DOMAINS[index]);
  
  // Append Pinata gateway token for ipfs.paytaca.com URLs
  if (convertedUrl && convertedUrl.startsWith('https://ipfs.paytaca.com/ipfs')) {
    const token = process.env.PINATA_GATEWAY_TOKEN;
    if (token) {
      return convertedUrl + '?pinataGatewayToken=' + token;
    }
  }
  
  return convertedUrl;
}

/**
 * @param {Event} evt 
 */
export function onImgErrorIpfsSrc(evt) {
  if (evt.target?.fallbackHandled) return

  evt.target.fallbackHandled = true;
  const fallbackSrc = evt.target?.attributes?.['fallback-src']?.value;
  if (fallbackSrc && evt.target.src != fallbackSrc) {
    evt.target.src = fallbackSrc;
  }
}
