import { useCashtokenStore } from 'src/stores/cashtoken';
import { useWalletStore } from 'src/stores/wallet'
import { computed } from 'vue';

export function useTransactionHelpers() {
  const walletStore = useWalletStore();
  const cashtokenStore = useCashtokenStore();

  const selectedMarketCurrency = computed(() => walletStore?.preferences?.selectedCurrency || 'USD')

  function getTxMarketPrice(transaction) {
    if (selectedMarketCurrency.value === 'USD' && transaction?.usd_price) {
      return transaction.usd_price
    } else if (transaction?.market_prices?.[selectedMarketCurrency.value]) {
      return transaction?.market_prices?.[selectedMarketCurrency.value]
    }
  }

  function getTxMarketValue(transaction) {
    const data = { marketAssetPrice: null, marketValue: null };

    // no idea how to calculate market value for nft transactions
    if (transaction?.nft_category) return data;

    data.marketAssetPrice = getTxMarketPrice(transaction);
    if (data.marketAssetPrice) {
      data.marketValue = (Number(transaction?.amount) * Number(data.marketAssetPrice)).toFixed(5)
      
      if (transaction?.ft_category) {
        const metadata = cashtokenStore.getTokenMetadata(transaction.ft_category);
        const decimals = metadata?.decimals;
        data.marketValue = (data.marketValue / 10 ** decimals).toFixed(5);
      }
    }
    return data
  }

  function getTxDisplayFiat(transaction) {
    // Prefer exact fiat recorded in transaction.fiat_amounts if available
    const currency = selectedMarketCurrency.value
    const map = transaction?.fiat_amounts
    if (map && currency && Object.prototype.hasOwnProperty.call(map, currency)) {
      const raw = map[currency]
      const num = Number(raw)
      if (!Number.isNaN(num)) {
        return { value: num, currency }
      }
    }

    // Fallback 1: use market price in the selected currency if available
    const priceInSelected = transaction?.market_prices?.[currency]
    if (priceInSelected) {
      const val = Number(transaction?.amount) * Number(priceInSelected)
      const num = Number(val)
      if (!Number.isNaN(num)) return { value: num, currency }
    }

    // Fallback 2: use USD price if available and selected currency is not priced
    if (transaction?.usd_price) {
      const val = Number(transaction?.amount) * Number(transaction.usd_price)
      const num = Number(val)
      if (!Number.isNaN(num)) return { value: num, currency: 'USD' }
    }

    // Fallback 3: computed (legacy) market value logic
    const mv = getTxMarketValue(transaction)
    if (mv?.marketValue) {
      const num = Number(mv.marketValue)
      if (!Number.isNaN(num)) {
        return { value: num, currency }
      }
    }
    return { value: null, currency }
  }

  function getTxAmount(transaction) {
    if (!transaction?.ft_category && !transaction?.nft_category) {
      return { value: transaction?.amount, symbol: 'BCH' }
    }

    if (transaction?.ft_category) {
      // Prefer symbol from transaction object (from websocket) if available
      let symbol = transaction?.tokenSymbol
      
      // If not in transaction, try to get from metadata
      if (!symbol) {
        const metadata = cashtokenStore.getTokenMetadata(transaction.ft_category);
        symbol = metadata?.symbol
      }
      
      // Fallback to generic format if still no symbol
      if (!symbol) {
        symbol = `TOKEN(${transaction.ft_category?.substring?.(0, 6)})`
      }
      
      // Use decimals from transaction object or metadata
      const decimals = transaction?.tokenDecimals ?? cashtokenStore.getTokenMetadata(transaction.ft_category)?.decimals ?? 0
      const amount = transaction?.amount / (10 ** decimals);
      return { value: amount, symbol: symbol };
    }

    if (transaction?.nft_category) {
      return { value: transaction?.amount, symbol: `NFT(${transaction.nft_category?.substring?.(0, 6)})` };
    }
  }

  return {
    selectedMarketCurrency,
    getTxMarketPrice,
    getTxMarketValue,
    getTxDisplayFiat,

    getTxAmount,
  }
}