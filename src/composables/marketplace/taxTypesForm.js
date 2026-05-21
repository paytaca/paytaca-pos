import { ref, computed } from 'vue';
import { toValue, objectPick } from "@vueuse/core";

import { TaxType } from 'src/marketplace/objects.js';

/**
 * 
 * @param {import("vue").Ref<TaxType[]>} taxTypesRef 
 */
export function useTaxTypesForm(taxTypesRef) {
  const taxCodeOptions = [
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