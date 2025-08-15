import { useWalletStore } from 'src/stores/wallet'
import { computed } from 'vue';

export function useTransactionHelpers() {
  const walletStore = useWalletStore();

  const selectedMarketCurrency = computed(() => walletStore?.preferences?.selectedCurrency || 'USD')

  function getTxMarketPrice(transaction) {
    if (selectedMarketCurrency.value === 'USD' && transaction?.usd_price) {
      return transaction.usd_price
    } else if (transaction?.market_prices?.[selectedMarketCurrency.value]) {
      return transaction?.market_prices?.[selectedMarketCurrency.value]
    }
  }

  function getTxMarketValue(transaction) {
    const data = {
      marketAssetPrice: getTxMarketPrice(transaction),
      marketValue: null,
    }

    if (data.marketAssetPrice) {
      data.marketValue = (Number(transaction?.amount) * Number(data.marketAssetPrice)).toFixed(5)
    }
    return data
  }

  return {
    selectedMarketCurrency,
    getTxMarketPrice,
    getTxMarketValue,
  }
}