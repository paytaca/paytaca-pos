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

  function getTxAmount(transaction) {
    if (!transaction?.ft_category && !transaction?.nft_category) {
      return { value: transaction?.amount, symbol: 'BCH' }
    }

    if (transaction?.ft_category) {
      const metadata = cashtokenStore.getTokenMetadata(transaction.ft_category);
      const decimals = metadata?.decimals || 0;
      const symbol = metadata?.symbol || `TOKEN(${transaction.ft_category?.substring?.(0, 6)})`;
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

    getTxAmount,
  }
}