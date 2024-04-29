/**
 * 
 * @typedef {Object} AddonOptionInfoAPI
 * @property {String} label
 * @property {Number} price
 * @property {Number} markup_price
 * @property {Boolean} require_input
 * 
 * @typedef {Object} AddonOptionInfo
 * @property {String} label
 * @property {Number} price
 * @property {Number} [markupPrice]
 * @property {Boolean} requireInput
 * 
 * @typedef {Object} AddonInfo
 * @property {String} label
 * @property {Number} minOpts
 * @property {Number} maxOpts
 * @property {AddonOptionInfo[]} options
 * 
 * @typedef {Object} AddonInfoAPI
 * @property {String} label
 * @property {Number} min_opts
 * @property {Number} max_opts
 * @property {AddonOptionInfoAPI[]} options
 */


/**
 * @param {AddonInfo | AddonInfoAPI} addon 
 */
export function parseProductAddon(addon) {
  return {
    label: addon?.label,
    minOpts: addon?.minOpts ?? addon?.min__opts,
    maxOpts: addon?.maxOpts ?? addon?.max__opts,
    options: (Array.isArray(addon?.options) ? addon.options : [])?.map?.(opt => {
      return {
        label: opt?.label,
        price: opt?.price,
        markupPrice: opt?.markupPrice || opt?.markup_price,
        requireInput: opt?.requireInput ?? opt?.require_input,
      }
    })
  }
}
