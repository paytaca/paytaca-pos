import { backend } from "src/marketplace/backend";
import { useMarketplaceStore } from "src/stores/marketplace";
import { formatTimestampToText } from "src/marketplace/utils";
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";

export function useDiscountFormHelpers() {
  const { t: $t } = useI18n();
  const discountCodeOptions = [
    {
      value: "with_tax",
      label: $t("WithTax", {}, "With Tax"),
      description:
        "Discount amount is based on unit price after taxes and applied after taxes",
    },
    {
      value: "less_tax",
      label: $t("LessTax", {}, "Less Tax"),
      description:
        "Discount amount is based on unit price before taxes and applied before taxes",
    },
  ];

  const discountScopeOptions = [
    {
      value: "line_item",
      label: $t("LineItem", {}, "Line Item"),
    },
    {
      value: "order",
      label: $t("Order"),
    },
    // {
    //   value: "delivery_fee",
    //   label: $t("DeliveryFee", {}, "DeliveryFee"),
    // },
  ];

  const discountCalculationTypeOptions = [
    {
      value: "fixed",
      label: $t("Fixed"),
    },
    {
      value: "percentage",
      label: $t("Percentage"),
    },
  ];


  function convertFlatConditionGroupsToFormData(conditionGroups) {
    if (!Array.isArray(conditionGroups) || conditionGroups.length === 0) {
      return null;
    }

    const groupMap = new Map();
    conditionGroups.forEach((group) => {
      groupMap.set(group.id, group);
    });

    const childrenMap = new Map();
    const rootGroups = [];

    conditionGroups.forEach((group) => {
      if (!group.parentId || !groupMap.has(group.parentId)) {
        rootGroups.push(group);
      } else {
        if (!childrenMap.has(group.parentId)) {
          childrenMap.set(group.parentId, []);
        }
        childrenMap.get(group.parentId).push(group);
      }
    });

    function buildTree(group) {
      const children = childrenMap.get(group.id) || [];
      return {
        logic: group.logic || "AND",
        conditions: Array.isArray(group.conditions)
          ? group.conditions.map((condition) => ({
              ruleType: condition.ruleType,
              operator: condition.operator,
              value: condition.value,
            }))
          : [],
        children: children.map(buildTree),
      };
    }

    if (rootGroups.length === 1) {
      return buildTree(rootGroups[0]);
    }

    return {
      logic: "AND",
      conditions: [],
      children: rootGroups.map(buildTree),
    };
  }


  return {
    discountCodeOptions,
    discountScopeOptions,
    discountCalculationTypeOptions,
    convertFlatConditionGroupsToFormData,
  };
}

export function useDiscountConditionHelpers() {
  const marketplaceStore = useMarketplaceStore();
  const productCategories = ref([]);
  const productCategoriesOptions = computed(() => {
    if (!Array.isArray(productCategories.value)) return;
    return productCategories.value.map((category) =>
      Object({
        label: category,
        value: category,
        color: "brandblue",
      })
    );
  });

  async function updateProductCategories() {
    const params = {
      shop_id: marketplaceStore.activeShopId,
    };
    return backend.get(`product-categories/`, { params }).then((response) => {
      if (!Array.isArray(response?.data?.results))
        return Promise.reject({ response });
      productCategories.value = response?.data?.results
        .map((category) => category?.name)
        .filter(Boolean);
      return response;
    });
  }

  return {
    productCategories,
    updateProductCategories,
    productCategoriesOptions,
  };
}

export function useDiscountRuleTypesAndConditionsMap() {
  const { t: $t } = useI18n();

  const ruleTypesAndConditionsMap = {
    product: {
      "": {
        title: $t("SpecificProduct", "Specific Product"),
        description: $t(
          "AppliesToSingleProduct",
          "Applies to a specific product"
        ),
      },
      in: {
        title: $t("SelectedProducts", "Selected Products"),
        description: $t(
          "AppliesToOneOfSelectedProducts",
          "Applies to one of the selected products"
        ),
      },
    },
    category: {
      "": {
        title: $t("SpecificCategory", "Specific Category"),
        description: $t(
          "AppliesToProductsInCategory",
          "Applies to products in a specific category"
        ),
      },
      in: {
        title: $t("SelectedCategories", "Selected Categories"),
        description: $t(
          "AppliesToProductsInOneOfSelectedCategories",
          "Applies to products in one of the selected categories"
        ),
      },
    },
    subtotal: {
      "": {
        title: $t("ExactSubtotal", "Exact Subtotal"),
        description: $t(
          "OrderSubtotalEquals",
          "Order subtotal equals the specified amount"
        ),
      },
      lt: {
        title: $t("SubtotalBelow", "Subtotal Below"),
        description: $t(
          "OrderSubtotalLessThan",
          "Order subtotal is less than the specified amount"
        ),
      },
      lte: {
        title: $t("SubtotalAtMost", "Subtotal At Most"),
        description: $t(
          "OrderSubtotalLessThanOrEqual",
          "Order subtotal is less than or equal to the specified amount"
        ),
      },
      gt: {
        title: $t("SubtotalAbove", "Subtotal Above"),
        description: $t(
          "OrderSubtotalGreaterThan",
          "Order subtotal is greater than the specified amount"
        ),
      },
      gte: {
        title: $t("SubtotalAtLeast", "Subtotal At Least"),
        description: $t(
          "OrderSubtotalGreaterThanOrEqual",
          "Order subtotal is greater than or equal to the specified amount"
        ),
      },
    },
    customer: {
      "": {
        title: $t("SpecificCustomer", "Specific Customer"),
        description: $t(
          "AppliesToSingleCustomer",
          "Applies to a specific customer"
        ),
      },
      in: {
        title: $t("SelectedCustomers", "Selected Customers"),
        description: $t(
          "AppliesToOneOfSelectedCustomers",
          "Applies to one of the selected customers"
        ),
      },
    },
    shop: {
      "": {
        title: $t("SpecificShop", "Specific Shop"),
        description: $t(
          "AppliesToSpecificShop",
          "Applies when ordering from a specific shop"
        ),
      },
      in: {
        title: $t("SelectedShops", "Selected Shops"),
        description: $t(
          "AppliesToOneOfSelectedShops",
          "Applies when ordering from one of the selected shops"
        ),
      },
    },
  };

  function getDiscountConditionText(ruleType, condition) {
    return (
      ruleTypesAndConditionsMap[ruleType]?.[condition] || {
        title: `${getRuleTypeText(ruleType)}: ${getOperatorText(condition)}`,
        description: "",
      }
    );
  }

  function getRuleTypeText(ruleType) {
    const ruleTypeMap = {
      product: $t("Product", "Product"),
      category: $t("Category", "Category"),
      subtotal: $t("Subtotal", "Subtotal"),
      customer: $t("Customer", "Customer"),
      shop: $t("Shop", "Shop"),
    };
    return ruleTypeMap[ruleType] || ruleType;
  }

  function getOperatorText(operator) {
    const operatorMap = {
      "": $t("Equals", "Equals"),
      in: $t("In", "In"),
      lt: $t("LessThan", "Less than"),
      lte: $t("LessThanOrEqual", "Less than or equal to"),
      gt: $t("GreaterThan", "Greater than"),
      gte: $t("GreaterThanOrEqual", "Greater than or equal to"),
    };
    return operatorMap[operator] || operator;
  }

  return {
    ruleTypesAndConditionsMap,
    getDiscountConditionText,
    getRuleTypeText,
    getOperatorText,
  };
}

/**
 * Shared display helpers for discount types, used by the discounts list and the
 * discount/benefit detail dialogs so labels and value formatting stay in sync.
 */
export function useDiscountTypeHelpers() {
  const { t: $t } = useI18n();
  const marketplaceStore = useMarketplaceStore();
  const { discountCodeOptions, discountScopeOptions, discountCalculationTypeOptions } =
    useDiscountFormHelpers();

  function labelFromOptions(options, value) {
    if (value === undefined || value === null || value === "") return "—";
    return options.find((opt) => opt.value === value)?.label || value;
  }

  function getDiscountCodeLabel(code) {
    return labelFromOptions(discountCodeOptions, code);
  }
  function getDiscountScopeLabel(scope) {
    return labelFromOptions(discountScopeOptions, scope);
  }
  function getDiscountTypeLabel(type) {
    return labelFromOptions(discountCalculationTypeOptions, type);
  }

  function getDiscountCurrencySymbol(discount) {
    return (
      discount?.currency?.symbol ||
      discount?.currency?.code ||
      marketplaceStore?.merchant?.currency?.symbol ||
      marketplaceStore?.merchant?.currency?.code ||
      ""
    );
  }

  /**
   * Value label for a discount, e.g. `10%`, `50 PHP`, or with the cap
   * `10% max 100 PHP` (disable with `{ includeMax: false }`).
   * @param {import('src/marketplace/objects').DiscountType} discount
   */
  function formatDiscountValue(discount, opts = {}) {
    const includeMax = opts.includeMax !== false;
    const currency = getDiscountCurrencySymbol(discount);

    let label = "—";
    if (discount?.type === "percentage") {
      label = `${Number((Number(discount?.value || 0) * 100).toFixed(2))}%`;
    } else if (discount?.value != null && Number.isFinite(Number(discount.value))) {
      const value = Number(discount.value).toFixed(2);
      label = currency ? `${Number(value)} ${currency}` : `${Number(value)}`;
    }

    const maxAmount = Number(discount?.maxAmount);
    if (includeMax && Number.isFinite(maxAmount) && maxAmount > 0) {
      label += ` ${$t("Max", "max")} ${Number(maxAmount.toFixed(2))}`;
      if (currency) label += ` ${currency}`;
    }
    return label;
  }

  function getDiscountDateRangeText(discount) {
    const startsAt = discount?.startsAt;
    const endsAt = discount?.endsAt;
    if (!startsAt && !endsAt) return "";
    const startText = startsAt ? formatTimestampToText(startsAt) : "";
    const endText = endsAt ? formatTimestampToText(endsAt) : "";
    if (startText && endText) return `${startText} – ${endText}`;
    return startText || endText;
  }

  return {
    getDiscountCodeLabel,
    getDiscountScopeLabel,
    getDiscountTypeLabel,
    getDiscountCurrencySymbol,
    formatDiscountValue,
    getDiscountDateRangeText,
  };
}
