
/**
 * @typedef {Object} SalesReportData
 * @property {Number} month
 * @property {Number} year
 * @property {Number} day
 * @property {Number} total
 * @property {String} currency
 * @property {Number} totalMarketValue
 * @property {Number} count
 * @property {String} ftCategory
 */

/**
 * @param {SalesReportData[]} reports
 */
export function summarizeSalesReports(reports) {
  /** @type {Map<String, Number>} */
  let tokenAmountsMap = new Map();
  let total = 0;
  let totalMarketValue = 0;
  let count = 0;
  let currency;
  let hasMissingMarketValue = false;

  for (const reportData of reports) {
    count += reportData.count;
    if (reportData.ftCategory) {
      tokenAmountsMap.set(
        reportData.ftCategory,
        (tokenAmountsMap.get(reportData.ftCategory) || 0) + reportData.total
      );
    } else {
      total += reportData.total;
    }

    if (!reportData.currency || !reportData.totalMarketValue || hasMissingMarketValue) {
      hasMissingMarketValue = true;
      currency = null;
      totalMarketValue = null;
    } else {
      currency = reportData.currency;
      totalMarketValue += reportData.totalMarketValue;
    }
  }

  const tokenAmounts = [];
  for (const [ftCategory, amount] of tokenAmountsMap.entries()) {
    tokenAmounts.push({ category: ftCategory, amount })
  }

  total = Number(total.toFixed(8));
  totalMarketValue = Number(totalMarketValue?.toFixed?.(2));
  return { total, currency, totalMarketValue, tokenAmounts, count }
}
