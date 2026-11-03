import { useI18n } from 'vue-i18n'

export function useDiscountReportHelpers() {
  const { t: $t } = useI18n()

  /**
   * Normalizes an API error into a user-facing message.
   *
   * @param {any} error
   * @param {{ mode?: 'history' | 'basket' }} [options]
   */
  function parseReportError(error, options = {}) {
    const mode = options.mode || 'history'
    const data = error?.response?.data

    if (typeof data === 'string' && data) return data
    if (typeof data?.detail === 'string') return data.detail

    const nonFieldErrors = data?.non_field_errors
    if (Array.isArray(nonFieldErrors) && nonFieldErrors.length) {
      return String(nonFieldErrors[0])
    }
    if (Array.isArray(data) && data.length) {
      if (typeof data[0] === 'string') return data[0]
    }
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value) return `${key}: ${value}`
        if (Array.isArray(value) && typeof value[0] === 'string') {
          return `${key}: ${value[0]}`
        }
      }
    }

    if (mode === 'basket') {
      return $t(
        'ForecastFailed',
        {},
        'Unable to generate a forecast right now.',
      )
    }
    return $t(
      'ReportFailed',
      {},
      'Unable to load the discount report right now.',
    )
  }

  return {
    parseReportError,
  }
}
