import { ref, computed } from 'vue';
import { toValue, objectPick } from "@vueuse/core";

import { TaxType } from 'src/marketplace/objects.js';

export const taxCodeOptions = [
  {
    value: 'tax_exclusive',
    label: 'Tax Exclusive',
    description: 'Prices of products assigned to this tax code do not have taxes included',
  },
  {
    value: 'tax_inclusive',
    label: 'Tax Inclusive',
    description: 'Prices of products assigned to this tax code already have taxes included',
  },
  {
    value: 'non_tax',
    label: 'Non Tax',
    description: 'Prices of products assigned to this tax code are not taxable',
  },
  {
    value: 'tax_exempt',
    label: 'Tax exempt',
    description: 'Prices of products assigned to this tax code are taxable but not taxed for special cases',
  },
];

/**
 * Tax codes where the rate/value does not apply and is forced to zero.
 */
export const zeroValueTaxCodes = ['non_tax', 'tax_exempt'];

const taxCodeLabelMap = taxCodeOptions.reduce((map, opt) => {
  map[opt.value] = opt.label;
  return map;
}, {});

/**
 * Shared display helpers for tax types, used by the tax type list/detail and
 * anywhere a tax type is shown (e.g. tax regimes, benefit programs).
 */
export function useTaxTypeHelpers() {
  function getTaxCodeLabel(code) {
    if (!code) return '—';
    return taxCodeLabelMap[code] || code;
  }

  function isZeroValueTaxCode(code) {
    return zeroValueTaxCodes.includes(code);
  }

  /**
   * @param {import('src/marketplace/objects').TaxType} taxType
   * @param {Object} [opts]
   * @param {Boolean} [opts.hideZeroValue] omit the rate for zero-value tax codes
   */
  function taxRateLabel(taxType, opts = {}) {
    if (!Number.isFinite(taxType?.value)) return '';
    if (opts.hideZeroValue && isZeroValueTaxCode(taxType?.code)) return '';
    return `${Number(taxType.value.toFixed(2))}%`;
  }

  /** Name with the rate appended, e.g. `VAT (12%)`. */
  function taxTypeLabel(taxType) {
    if (!taxType?.name) return '—';
    const rate = taxRateLabel(taxType, { hideZeroValue: true });
    return rate ? `${taxType.name} (${rate})` : taxType.name;
  }

  return {
    getTaxCodeLabel,
    isZeroValueTaxCode,
    taxRateLabel,
    taxTypeLabel,
  };
}

/**
 * 
 * @param {import("vue").Ref<TaxType[]>} taxTypesRef 
 */
export function useTaxTypesForm(taxTypesRef) {

  let idCtr = 0;
  function createEmptyRow() {
    return { _id: idCtr++, ...extractTaxType(), value: 0 }
  }

  const taxTypesFormData = ref([].map(() => {
    return createEmptyRow()
  }))

  function resetFormData() {
    taxTypesFormData.value = toValue(taxTypesRef).map(taxType => {
      return { _id: idCtr++, ...extractTaxType(taxType)}
    })
  }

  const normalizedTaxTypes = computed(() => normalizeTaxTypes(toValue(taxTypesRef)));
  const normalizedFormData = computed(() => normalizeTaxTypes(toValue(taxTypesFormData)));
  const edited = computed(() => JSON.stringify(normalizedTaxTypes.value) != JSON.stringify(normalizedFormData.value))

  return {
    taxCodeOptions,
    taxTypes: taxTypesRef,
    createEmptyRow,
    resetFormData,
    taxTypesFormData,
    normalizedFormData,
    edited,
  }
}

function extractTaxType(taxType = TaxType.parse()) {
  const fields = ['name', 'code', 'value']
  return {...objectPick(taxType, fields) }
}
function normalizeTaxTypes(taxTypesList = [].map(TaxType.parse)) {
    return taxTypesList
      .map(extractTaxType)
      .filter(taxType => taxType.name || taxType.code || taxType.value)
      .sort((taxType1, taxType2) => {
        const name = safeSort(taxType1.name, taxType2.name);
        if (name !== 0) return name;
        const code = safeSort(taxType1.code, taxType2.code);
        if (code !== 0) return code;
        return safeSort(taxType1.value, taxType2.value);
      })
}

/**
 * 
 * @param {null | string | number} a 
 * @param {null | string | number} b 
 * @returns 
 */
function safeSort(a, b) {
  const aIsNullType = a === null || a === undefined
  const bIsNullType = b === null || b === undefined
  if (aIsNullType && bIsNullType) return 0;
  if (aIsNullType) return 1;
  if (bIsNullType) return -1;

  // Both are numbers
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  // Both are strings
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b);
  }

  // Mixed types: numbers before strings
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;

  return 0;
}