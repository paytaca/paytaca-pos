/**
 * Validates exchange rates and conversion results to prevent disastrous mistakes
 */

/**
 * Reasonable rate ranges (in fiat per BCH)
 * These are conservative bounds - actual rates may vary but should be within these orders of magnitude
 */
const REASONABLE_BCH_RATE_RANGES = {
  // Major currencies - 1 BCH should be worth roughly $50-$50,000 USD equivalent
  USD: { min: 50, max: 50000 },
  EUR: { min: 50, max: 50000 },
  GBP: { min: 40, max: 40000 },
  JPY: { min: 5000, max: 5000000 },
  CNY: { min: 300, max: 300000 },
  // High inflation currencies may have higher numbers but similar USD value
  ARS: { min: 10000, max: 100000000 }, // ~$10-$1000 USD equivalent
  PHP: { min: 2500, max: 2500000 }, // ~$50-$5000 USD equivalent
  // Default fallback for unknown currencies
  DEFAULT: { min: 1, max: 100000000 }
}

/**
 * Reasonable token rate ranges (in fiat per token)
 * For stablecoins, should be close to 1:1
 * For other tokens, can vary widely
 */
const REASONABLE_TOKEN_RATE_RANGES = {
  // Stablecoins should be close to 1:1 with fiat
  STABLECOIN: { min: 0.1, max: 10 },
  // Other tokens - very wide range but not zero or astronomical
  DEFAULT: { min: 0.000001, max: 1000000 }
}

/**
 * Maximum allowed conversion ratio deviation
 * If converting 1000 ARS and getting 0.000001 BCH or 10000 BCH, something is wrong
 */
const MAX_CONVERSION_RATIO_DEVIATION = 1000 // 1000x difference is suspicious

/**
 * Minimum and maximum reasonable conversion ratios
 * e.g., if 1 ARS converts to 0.0000001 BCH, that's reasonable
 * but if 1 ARS converts to 0.0000000000001 BCH, that's suspicious
 */
const MIN_REASONABLE_CONVERSION_RATIO = 1e-12 // Very small but not zero
const MAX_REASONABLE_CONVERSION_RATIO = 1e12 // Very large but not infinite

/**
 * Validates a BCH exchange rate
 * @param {number} rate - Rate in fiat per BCH (e.g., 50000 ARS per BCH)
 * @param {string} currency - Currency code (e.g., 'ARS', 'USD')
 * @returns {{valid: boolean, error?: string}}
 */
export function validateBchRate(rate, currency) {
  if (!rate || rate === 0) {
    const error = `[RateValidation] BCH rate is zero or missing for ${currency}`
    console.error(error, { rate, currency })
    return { valid: false, error }
  }

  if (isNaN(rate) || !isFinite(rate)) {
    const error = `[RateValidation] BCH rate is not a valid number for ${currency}`
    console.error(error, { rate, currency })
    return { valid: false, error }
  }

  if (rate < 0) {
    const error = `[RateValidation] BCH rate cannot be negative for ${currency}`
    console.error(error, { rate, currency })
    return { valid: false, error }
  }

  // Check if rate is within reasonable bounds
  const range = REASONABLE_BCH_RATE_RANGES[currency] || REASONABLE_BCH_RATE_RANGES.DEFAULT
  
  if (rate < range.min) {
    const error = `[RateValidation] BCH rate ${rate} is suspiciously low for ${currency}. Expected range: ${range.min}-${range.max}`
    console.error(error, { rate, currency, expectedMin: range.min, expectedMax: range.max })
    return { valid: false, error }
  }

  if (rate > range.max) {
    const error = `[RateValidation] BCH rate ${rate} is suspiciously high for ${currency}. Expected range: ${range.min}-${range.max}`
    console.error(error, { rate, currency, expectedMin: range.min, expectedMax: range.max })
    return { valid: false, error }
  }

  return { valid: true }
}

/**
 * Validates a token exchange rate
 * @param {number} rate - Rate (can be fiat per token or token per fiat depending on context)
 * @param {boolean} isStablecoin - Whether this is a stablecoin (should be ~1:1)
 * @param {boolean} isTokenPerFiat - Whether the rate is "token per fiat" (true) or "fiat per token" (false)
 * @returns {{valid: boolean, error?: string}}
 */
export function validateTokenRate(rate, isStablecoin = false, isTokenPerFiat = false) {
  if (!rate || rate === 0) {
    const error = `[RateValidation] Token rate is zero or missing (stablecoin: ${isStablecoin}, tokenPerFiat: ${isTokenPerFiat})`
    console.error(error, { rate, isStablecoin, isTokenPerFiat })
    return { valid: false, error }
  }

  if (isNaN(rate) || !isFinite(rate)) {
    const error = `[RateValidation] Token rate is not a valid number (stablecoin: ${isStablecoin}, tokenPerFiat: ${isTokenPerFiat})`
    console.error(error, { rate, isStablecoin, isTokenPerFiat })
    return { valid: false, error }
  }

  if (rate < 0) {
    const error = `[RateValidation] Token rate cannot be negative (stablecoin: ${isStablecoin}, tokenPerFiat: ${isTokenPerFiat})`
    console.error(error, { rate, isStablecoin, isTokenPerFiat })
    return { valid: false, error }
  }

  // For "token per fiat" rates, skip the stablecoin range check
  // because the rate depends on the fiat currency (e.g., 0.017 MUSD per PHP is correct)
  if (isTokenPerFiat) {
    // Just check it's not zero or astronomical - any positive value is potentially valid
    const minRate = 1e-10 // Very small but not zero
    const maxRate = 1e10 // Very large but not infinite
    if (rate < minRate || rate > maxRate) {
      const error = `[RateValidation] Token per fiat rate ${rate} is outside reasonable bounds (range: ${minRate}-${maxRate})`
      console.error(error, { rate, isStablecoin, isTokenPerFiat, expectedMin: minRate, expectedMax: maxRate })
      return { valid: false, error }
    }
    return { valid: true }
  }

  // For "fiat per token" rates, apply normal validation
  const range = isStablecoin 
    ? REASONABLE_TOKEN_RATE_RANGES.STABLECOIN 
    : REASONABLE_TOKEN_RATE_RANGES.DEFAULT

  // For stablecoins, check if rate is close to 1 (within 10x)
  if (isStablecoin) {
    if (rate < range.min || rate > range.max) {
      const error = `[RateValidation] Stablecoin rate ${rate} is suspicious. Expected to be close to 1:1 (range: ${range.min}-${range.max})`
      console.error(error, { rate, isStablecoin, isTokenPerFiat, expectedMin: range.min, expectedMax: range.max })
      return { valid: false, error }
    }
  } else {
    // For other tokens, just check it's not zero or astronomical
    if (rate < range.min || rate > range.max) {
      const error = `[RateValidation] Token rate ${rate} is outside reasonable bounds (range: ${range.min}-${range.max})`
      console.error(error, { rate, isStablecoin, isTokenPerFiat, expectedMin: range.min, expectedMax: range.max })
      return { valid: false, error }
    }
  }

  return { valid: true }
}

/**
 * Validates a conversion result to ensure it's reasonable
 * @param {number} fiatAmount - Original fiat amount
 * @param {number} cryptoAmount - Converted crypto amount
 * @param {string} fiatCurrency - Fiat currency code
 * @param {string} cryptoType - 'BCH' or 'TOKEN'
 * @param {number} expectedRate - The rate used for conversion (for validation)
 * @returns {{valid: boolean, error?: string, warning?: string}}
 */
export function validateConversionResult(fiatAmount, cryptoAmount, fiatCurrency, cryptoType, expectedRate) {
  // Basic sanity checks - these are always required
  if (!fiatAmount || fiatAmount <= 0) {
    const error = `[RateValidation] Fiat amount must be greater than zero`
    console.error(error, { fiatAmount, cryptoAmount, fiatCurrency, cryptoType })
    return { valid: false, error }
  }

  if (isNaN(cryptoAmount) || !isFinite(cryptoAmount)) {
    const error = `[RateValidation] Converted crypto amount is not a valid number`
    console.error(error, { fiatAmount, cryptoAmount, fiatCurrency, cryptoType, expectedRate })
    return { valid: false, error }
  }

  if (cryptoAmount <= 0) {
    const error = `[RateValidation] Converted crypto amount must be greater than zero`
    console.error(error, { fiatAmount, cryptoAmount, fiatCurrency, cryptoType, expectedRate })
    return { valid: false, error }
  }

  // For tokens, we can't know acceptable ranges without context (stablecoin, token value, etc.)
  // So we only do basic sanity checks and skip strict validation
  if (cryptoType === 'TOKEN') {
    // Only check for extremely suspicious values (essentially zero or infinite)
    const conversionRatio = cryptoAmount / fiatAmount
    if (conversionRatio < 1e-20 || conversionRatio > 1e20) {
      const error = `[RateValidation] Conversion ratio ${conversionRatio} is extremely suspicious (near zero or infinite)`
      console.error(error, { 
        fiatAmount, 
        cryptoAmount, 
        fiatCurrency, 
        cryptoType, 
        expectedRate,
        conversionRatio
      })
      return { valid: false, error }
    }
    // For tokens, we trust the rate validation that was done earlier
    // and don't do additional strict checks on conversion results
    return { valid: true }
  }

  // For BCH, we can do more validation since we know the expected ranges
  // Check if crypto amount is suspiciously small (dust level or below)
  const dustThreshold = 546e-8 // BCH dust is 546 satoshis
  if (cryptoAmount < dustThreshold && fiatAmount > 1) {
    const error = `[RateValidation] Conversion result ${cryptoAmount} is suspiciously small for fiat amount ${fiatAmount} ${fiatCurrency}`
    console.error(error, { 
      fiatAmount, 
      cryptoAmount, 
      fiatCurrency, 
      cryptoType, 
      expectedRate,
      dustThreshold 
    })
    return { valid: false, error }
  }

  // Calculate the effective rate from the conversion
  const effectiveRate = fiatAmount / cryptoAmount

  // Validate the effective rate for BCH
  const rateValidation = validateBchRate(effectiveRate, fiatCurrency)
  if (!rateValidation.valid) {
    const error = `[RateValidation] Conversion produces invalid rate: ${rateValidation.error}. Fiat: ${fiatAmount} ${fiatCurrency}, Crypto: ${cryptoAmount} ${cryptoType}`
    console.error(error, { 
      fiatAmount, 
      cryptoAmount, 
      fiatCurrency, 
      cryptoType, 
      expectedRate,
      effectiveRate 
    })
    return { valid: false, error }
  }

  // For BCH, check if the conversion ratio is reasonable
  // For example, 1000 ARS should not convert to 0.0000000001 BCH or 10000 BCH
  const conversionRatio = cryptoAmount / fiatAmount
  
  if (conversionRatio < MIN_REASONABLE_CONVERSION_RATIO) {
    const error = `[RateValidation] Conversion ratio ${conversionRatio} is suspiciously small. This suggests the rate may be incorrect.`
    console.error(error, { 
      fiatAmount, 
      cryptoAmount, 
      fiatCurrency, 
      cryptoType, 
      expectedRate,
      conversionRatio,
      minRatio: MIN_REASONABLE_CONVERSION_RATIO 
    })
    return { valid: false, error }
  }

  if (conversionRatio > MAX_REASONABLE_CONVERSION_RATIO) {
    const error = `[RateValidation] Conversion ratio ${conversionRatio} is suspiciously large. This suggests the rate may be incorrect.`
    console.error(error, { 
      fiatAmount, 
      cryptoAmount, 
      fiatCurrency, 
      cryptoType, 
      expectedRate,
      conversionRatio,
      maxRatio: MAX_REASONABLE_CONVERSION_RATIO 
    })
    return { valid: false, error }
  }

  // Compare expected rate with effective rate (should be close) - only for BCH
  if (expectedRate && expectedRate > 0) {
    const rateDifference = Math.abs(effectiveRate - expectedRate) / expectedRate
    if (rateDifference > 0.5) { // More than 50% difference
      const error = `[RateValidation] Effective conversion rate (${effectiveRate}) differs significantly from expected rate (${expectedRate}). Difference: ${(rateDifference * 100).toFixed(2)}%`
      console.error(error, { 
        fiatAmount, 
        cryptoAmount, 
        fiatCurrency, 
        cryptoType, 
        expectedRate,
        effectiveRate,
        rateDifference: `${(rateDifference * 100).toFixed(2)}%` 
      })
      return { valid: false, error }
    }
  }

  return { valid: true }
}


