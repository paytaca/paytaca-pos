import { useSettingsStore } from 'src/stores/settings'

/**
 * Maps app language codes to proper locale codes for Intl.NumberFormat
 */
function getLocaleFromLanguage(language) {
  const localeMap = {
    'en-us': 'en-US',
    'en': 'en-US',
    'de': 'de-DE',
    'zh-cn': 'zh-CN',
    'zh-tw': 'zh-TW',
    'es': 'es-ES',
    'es-ar': 'es-AR',
    'pt': 'pt-PT',
    'pt-br': 'pt-BR',
    'ha': 'ha',
    'af': 'af',
    'ceb': 'ceb',
    'nl': 'nl-NL',
    'id': 'id-ID',
    'it': 'it-IT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
  }
  
  return localeMap[language] || localeMap['en-us']
}

/**
 * Formats a number according to the user's locale
 * @param {number} value - The number to format
 * @param {Object} options - Intl.NumberFormat options
 * @param {number} options.minimumFractionDigits - Minimum decimal places (default: 0)
 * @param {number} options.maximumFractionDigits - Maximum decimal places (default: 20)
 * @param {boolean} options.useGrouping - Whether to use thousand separators (default: true)
 * @returns {string} Formatted number string
 */
export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || isNaN(value)) {
    return String(value ?? '')
  }

  const settingsStore = useSettingsStore()
  const locale = getLocaleFromLanguage(settingsStore.language)
  
  const defaultOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
    useGrouping: true,
    ...options
  }

  return new Intl.NumberFormat(locale, defaultOptions).format(value)
}

/**
 * Formats a number with a specific number of decimal places
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatNumberWithDecimals(value, decimals) {
  return formatNumber(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

/**
 * Formats a number with automatic decimal places (removes trailing zeros)
 * @param {number} value - The number to format
 * @param {number} maxDecimals - Maximum decimal places
 * @returns {string} Formatted number string
 */
export function formatNumberAutoDecimals(value, maxDecimals = 20) {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  })
}

/**
 * Normalizes a numeric input string to a number, handling both . and , as decimal separators
 * This function intelligently determines whether comma or dot is the decimal separator
 * @param {string|number} input - The input string or number (can contain . or , as decimal separator)
 * @returns {number|null} - The parsed number, or null if invalid
 */
export function parseNumericInput(input) {
  if (input === null || input === undefined || input === '') return null
  
  // If it's already a number, return it
  if (typeof input === 'number') {
    return isNaN(input) ? null : input
  }
  
  // Convert to string and trim
  const str = String(input).trim()
  if (str === '') return null
  
  // Remove any spaces (common thousand separator)
  let cleaned = str.replace(/\s/g, '')
  
  // Handle negative sign
  const isNegative = cleaned.startsWith('-')
  if (isNegative) {
    cleaned = cleaned.substring(1)
  }
  
  // Determine decimal separator:
  // - If both . and , are present: the last one is the decimal separator
  // - If only one is present: it's the decimal separator
  // - If neither: it's an integer
  
  const lastDotIndex = cleaned.lastIndexOf('.')
  const lastCommaIndex = cleaned.lastIndexOf(',')
  
  if (lastDotIndex !== -1 && lastCommaIndex !== -1) {
    // Both present - the last one is the decimal separator
    if (lastDotIndex > lastCommaIndex) {
      // Dot is decimal, comma is thousand separator
      cleaned = cleaned.replace(/,/g, '')
    } else {
      // Comma is decimal, dot is thousand separator
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
  } else if (lastCommaIndex !== -1) {
    // Only comma - treat as decimal separator (common in es-AR, de-DE, etc.)
    cleaned = cleaned.replace(',', '.')
  }
  // If only dot or neither, no change needed (dot is already the decimal separator)
  
  // Remove any remaining non-numeric characters except dot and minus
  cleaned = cleaned.replace(/[^\d.]/g, '')
  
  // Handle multiple dots (shouldn't happen, but be safe)
  const dotCount = (cleaned.match(/\./g) || []).length
  if (dotCount > 1) {
    // Keep only the last dot
    const lastDot = cleaned.lastIndexOf('.')
    cleaned = cleaned.substring(0, lastDot).replace(/\./g, '') + cleaned.substring(lastDot)
  }
  
  // Parse the cleaned string
  const parsed = parseFloat(cleaned)
  
  if (isNaN(parsed)) return null
  
  // Restore negative sign if needed
  return isNegative ? -parsed : parsed
}

/**
 * Gets the decimal separator for the current locale
 * @returns {string} - The decimal separator ('.' or ',')
 */
export function getDecimalSeparator() {
  const settingsStore = useSettingsStore()
  const locale = getLocaleFromLanguage(settingsStore.language)
  
  // Use Intl.NumberFormat to determine the decimal separator
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
  
  // Format a number with decimals to see what separator is used
  const formatted = formatter.format(1.5)
  // The separator is the character between '1' and '5'
  const match = formatted.match(/1(.)5/)
  return match ? match[1] : '.'
}

/**
 * Gets the thousand separator for the current locale
 * @returns {string} - The thousand separator (usually ',' or '.' or ' ')
 */
export function getThousandSeparator() {
  const settingsStore = useSettingsStore()
  const locale = getLocaleFromLanguage(settingsStore.language)
  
  // Use Intl.NumberFormat to determine the thousand separator
  const formatter = new Intl.NumberFormat(locale, {
    useGrouping: true
  })
  
  // Format a number with thousands to see what separator is used
  const formatted = formatter.format(1234)
  // The separator is the character between '1' and '2'
  const match = formatted.match(/1(.)234/)
  return match ? match[1] : ','
}

