<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" no-refocus position="bottom">
    <q-card class="q-dialog-plugin">
      <q-form @submit="checkAmount()">
        <q-card-section>
          <div class="q-mb-md">
            <div class="text-h5">{{ $t('SetAmount') }}</div>
            <div class="text-caption text-grey-7">{{ $t('SelectPaymentCurrency') }}</div>
          </div>
          <div v-if="message" class="text-subtitle1 q-mb-sm">
            {{ message }}
          </div>

          <!-- Amount Entry -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-xs">{{ $t('EnterAmount') }}</div>
            <div class="row items-center no-wrap q-gutter-x-sm">
              <q-input
                type="text"
                inputmode="decimal"
                v-model="fiatAmountDisplay"
                outlined
                autofocus
                clearable
                class="q-space amount-input-large"
                @update:model-value="handleAmountInput"
                @blur="handleAmountBlur"
              >
                <template v-slot:prepend>
                  <img
                    v-if="selectedCurrency?.imageUrl"
                    height="24"
                    :src="convertIpfsUrl(selectedCurrency?.imageUrl)"
                    :fallback-src="convertIpfsUrl(selectedCurrency?.imageUrl, 1)"
                    @error="onImgErrorIpfsSrc"
                    class="q-mr-xs"
                  />
                  <img
                    v-else-if="selectedCurrency?.id === 'bch'"
                    src="~assets/bch-logo.webp"
                    height="24"
                    class="q-mr-xs"
                  />
                  <span v-else-if="selectedCurrencyFlag">{{ selectedCurrencyFlag }}</span>
                  <span v-else>{{ selectedCurrency?.symbol }}</span>
                </template>
              </q-input>
              <q-select
                outlined
                v-model="selectedCurrency"
                :options="allCurrencyOpts"
                :option-label="resolveAssetSymbol"
                style="min-width: 120px"
                class="currency-select-large"
              >
                <template v-slot:option="ctx">
                  <q-item :active="ctx?.selected" clickable @click="() => ctx.toggleOption(ctx.opt)">
                    <q-item-section v-if="ctx?.opt?.imageUrl || ctx?.opt?.id === 'bch' || ctx?.opt?.id?.startsWith('fiat/')" avatar>
                      <img
                        v-if="ctx?.opt?.imageUrl"
                        height="30"
                        :src="convertIpfsUrl(ctx?.opt?.imageUrl)"
                        :fallback-src="convertIpfsUrl(ctx?.opt?.imageUrl, 1)"
                        @error="onImgErrorIpfsSrc"
                      />
                      <img
                        v-else-if="ctx?.opt?.id === 'bch'"
                        src="~assets/bch-logo.webp"
                        height="30"
                      />
                      <span v-else-if="ctx?.opt?.id?.startsWith('fiat/')" style="font-size: 30px; line-height: 30px;">
                        {{ getCountryFlagEmoji(getCountryCodeFromCurrency(ctx?.opt?.symbol)) }}
                      </span>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ ctx.label }}</q-item-label>
                      <q-item-label v-if="ctx.opt?.name" caption>{{ ctx?.opt?.name }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
          </div>

          <!-- Payment Currency Selection (only if fiat is selected) -->
          <div v-if="isFiatSelected" class="q-mb-md">
            <div class="text-subtitle2 q-mb-xs">{{ $t('PaymentCurrency') }}</div>
            <div class="payment-currency-grid">
              <div
                v-for="currency in filteredCurrencyOpts"
                :key="currency.id"
                class="payment-currency-card"
                :class="{ 'selected': paymentCurrency?.id === currency.id }"
                :style="paymentCurrency?.id === currency.id ? { borderColor: $q.dark.isActive ? 'white' : 'black' } : {}"
                @click="paymentCurrency = currency"
              >
                <div class="flex row items-center justify-start q-pa-sm full-width">
                  <img
                    v-if="currency.imageUrl"
                    height="32"
                    :src="convertIpfsUrl(currency.imageUrl)"
                    :fallback-src="convertIpfsUrl(currency.imageUrl, 1)"
                    @error="onImgErrorIpfsSrc"
                    class="q-mr-sm"
                  />
                  <img
                    v-else-if="currency.id === 'bch'"
                    src="~assets/bch-logo.webp"
                    height="32"
                    class="q-mr-sm"
                  />
                  <div class="flex column">
                    <div class="text-weight-medium">{{ resolveAssetSymbol(currency) }}</div>
                    <div v-if="!fiatAmountValue && currency.name" class="text-caption text-grey-6 ellipsis" style="max-width: 100px;">{{ currency.name }}</div>
                    <div v-else-if="fiatAmountValue && paymentCurrency?.id === currency.id && isFiatSelected" class="text-caption">
                      <q-spinner-dots v-if="conversionLoading" size="12px" />
                      <span v-else>≈ {{ formatPaymentAmount }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-card-actions class="row items-center justify-around q-gutter-x-md">
          <q-btn
            no-caps
            color="brandblue"
            size="1rem"
            padding="sm md"
            :label="$t('CreatePaymentQR')"
            class="q-space"
            :class="{ 'sparkle-button': isFormValid }"
            type="submit"
            icon="mdi-qrcode"
            :disable="!isFormValid"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
<script>
import { bchAsset, parseAsset, resolveAssetSymbol } from '../utils/assets.js'
import { convertIpfsUrl, onImgErrorIpfsSrc } from 'src/utils/ipfs'
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDialogPluginComponent, useQuasar, debounce } from 'quasar'
import { useCashtokenStore } from 'src/stores/cashtoken.js'
import { useMarketStore } from 'src/stores/market.js'
import { useMarketplaceStore } from 'src/stores/marketplace.js'
import { useWalletStore } from 'src/stores/wallet.js'
import fiatCurrencies from '../assets/currencies.json'
import { formatNumberAutoDecimals, parseNumericInput } from 'src/utils/number-format'

export default defineComponent({
  name: 'SetAmountFormDialog',
  props: {
    initialValue: Object,
    currencies: Array,
    title: String,
    message: String,
    hideInvalidOptions: Boolean,
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    const $q = useQuasar()
    const cashtokenStore = useCashtokenStore();
    const marketStore = useMarketStore();
    const marketplaceStore = useMarketplaceStore();
    const walletStore = useWalletStore();

    const initialParsedCurrency = parseAsset(props.initialValue?.currency)
    
    const amountValue = ref(props.initialValue?.amount || null);
    const fiatAmountValue = ref(null);
    const fiatAmountDisplay = ref(null); // Display value (string) that accepts both . and ,
    
    // Helper function to get country code from currency code
    const getCountryCodeFromCurrency = (currencyCode) => {
      const currencyCountryMap = {
        'AED': 'AE', 'AFN': 'AF', 'ALL': 'AL', 'AMD': 'AM', 'ANG': 'AN', 'AOA': 'AO', 'ARS': 'AR', 'AUD': 'AU',
        'AWG': 'AW', 'AZN': 'AZ', 'BAM': 'BA', 'BBD': 'BB', 'BDT': 'BD', 'BGN': 'BG', 'BHD': 'BH', 'BIF': 'BI',
        'BMD': 'BM', 'BND': 'BN', 'BOB': 'BO', 'BRL': 'BR', 'BSD': 'BS', 'BTN': 'BT', 'BWP': 'BW', 'BYN': 'BY',
        'BZD': 'BZ', 'CAD': 'CA', 'CDF': 'CD', 'CHF': 'CH', 'CLP': 'CL', 'CNY': 'CN', 'COP': 'CO', 'CRC': 'CR',
        'CUP': 'CU', 'CVE': 'CV', 'CZK': 'CZ', 'DJF': 'DJ', 'DKK': 'DK', 'DOP': 'DO', 'DZD': 'DZ', 'EGP': 'EG',
        'ERN': 'ER', 'ETB': 'ET', 'EUR': 'EU', 'FJD': 'FJ', 'FKP': 'FK', 'FOK': 'FO', 'GBP': 'GB', 'GEL': 'GE',
        'GGP': 'GG', 'GHS': 'GH', 'GIP': 'GI', 'GMD': 'GM', 'GNF': 'GN', 'GTQ': 'GT', 'GYD': 'GY', 'HKD': 'HK',
        'HNL': 'HN', 'HRK': 'HR', 'HTG': 'HT', 'HUF': 'HU', 'IDR': 'ID', 'ILS': 'IL', 'IMP': 'IM', 'INR': 'IN',
        'IQD': 'IQ', 'IRR': 'IR', 'ISK': 'IS', 'JEP': 'JE', 'JMD': 'JM', 'JOD': 'JO', 'JPY': 'JP', 'KES': 'KE',
        'KGS': 'KG', 'KHR': 'KH', 'KID': 'KI', 'KMF': 'KM', 'KRW': 'KR', 'KWD': 'KW', 'KYD': 'KY', 'KZT': 'KZ',
        'LAK': 'LA', 'LBP': 'LB', 'LKR': 'LK', 'LRD': 'LR', 'LSL': 'LS', 'LYD': 'LY', 'MAD': 'MA', 'MDL': 'MD',
        'MGA': 'MG', 'MKD': 'MK', 'MMK': 'MM', 'MNT': 'MN', 'MOP': 'MO', 'MRU': 'MR', 'MUR': 'MU', 'MVR': 'MV',
        'MWK': 'MW', 'MXN': 'MX', 'MYR': 'MY', 'MZN': 'MZ', 'NAD': 'NA', 'NGN': 'NG', 'NIO': 'NI', 'NOK': 'NO',
        'NPR': 'NP', 'NZD': 'NZ', 'OMR': 'OM', 'PAB': 'PA', 'PEN': 'PE', 'PGK': 'PG', 'PHP': 'PH', 'PKR': 'PK',
        'PLN': 'PL', 'PYG': 'PY', 'QAR': 'QA', 'RON': 'RO', 'RSD': 'RS', 'RUB': 'RU', 'RWF': 'RW', 'SAR': 'SA',
        'SBD': 'SB', 'SCR': 'SC', 'SDG': 'SD', 'SEK': 'SE', 'SGD': 'SG', 'SHP': 'SH', 'SLE': 'SL', 'SOS': 'SO',
        'SRD': 'SR', 'SSP': 'SS', 'STN': 'ST', 'SYP': 'SY', 'SZL': 'SZ', 'THB': 'TH', 'TJS': 'TJ', 'TMT': 'TM',
        'TND': 'TN', 'TOP': 'TO', 'TRY': 'TR', 'TTD': 'TT', 'TVD': 'TV', 'TWD': 'TW', 'TZS': 'TZ', 'UAH': 'UA', 'UGX': 'UG',
        'USD': 'US', 'UYU': 'UY', 'UZS': 'UZ', 'VES': 'VE', 'VND': 'VN', 'VUV': 'VU', 'WST': 'WS', 'XAF': 'CM',
        'XCD': 'AG', 'XOF': 'SN', 'XPF': 'PF', 'YER': 'YE', 'ZAR': 'ZA', 'ZMW': 'ZM', 'ZWL': 'ZW'
      };
      return currencyCountryMap[currencyCode];
    };

    // Helper function to convert country code to flag emoji
    const getCountryFlagEmoji = (countryCode) => {
      if (!countryCode || countryCode === 'EU') return null; // EU has no single flag
      
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
      return String.fromCodePoint(...codePoints);
    };
    
    const fiatCurrencyOpts = computed(() => {
      return fiatCurrencies.map(fiat => ({
        id: `fiat/${fiat.code}`,
        name: fiat.name,
        symbol: fiat.code,
        decimals: 2,
      }))
    })

    const cryptoCurrencyOpts = computed(() => {
      const initialCurrency = parseAsset(props?.initialValue?.currency)
      let opts = [bchAsset]
      if (Array.isArray(props.currencies)) opts = [...props.currencies].map(parseAsset).filter(Boolean)
      // Only add initial currency if it's not a fiat currency
      if (initialCurrency && !initialCurrency?.id?.startsWith?.('fiat/') && !opts.find(asset => asset?.id === initialCurrency?.id)) {
        opts.unshift(initialCurrency)
      }
      return opts
    })
    const filteredCurrencyOpts = computed(() => {
      let filtered = cryptoCurrencyOpts.value.filter(asset => !asset?.id?.startsWith?.('fiat/'))
      if (props.hideInvalidOptions) filtered = filtered.filter(asset => asset?.valid !== false)
      return filtered
    })  

    // Combined options: wallet's preferred fiat + BCH + tokens
    const allCurrencyOpts = computed(() => {
      const preferredFiat = walletStore.preferences.selectedCurrency || marketplaceStore.merchant?.currency?.symbol;
      const fiat = fiatCurrencyOpts.value.find(f => f.symbol === preferredFiat) || fiatCurrencyOpts.value.find(f => f.symbol === 'PHP') || fiatCurrencyOpts.value[0];
      return [fiat, ...filteredCurrencyOpts.value];
    })

    // Start with wallet preferred fiat currency by default
    const selectedCurrency = ref(initialParsedCurrency || null);
    const paymentCurrency = ref(bchAsset);
    const conversionLoading = ref(false);
    let rateRefreshInterval = null;

    const amountFieldDecimals = computed(() => {
      return selectedCurrency.value?.decimals || 8;
    })

    const isSelectedCurrencyToken = computed(() => selectedCurrency.value?.id?.startsWith?.('ct/'))
    const isFiatSelected = computed(() => selectedCurrency.value?.id?.startsWith?.('fiat/'))
    
    const selectedCurrencyFlag = computed(() => {
      if (!isFiatSelected.value || !selectedCurrency.value?.symbol) return null;
      const countryCode = getCountryCodeFromCurrency(selectedCurrency.value.symbol);
      return getCountryFlagEmoji(countryCode);
    })

    // Conversion rates - from fiat to payment currency
    const fiatBchRate = computed(() => {
      if (!isFiatSelected.value) return null;
      return marketStore.getRate(selectedCurrency.value.symbol)
    })

    const tokenBchRate = computed(() => {
      const isPaymentToken = paymentCurrency.value?.id?.startsWith?.('ct/');
      if (!isPaymentToken) return null;
      const tokenCategory = paymentCurrency.value?.id?.replace('ct/', '');
      return marketStore.getTokenRate(tokenCategory);
    })

    // Direct token-fiat rate (optimized)
    const tokenFiatRate = computed(() => {
      const isPaymentToken = paymentCurrency.value?.id?.startsWith?.('ct/');
      if (!isPaymentToken || !isFiatSelected.value) return null;
      const tokenCategory = paymentCurrency.value?.id?.replace('ct/', '');
      return marketStore.getTokenFiatRate(tokenCategory, selectedCurrency.value.symbol);
    })

    // Check if we're using the direct token-fiat rate (which is "token per fiat")
    const isUsingDirectTokenFiatRate = computed(() => {
      return isFiatSelected.value && 
             paymentCurrency.value?.id?.startsWith?.('ct/') && 
             tokenFiatRate.value?.rate != null;
    })

    const fiatToPaymentRate = computed(() => {
      if (!isFiatSelected.value || !paymentCurrency.value) return null;
      
      // For BCH directly from fiat
      if (paymentCurrency.value?.id === 'bch') {
        return fiatBchRate.value?.rate || null;
      }
      
      // For tokens, use direct token-fiat rate if available (optimized)
      // Note: This rate is "token per fiat" (e.g., MUSD per PHP)
      if (tokenFiatRate.value?.rate) {
        return tokenFiatRate.value.rate;
      }
      
      // Fallback: convert through BCH (for backward compatibility)
      // This gives us "fiat per token" (e.g., PHP per MUSD)
      const fiatPerBch = fiatBchRate.value?.rate;
      const tokenPerBch = tokenBchRate.value?.rate;
      
      if (!fiatPerBch || !tokenPerBch) return null;
      return fiatPerBch / tokenPerBch; // fiat per token
    })

    // Handle amount input - accepts both . and , as decimal separators
    function handleAmountInput(value) {
      if (value === null || value === '') {
        fiatAmountDisplay.value = null
        fiatAmountValue.value = null
        debouncedUpdateAmount(null)
        return
      }
      
      // Store the raw input for display
      fiatAmountDisplay.value = value
      
      // Parse the input (handles both . and ,)
      const parsed = parseNumericInput(value)
      
      if (parsed !== null) {
        fiatAmountValue.value = parsed
        debouncedUpdateAmount(parsed)
      } else {
        // Invalid input, but keep the display value for user to correct
        fiatAmountValue.value = null
      }
    }
    
    // Handle blur - format the display value according to locale
    function handleAmountBlur() {
      if (fiatAmountValue.value !== null && fiatAmountValue.value !== undefined) {
        // Format according to locale for display
        const decimals = amountFieldDecimals.value || 0
        fiatAmountDisplay.value = formatNumberAutoDecimals(fiatAmountValue.value, decimals)
      }
    }

    async function fetchConversionRates() {
      if (!fiatAmountValue.value || !isFiatSelected.value) return;
      
      conversionLoading.value = true;
      try {
        const isPaymentToken = paymentCurrency.value?.id?.startsWith?.('ct/');
        
        if (isPaymentToken) {
          // Optimized: single API call to fetch token price directly in fiat currency
          const tokenCategory = paymentCurrency.value?.id?.replace('ct/', '');
          if (tokenCategory) {
            await marketStore.refreshTokenFiatPrice(
              tokenCategory, 
              selectedCurrency.value.symbol,
              { age: 60000 } // 1 minute cache
            );
          }
        } else {
          // For BCH, fetch fiat to BCH rate
          await marketStore.refreshBchPrice(selectedCurrency.value.symbol);
        }
      } catch (error) {
        // Error fetching conversion rates
      } finally {
        conversionLoading.value = false;
      }
    }

    function startRateRefreshTimer() {
      stopRateRefreshTimer();
      
      if (!isFiatSelected.value || !fiatAmountValue.value) return;
      
      // Refresh every minute (60000ms) while dialog is open
      rateRefreshInterval = setInterval(async () => {
        await fetchConversionRates();
        if (fiatAmountValue.value) {
          await updateAmount(fiatAmountValue.value);
        }
      }, 60000); // 1 minute
    }

    function stopRateRefreshTimer() {
      if (rateRefreshInterval) {
        clearInterval(rateRefreshInterval);
        rateRefreshInterval = null;
      }
    }

    async function updateAmount(amount) {
      if (!amount) {
        amountValue.value = null;
        stopRateRefreshTimer();
        return;
      }

      // If fiat is selected, we need conversion
      if (isFiatSelected.value) {
        // Always fetch fresh rates from server
        await fetchConversionRates();

        if (!fiatToPaymentRate.value) {
          amountValue.value = null;
          stopRateRefreshTimer();
          return;
        }

        const decimals = paymentCurrency.value?.decimals || 8;
        let paymentAmount;
        
        // Direct token-fiat rate is "token per fiat" (e.g., MUSD per PHP), so multiply
        // BCH rates and fallback rates are "fiat per token" (e.g., PHP per MUSD), so divide
        // Use Math.round with scaling to match Python's rounding behavior
        const factor = Math.pow(10, decimals);
        if (isUsingDirectTokenFiatRate.value) {
          paymentAmount = Math.round((amount * fiatToPaymentRate.value) * factor) / factor;
        } else {
          paymentAmount = Math.round((amount / fiatToPaymentRate.value) * factor) / factor;
        }
        
        amountValue.value = paymentAmount;
        
        // Start the timer for rate refresh
        startRateRefreshTimer();
      } else {
        // Direct amount entry, no conversion needed
        amountValue.value = amount;
        stopRateRefreshTimer();
      }
    }
    
    // Debounced version for when user is typing
    const debouncedUpdateAmount = debounce(updateAmount, 500)

    const formatPaymentAmount = computed(() => {
      if (!amountValue.value) return '0';
      const decimals = paymentCurrency.value?.decimals || 8;
      return formatNumberAutoDecimals(amountValue.value, decimals);
    })

    const isFormValid = computed(() => {
      // Disable while conversion is loading
      if (conversionLoading.value) return false;
      
      // Must have an amount entered
      if (!fiatAmountValue.value) return false;
      
      // If fiat is selected, must have payment currency and valid conversion rate
      if (isFiatSelected.value) {
        if (!paymentCurrency.value || !fiatToPaymentRate.value) return false;
      }
      
      // For crypto currencies, just need amount value
      return true;
    })

    onMounted(() => {
      fetchMissingCashtokenDataFromOptions();
      // Initialize with wallet's preferred fiat currency or BCH
      if (allCurrencyOpts.value.length > 0 && !selectedCurrency.value) {
        selectedCurrency.value = allCurrencyOpts.value[0]; // First is the preferred fiat
      }
      paymentCurrency.value = bchAsset;
      
      // Initialize display value if initial value exists
      if (props.initialValue?.amount && isFiatSelected.value) {
        const decimals = amountFieldDecimals.value || 0
        fiatAmountDisplay.value = formatNumberAutoDecimals(props.initialValue.amount, decimals)
        fiatAmountValue.value = props.initialValue.amount
      }
    })
    
    onUnmounted(() => {
      stopRateRefreshTimer();
    })
    
    watch(cryptoCurrencyOpts, () => fetchMissingCashtokenDataFromOptions())
    function fetchMissingCashtokenDataFromOptions() {
      for (const asset of cryptoCurrencyOpts.value) {
        if (!asset?.id?.startsWith?.('ct/') || asset?.valid !== false) continue

        const category = asset.id.replace('ct/', '');
        cashtokenStore.fetchTokenMetadata(category);
      }
    }

    // Watch selectedCurrency and paymentCurrency to handle currency selection
    watch(selectedCurrency, (newCurrency) => {
      // If fiat is selected, default payment currency to BCH
      if (isFiatSelected.value && paymentCurrency.value?.id !== 'bch') {
        paymentCurrency.value = bchAsset;
      } else if (!isFiatSelected.value) {
        // Crypto selected: use it directly, no conversion
        paymentCurrency.value = newCurrency;
        amountValue.value = fiatAmountValue.value;
      }
    })

    watch([paymentCurrency], () => {
      // If fiat is selected and amount is entered, recalculate conversion
      if (isFiatSelected.value && fiatAmountValue.value) {
        fetchConversionRates().then(() => {
          updateAmount(fiatAmountValue.value);
        });
      }
      // Update display format when currency changes
      if (isFiatSelected.value && fiatAmountValue.value !== null) {
        const decimals = amountFieldDecimals.value || 0
        fiatAmountDisplay.value = formatNumberAutoDecimals(fiatAmountValue.value, decimals)
      }
    })

    function checkAmount () {
      // Determine the payment asset
      const paymentAsset = isFiatSelected.value ? paymentCurrency.value : selectedCurrency.value;
      const assetId = paymentAsset?.id;

      let tokenCategory;
      if (assetId?.startsWith?.('ct/')) tokenCategory = assetId.replace('ct/', '');

      const currency = paymentAsset?.symbol;

      const data = {
        value: amountValue.value,
        currency,
        assetId,
        tokenCategory,
      }
      
      // Include fiat reference data if fiat was used for input
      if (isFiatSelected.value && fiatAmountValue.value) {
        data.fiatAmount = fiatAmountValue.value;
        data.fiatCurrency = selectedCurrency.value?.symbol;
        
        // Include price_id for token payments in fiat mode
        if (paymentCurrency.value?.id?.startsWith?.('ct/')) {
          // Use direct token-fiat rate priceId if available
          if (tokenFiatRate.value?.priceId) {
            data.priceId = tokenFiatRate.value.priceId;
          }
        }
      }
      
      onDialogOK({ amount: data })
    }

    return {
      dialogRef,
      checkAmount,
      onDialogHide,
      onDialogOK,
      onDialogCancel,
      amountValue,
      fiatAmountValue,
      fiatAmountDisplay,
      amountFieldDecimals,
      handleAmountInput,
      handleAmountBlur,
      selectedCurrency,
      paymentCurrency,

      isFiatSelected,
      conversionLoading,
      selectedCurrencyFlag,

      allCurrencyOpts,
      filteredCurrencyOpts,

      formatPaymentAmount,
      isFormValid,
      updateAmount,
      debouncedUpdateAmount,

      resolveAssetSymbol,
      convertIpfsUrl,
      onImgErrorIpfsSrc,
      getCountryFlagEmoji,
      getCountryCodeFromCurrency,
    }
  },
})
</script>

<style scoped>
.amount-input-large :deep(.q-field__native) {
  font-size: 1.25rem;
  font-weight: 500;
}
.currency-select-large :deep(.q-field__native) {
  font-size: 1.25rem;
  font-weight: 500;
}

/* Gradient shine effect for active button */
.sparkle-button {
  position: relative;
  overflow: hidden;
}

.sparkle-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shine 3s ease-in-out infinite;
}

@keyframes shine {
  0% {
    left: -100%;
  }
  50%, 100% {
    left: 100%;
  }
}

/* Payment currency grid - 2 columns with fixed widths */
.payment-currency-grid {
  display: grid;
  grid-template-columns: repeat(2, calc(50% - 4px));
  gap: 8px;
}

/* Payment currency cards */
.payment-currency-card {
  width: 100%;
  max-width: 100%;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 8px;
  transition: all 0.3s ease;
  background-color: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.payment-currency-card:hover:not(.selected) {
  border-color: rgba(37, 57, 51, 0.3);
  background-color: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.payment-currency-card.selected {
  border-width: 1px;
  background-color: rgba(37, 57, 51, 0.2);
  box-shadow: 0 4px 12px rgba(37, 57, 51, 0.4);
  transform: scale(1.05);
}
</style>
