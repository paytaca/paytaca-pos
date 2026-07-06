/**
 * @param {Number | String} number
 * @param {Object} opts
 * @param {Number} opts.decimals number of decimals it needs to have, e.g. 0.1 => 0.10
 * @param {Boolean} opts.forceDecimals whether whole numbers needs a decimals also
 */
export function formatCurrencyAmount(number, opts = { decimals: 2, forceDecimals: false }) {
  const num = Number(number);
  if (Number.isNaN(num)) return "";

  const decimals = opts?.decimals ?? 2;
  const forceDecimals = opts?.forceDecimals ?? false;

  let result = num.toFixed(decimals);

  if (!forceDecimals) {
    result = result.replace(/\.0+$/, "");
  }

  return result;
}
