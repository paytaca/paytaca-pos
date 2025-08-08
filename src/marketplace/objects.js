import { i18n } from "src/boot/i18n"
import { capitalize } from "vue"
import { backend } from "./backend"
import { getOrderUpdatesTexts, getPurchaseOrderUpdatesTexts } from "./edit-history-utils"
import { decompressEncryptedMessage, decryptMessage, decompressEncryptedImage, decryptImage } from "./chat/encryption"
import { formatOrderStatus, formatPurchaseOrderStatus, formatStatusGeneric, lineItemPropertiesToText, parseOrderStatusColor, parsePurchaseOrderStatusColor } from './utils'

const { t: $t } = i18n.global
export const ROLES = Object.freeze({
  admin: 'shop_admin',
  inventory: 'inventory_control_manager',
  cashier: 'cashier',
  storefront: 'storefront_staff',
})

export class Location {
  static parse(data) {
    return new Location(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {String} data.address1
   * @param {String} data.address2
   * @param {String} data.street
   * @param {String} data.city
   * @param {String} data.state
   * @param {String} data.country
   * @param {String} data.longitude
   * @param {String} data.latitude
   * @param {Number} data.utc_offset
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.address1 = data?.address1
    this.address2 = data?.address2
    this.street = data?.street
    this.city = data?.city
    this.state = data?.state
    this.country = data?.country
    this.longitude = data?.longitude
    this.latitude = data?.latitude
    this.utcOffset = data?.utc_offset
  }

  get formatted() {
    const addressStr = [this.address2, this.address1].filter(Boolean).join(' ')
    return [addressStr, this.street, this.city, this.state, this.country].filter(Boolean).join(', ') 
  }

  get validCoordinates() {
    return isFinite(parseFloat(this.longitude)) && isFinite(parseFloat(this.latitude))
  }
}

export class FungibleCashToken {
  static parse(data) {
    return new FungibleCashToken(data)
  }
  
  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {String} data.category
   * @param {String} data.name
   * @param {String} data.description
   * @param {String} data.symbol
   * @param {Number} data.decimals
   * @param {String} data.image_url
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.category = data?.category
    this.name = data?.name
    this.description = data?.description
    this.symbol = data?.symbol
    this.decimals = data?.decimals
    this.imageUrl = data?.image_url
  }
}

export class StockAdjustment {
  static parse(data) {
    return new StockAdjustment(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.source
   * @param {"set" | "add"} data.adjust_type
   * @param {Number} data.previous_quantity
   * @param {Number} data.quantity the meaning of this value depends on the adjust_type
   * @param {Number} [data.sales_order_id]
   * @param {Number} [data.purchase_order_id]
   * @param {Number} [data.stock_recount_id]
   * @param {String} data.created_at
   * @param {{ id:Number, first_name:String, last_name:String }} data.created_by
   */
  set raw(data) {
    this.id = data?.id
    this.source = data?.source
    this.adjustType = data?.adjust_type
    this.previousQuantity = data?.previous_quantity
    this.quantity = data?.quantity
    this.salesOrderId = data?.sales_order_id
    this.purchaseOrderId = data?.purchase_order_id
    this.stockRecountId = data?.stock_recount_id
    this.createdAt = new Date(data?.created_at)
    this.createdBy = {
      id: data?.created_by?.id,
      firstName: data?.created_by?.first_name,
      lastName: data?.created_by?.last_name,
    }
  }

  async fetchSalesOrder() {
    if (!this.salesOrderId) return Promise.reject()
    return backend.get(`sales-orders/${this.salesOrderId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.salesOrder = SalesOrder.parse(response?.data)
        return response
      })
  }

  async fetchPurchaseOrder() {
    if(!this.purchaseOrderId) return Promise.reject()
    return backend.get(`purchase-orders/${this.purchaseOrderId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.purchaseOrder = PurchaseOrder.parse(response?.data)
        return response
      })
  }

  async fetchStockRecount() {
    if (!this.stockRecountId) return Promise.reject()
    return backend.get(`stock-recounts/${this.stockRecountId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.stockRecount = StockRecount.parse(response?.data)
        return response
      })
  }
}

export class Stock {
  static parse(data) {
    return new Stock(data)
  }

  constructor(data) {
    this.raw = data

    this.$state = {
      updating: false,
      updatingFields: new Set(),
      fetchingAdjustments: false,
      fetchingProduct: false,
      fetchingPurchaseOrder: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Object} data.variant
   * @param {Number} data.variant.id
   * @param {Number} data.variant.code
   * @param {String} data.variant.image_url
   * @param {String} data.variant.name
   * @param {Object} data.variant.product
   * @param {Number} data.variant.product.id
   * @param {String} data.variant.product.image_url
   * @param {String} data.variant.product.name
   * @param {Number} data.quantity
   * @param {Number} [data.cost_price]
   * @param {String} [data.expires_at]
   * @param {{id: Number: name: String }} data.shop
   * @param {Object} data.metadata
   * @param {Number} [data.purchase_order_id]
   * @param {String} [data.purchase_order_number]
   * @param {String} data.created_at
   * @param {String} data.updated_at
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.variant = Variant.parse(data?.variant)
    this.quantity = data?.quantity
    this.costPrice = data?.cost_price
    this.shop = data?.shop
    if (data?.expires_at) this.expiresAt = new Date(data?.expires_at)
    else if(this.expiresAt) this.expiresAt = undefined
    this.metadata = data?.metadata
    this.purchaseOrderId = data?.purchase_order_id
    this.purchaseOrderNumber = data?.purchase_order_number
    this.createdAt = new Date(data?.created_at)
    this.updatedAt = new Date(data?.updated_at)
  }

  get imageUrl() {
    return this.variant.imageUrl || this.variant.product.imageUrl
  }

  get itemName() {
    let variantName = this.variant?.name
    let productName = this.variant?.product?.name
    if (!this.variant.id) {
      variantName = variantName || this.metadata?.variant_name
      productName = productName || this.metadata?.product_name
    }
    if (variantName) return `${productName}- ${variantName}`
    return productName
  }

  async fetchProduct() {
    if (!this.variant.product.id) return Promise.reject()
    this.$state.fetchingProduct = true
    return backend.get(`products/${this.variant.product.id}/`).then(response => {
      if (response?.data?.id != this.variant.product.id) return Promise.reject({ response })
      this.product = Product.parse(response.data)
      return this.product
    }).finally(() => {
      this.$state.fetchingProduct = false
    })
  }

  async fetchPurchaseOrder() {
    if (!this.purchaseOrderId) return Promise.reject()

    this.$state.fetchingPurchaseOrder = true
    return backend.get(`purchase-orders/${this.purchaseOrderId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.purchaseOrder = PurchaseOrder.parse(response?.data)
        return response
      })
      .finally(() => {
        this.$state.fetchingPurchaseOrder = false
      })
  }

  async fetchAdjustments(opts={ append: true, limit: 0 }) {
    if (!this.id) return Promise.reject()

    const params = {
      limit: opts?.limit || 5,
    }

    if (opts?.append && Array.isArray(this.adjustments?.data)) {
      this.normalizeAdjustments()
      const dates = this.adjustments.data.map(adjustment => adjustment?.createdAt)?.filter(Boolean)
      const earliest = dates.at(-1)
      if (earliest) params.created_before = earliest.toISOString()
    }

    this.$state.fetchingAdjustments = true
    return backend.get(`stocks/${this.id}/adjustments/`, { params }).then(response => {
      if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
      if (!this.adjustments) this.adjustments = { data: [].map(StockAdjustment.parse), hasMore: false }
    
      this.adjustments.hasMore = response?.data?.count > response?.data?.limit
      const parsedData = response?.data?.results?.map(StockAdjustment.parse)
      if (opts?.append && Array.isArray(this.adjustments.data)) {
        this.adjustments.data = [...this.adjustments.data, ...parsedData]
      } else {
        this.adjustments.data = parsedData
      }
      this.normalizeAdjustments()
      return response
    }).finally(() => {
      this.$state.fetchingAdjustments = false
    })
  }

  /**
   * Sort adjustments by createdAt in descending order, and
   * removes duplicates
   */
  normalizeAdjustments() {
    if (!Array.isArray(this.adjustments?.data)) return
    this.adjustments.data.sort((adjustment1, adjustment2) => {
      return adjustment2?.createdAt - adjustment1?.createdAt
    })

    const uniqueIdFilter = (element, index, list) => {
      return list.findIndex(_element => element?.id == _element?.id) === index
    }
    this.adjustments.data = this.adjustments.data.filter(uniqueIdFilter)
  }

  async refetch(params={}) {
    if (!this.id) return
    this.$state.updating = true
    return backend.get(`stocks/${this.id}/`, { params })
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }
}

export class Variant {
  static parse(data) {
    return new Variant(data)
  }

  /**
   * @param {any} data 
   * @param {Product} [product] 
   */
  constructor(data, product) {
    this.raw = data
    if (product) this.product = product
    this.$state = {
      updating: false,
      fetchingStocks: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {Number} data.position
   * @param {String} data.code
   * @param {String} data.image_url
   * @param {String} data.name
   * @param {Number} data.price
   * @param {Number} data.markup_price
   * @param {Number} data.cutlery_cost
   * @param {Number} data.total_stocks
   * @param {Number} data.expired_stocks
   * @param {{ id:Number, name:String, image_url:String }} [data.product]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.position = data?.position
    this.code = data?.code
    this.imageUrl = data?.image_url
    this.name = data?.name
    this.price = data?.price
    this.markupPrice = data?.markup_price
    this.cutleryCost = data?.cutlery_cost
    this.totalStocks = data?.total_stocks
    this.expiredStocks = data?.expired_stocks

    if (data?.product?.id) this.product = Product.parse(data?.product)
  }

  get itemImage() {
    return this.imageUrl || this.product?.imageUrl
  }

  get itemName() {
    return [this?.product?.name, this.name].filter(Boolean).join(' - ')
  }

  async fetchStocks(opts={ shop_id: undefined }) {
    const params = Object.assign({}, opts, {
      variant_id: this.id
    })

    this.$state.fetchingStocks = true
    return backend.get('/stocks/', { params })
      .then(({ data }) => {
        if (!Array.isArray(data?.results)) return
        this.stocks = data.results.map(Stock.parse)
        return this.stocks
      })
      .finally(() => {
        this.$state.fetchingStocks = false
      })
  }
}

export class Product {
  static parse(data) {
    return new Product(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
      fetchingStocks: false,
      fetchingShops: false,
      updatingCartOptions: false,
      updatingAddons: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {String} [data.code]
   * @param {String[]} data.categories
   * @param {Object[]} [data.cart_options]
   * @param {Object[]} [data.addons]
   * @param {Number} [data.addons_count]
   * @param {Boolean} data.has_cart_options
   * @param {String} data.image_url
   * @param {String} [data.variant_image_url]
   * @param {String} data.name
   * @param {String} [data.description]
   * @param {Number} data.total_stocks
   * @param {Number} data.expired_stocks
   * @param {Number} data.variants_count
   * @param {Number} data.min_markup_price
   * @param {Number} data.max_markup_price
   * @param {Number} data.min_cutlery_cost
   * @param {Number} data.max_cutlery_cost
   * @param {String} [data.created_at]
   * @param {Number[]} data.shop_ids
   * @param {Object[]} [data.variants]
   * @param {Object[]} [data.storefront_products]
   * @param {{ average_rating: String | Number, count: Number }} [data.review_summary]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.code = data?.code
    if (Array.isArray(data?.categories)) this.categories = [...data.categories]
    if (Array.isArray(data?.cart_options)) this.cartOptions = [...data.cart_options]
    if (Array.isArray(data?.addons)) this.addons = data.addons.map(Addon.parse)
    this.addonsCount = data?.addons?.length ?? data?.addons_count
    this.hasCartOptions = data?.has_cart_options
    this.imageUrl = data?.image_url
    this.variantImageUrl = data?.variant_image_url
    this.name = data?.name
    this.description = data?.description
    this.totalStocks = data?.total_stocks
    this.expiredStocks = data?.expired_stocks
    this.variantsCount = data?.variants_count
    this.minMarkupPrice = data?.min_markup_price
    this.maxMarkupPrice = data?.max_markup_price
    this.minCutleryCost = data?.min_cutlery_cost
    this.maxCutleryCost = data?.max_cutlery_cost
    this.shopIds = data?.shop_ids
    if(data?.created_at) this.createdAt = new Date(data?.created_at)

    this.updateVariants(data?.variants)

    this.storefrontProducts = data?.storefront_products?.map?.(StorefrontProduct.parse)
    if (data?.review_summary) {
      this.reviewSummary = {
        averageRating: parseFloat(data?.review_summary?.average_rating),
        count: data?.review_summary?.count,
      }
    } else if (this.reviewSummary) delete this.reviewSummary
  }

  updateData(data) {
    this.raw = data
  }

  get hasVariants() {
    return (this.variantsCount || this.variants?.length) > 1
  }

  get markupPriceRangeText() {
    let text = `${this.minMarkupPrice}`
    if (this.minMarkupPrice != this.maxMarkupPrice) text += ` - ${this.maxMarkupPrice}`
    return text
  }

  get cutleryCostRangeText() {
    let text = `${this.minCutleryCost}`
    if (this.minCutleryCost != this.maxCutleryCost) text += ` - ${this.maxCutleryCost}`
    return text
  }

  get displayImageUrl() {
    if (this.imageUrl) return this.imageUrl
    if (this.variantImageUrl) return this.variantImageUrl

    if (Array.isArray(this.variants)) {
      return this.variants.map(variant => variant.imageUrl).find(Boolean)
    }
    return ''
  }

  get availableStocks() {
    if (this.expiredStocks === null || this.expiredStocks === undefined) {
      return this.totalStocks
    }
    return this.totalStocks - this.expiredStocks
  }

  get availableStocksText() {
    if (!Number.isSafeInteger(this.availableStocks)) return $t('NoStocks')

    return $t('NumberInStock', { num: this.availableStocks }, `${this.availableStocks} in stock`)
  }

  updateVariants(variantsData=[]) {
    const oldVariants = this.variants
    this.variants = [].map(Variant.parse)
    if (Array.isArray(variantsData)) {
      this.variants = variantsData.map(variantData => {
        const existingVariant = oldVariants?.find?.(variant => variant?.id === variantData?.id)

        if (!existingVariant) return new Variant(variantData, this)
        existingVariant.raw = variantData
        existingVariant.product = this
        return existingVariant
      })
    }
  }
 
  availableAtStorefront(storefrontId) {
    if (!Array.isArray(this.storefrontProducts)) return
    const data = this.storefrontProducts.find(storefrontProduct => storefrontProduct?.storefrontId == storefrontId)
    return data?.available
  }

  availableAtStorefrontText(storefrontId) {
    const available = this.availableAtStorefront(storefrontId)
    if (typeof available !== 'boolean') return 
    return available ? 'Available' : 'Unavailable'
  }

  requireStocksAtStorefront(storefrontId) {
    if (!Array.isArray(this.storefrontProducts)) return
    const data = this.storefrontProducts.find(storefrontProduct => storefrontProduct?.storefrontId == storefrontId)
    return data?.requireStocks
  }

  addStorefrontProductData(data) {
    const storefrontProduct = StorefrontProduct.parse(data)
    if (!storefrontProduct?.storefrontId) return
    if (!Array.isArray(this.storefrontProducts)) this.storefrontProducts = []
    const index = this.storefrontProducts?.findIndex(_sp => _sp?.storefrontId == storefrontProduct?.storefrontId)
    if (index >= 0) this.storefrontProducts[index] = storefrontProduct
    else this.storefrontProducts.push(storefrontProduct)

  }

  async fetchStorefrontProduct(storefrontId=0) {
    if (!storefrontId) return Promise.resolve()
    const handle = `${storefrontId}-${this.id}`
    return backend.get(`connecta/storefront-products/${handle}/`)
      .then(response => {
        this.addStorefrontProductData(response?.data)
        return response
      })
  }

  async fetchCartOptions() {
    if (!this.id) return Promise.resolve()

    this.$state.updatingCartOptions = true
    const params = { ids: this.id }
    return backend.get(`products/cart_options/`, { params })
      .then(response => {
        const obj = response?.data?.results?.find(product => product?.id == this?.id)
        console.log('obj', obj)
        if (obj) {
          this.cartOptions = obj?.cart_options
          if (this.$raw) this.$raw.cartOptions = obj?.cart_options
        }
        return response
      })
      .finally(() => {
        this.$state.updatingCartOptions = false
      })
  }


  async fetchAddons() {
    if (!this.id) return Promise.resolve()

    this.$state.updatingAddons = true
    const params = { ids: this.id }
    return backend.get(`products/addons/`, { params })
      .then(response => {
        const obj = response?.data?.results?.find(product => product?.id == this?.id)
        console.log('obj', obj)
        if (obj) {
          this.addons = obj?.addons.map?.(Addon.parse)
          if (this.$raw) this.$raw.cartOptions = obj?.addons
        }
        return response
      })
      .finally(() => {
        this.$state.updatingAddons = false
      })
  }

  async refetch(params={}) {
    if (!this.id) return
    this.$state.updating = true
    return backend.get(`products/${this.id}/`, { params })
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }

  async refetchInfo(opts = { persistVariantData: false }) {
    if (!this.id) return
    this.$state.updating = true

    const params = { ids: this.id }
    return backend.get(`products/info/`, { params })
      .then(response => {
        const data = response?.data?.results?.find(product => product?.id === this.id)
        if (!data) return Promise.reject({ response })
        if (opts?.persistVariantData) Object.assign(data, { variants: this.raw?.variants })
        this.raw = data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }

  async fetchVariants() {
    if (!this.id) return Promise.reject()
    return backend.get(`products/${this.id}/variants/`).then(response => {
      if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
      this.updateVariants(response.data?.results)
      return response
    })
  }

  async fetchStocks() {
    this.$state.fetchingStocks = true
    return backend.get('/stocks/', { params: { product_id: this.id } })
      .then(({ data }) => {
        if (!Array.isArray(data?.results)) return
        
        this.stocks = data.results.map(Stock.parse)
        this.variants.forEach(variant => {
          variant.stocks = this.stocks.filter(stock => stock.variant.id == variant.id)
        })
    
        return this.stocks
      })
      .finally(() => {
        this.$state.fetchingStocks = false
      })
  }
}


export class Addon {
  static parse(data) {
    return new Addon(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.label
   * @param {Number} data.min_opts
   * @param {Number} data.max_opts
   * @param {{ id: Number, label: String, price: Number, markup_price: Number, require_input: Boolean }[]} data.options
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.label = data?.label
    this.minOpts = data?.min_opts
    this.maxOpts = data?.max_opts
    this.options = (Array.isArray(data?.options) ? data.options : []).map(option => {
      return {
        id: option?.id,
        label: option?.label,
        price: option?.price,
        markupPrice: option?.markup_price,
        requireInput: option?.require_input,
      }
    })
  }

  get hasOptions() {
    return this.options?.length > 1
  }

  get option() {
    if (!this.hasOptions) return
    return this.option[0]
  }
}

export class LineItemAddon {
  static parse(data) {
    return new LineItemAddon(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  } 

  /**
   * @param {Object} data
   * @param {Number} data.addon_option_id
   * @param {String} data.label
   * @param {Number} data.price
   * @param {Number} data.markup_price
   * @param {String} data.input_value
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.addonOptionId = data?.addon_option_id
    this.label = data?.label
    this.price = data?.price
    this.markupPrice = data?.markup_price
    this.inputValue = data?.input_value
  }
}


export class Shop {
  static parse(data) {
    return new Shop(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} [data.watchtower_branch_id]
   * @param {Number} data.id
   * @param {String} data.name
   * @param {Number} [data.product_listing_id]
   * @param {Object} data.location
   * @param {String} data.location.address1
   * @param {String} data.location.address2
   * @param {String} data.location.street
   * @param {String} data.location.city
   * @param {String} data.location.state
   * @param {String} data.location.country
   * @param {String} data.location.longitude
   * @param {String} data.location.latitude
  */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.watchtowerBranchId = data?.watchtower_branch_id
    this.id = data?.id
    this.name = data?.name
    this.productListingId = data?.product_listing_id
    this.location = Location.parse(data?.location)
  }
}


export class User {
  static parse(data) {
    return new User(data)
  }

  static parseShopRole(shopRole) {
    return {
      shopId: shopRole?.shop_id,
      roles: Array.isArray(shopRole?.roles) ? shopRole?.roles : [],
    }
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
    }
    this.currentShopId = NaN
  }

  get raw() {
    return this.$raw
  }
  
  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} [data.profile_picture_url]
   * @param {String} [data.email]
   * @param {String} [data.username]
   * @param {String} data.first_name
   * @param {String} data.last_name
   * @param {String} [data.phone_number]
   * @param {{ user_id:Number, shop_id:Number, roles:String[] }[]} [data.shop_roles]
   * @param {Boolean} [data.has_password]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.profilePictureUrl = data?.profile_picture_url
    this.email = data?.email
    this.username = data?.username
    this.firstName = data?.first_name
    this.lastName = data?.last_name
    this.phoneNumber = data?.phone_number
    if (Array.isArray(data?.shop_roles)) {
      this.shopRoles = data.shop_roles.map(User.parseShopRole)
    } else {
      this.shopRoles = [].map(User.parseShopRole)
    }

    this.hasPassword = data?.has_password
  }

  get fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }

  get currentShopRole() {
    return this.shopRoles?.find?.(shopRole => shopRole?.shopId == this.currentShopId)
  }

  getRolesFromShop(shopId) {
    const shopRole = this.shopRoles?.find?.(shopRole => shopRole?.shopId == shopId)
    if (Array.isArray(shopRole?.roles)) return shopRole.roles
    return []
  }
}

export class SalesOrderItem {
  static parse(data) {
    return new SalesOrderItem(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Object} data.variant
   * @param {Number} data.price
   * @param {Number} data.quantity
   * @param {String} data.item_name
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.variant = Variant.parse(data?.variant)
    this.price = data?.price
    this.quantity = data?.quantity
    this.itemName = data?.item_name
  }

  get subtotal() {
    const price = parseFloat(this.price)
    const quantity = parseInt(this.quantity)
    const subtotal = price * quantity
    return Number(subtotal.toFixed(3))
  }
}

export class SalesOrder {
  static parse(data) {
    return new SalesOrder(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.status
   * @param {Boolean} data.draft
   * @param {Number} [data.number]
   * @param {Number} data.total
   * @param {String} data.transaction_date
   * @param {String} data.payment_mode
   * @param {Object} data.bch_price
   * @param {String} data.bch_recipient_address
   * @param {String} data.bch_txid
   * @param {Number} data.received_amount
   * @param {String} data.created_at
   * @param {Number[]} [data.order_ids]
   * @param {{ id:Number, first_name:String, last_name:String }} data.created_by
   * @param {{ code:String, symbol:String }} data.currency
   * @param {{ id:Number, name:String }} data.shop
   * @param {Object[]} [data.items]
   * @param {Number} [data.items_count]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.status = data?.status
    this.draft = data?.draft
    this.number = data?.number
    if (data?.transaction_date) this.transactionDate = new Date(data?.transaction_date)
    this.total = data?.total
    this.currency = {
      code: data?.currency?.code,
      symbol: data?.currency?.symbol,
    }
    this.shop = { id: data?.shop?.id, name: data?.shop?.name }
    this.paymentMode = data?.payment_mode
    this.bchPrice = BchPrice.parse(data?.bch_price)
    this.bchRecipientAddress = data?.bch_recipient_address
    this.bchTxid = data?.bch_txid
    this.receivedAmount = parseFloat(data?.received_amount)
    this.orderIds = data?.order_ids
    if(data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt
    this.createdBy = User.parse(data?.created_by)

    this.itemsCount = data?.items_count
    if (Array.isArray(data?.items)) this.items = data?.items.map(SalesOrderItem.parse)
  }

  get isVoid() {
    return this.status == 'void'
  }

  get parsedPaymentMode() {
    switch(this.paymentMode) {
      case 'bch':
        return 'BCH'
      case 'other':
        return 'Other'
    }
  }

  get parsedStatus() {
    switch(this.status) {
      case 'completed':
      case 'void':
      case 'pending':
        return capitalize(this.status)
    }
  }

  get statusColor() {
    switch(this.status) {
      case 'completed':
        return 'green'
      case 'void':
        return 'grey'
      case 'pending':
        return 'amber'
      default:
        return 
    }
  }

  get calculatedTotal() {
    if (!Array.isArray(this.items)) return NaN

    return this.items?.reduce((subtotal, item) => subtotal + item.subtotal, 0)
  }

  get bchTotal() {
    const bchValue = parseFloat(this.bchPrice?.price)
    const total = parseFloat(this.total)
    if (!bchValue || !total) return

    const bchTotal = total / bchValue
    return Math.floor(bchTotal * 10 ** 8) / 10 ** 8
  }

  get changeAmount() {
    const total = parseFloat(this.total) || this.calculatedTotal
    const receivedAmount = parseFloat(this.receivedAmount)
    const change = receivedAmount - total
    return Math.round(change * 10 ** 3) / 10 ** 3
  }

  get bchTxidLink() {
    const txid = this?.bchTxid
    const isTestnet = this?.bchRecipientAddress?.startsWith?.('bchtest:')

    if (!txid) return ''

    if (isTestnet) return `https://chipnet.imaginary.cash/tx/${txid}`
    return `https://blockchair.com/bitcoin-cash/transaction/${txid}`
  }

  async fetchItems() {
    if (!this.id) return Promise.reject()

    this.$state.updating = true
    return backend.get(`sales-orders/${this.id}/items/`)
      .then(response => {
        if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
        this.items = response?.data?.results.map(SalesOrderItem.parse)
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }

  async refetch() {
    if (!this.id) return Promise.reject()
    this.$state.updating = true
    return backend.get(`sales-orders/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }
}


export class Vendor {
  static parse(data) {
    return new Vendor(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      loading: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.name
   * @param {String} data.phone_number
   * @param {Object} data.location
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.name = data?.name
    this.phoneNumber = data?.phone_number
    this.location = Location.parse(data?.location)
  }

  async refetch() {
    if (!this.id) return Promise.reject()

    this.$state.loading = true
    return backend.get(`vendors/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  } 
}

export class PurchaseOrderItem {
  static parse(data) {
    return new PurchaseOrderItem(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Object} data.variant
   * @param {String} data.item_name
   * @param {Number} data.quantity
   * @param {Number} data.cost_price
   * @param {String} [data.delivered_at]
   * @param {String} [data.expires_at]
   * @param {Number} [data.stock_id]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.variant = Variant.parse(data?.variant)
    this.quantity = data?.quantity
    this.costPrice = data?.cost_price
    if (data?.delivered_at) this.deliveredAt = new Date(data.delivered_at)
    else if (this.deliveredAt) this.deliveredAt = undefined

    if (data?.expires_at) this.expiresAt = new Date(data.expires_at)
    else if (this.expiresAt) this.expiresAt = undefined
    
    if (data?.stock_id) this.stockId = data.stock_id
  }

  get variantName() {
    return [this.variant?.product?.name, this.variant?.name].filter(Boolean).join('- ')
  }

  async fetchStock() {
    if (this.stockId) return Promise.reject()

    return backend.get(`stocks/${this.stockId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.stock = Stock.parse(response?.data)
        return response
      })
  }
}

export class PurchaseOrder {
  static parse(data) {
    return new PurchaseOrder(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      loading: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.status
   * @param {String} data.date
   * @param {Number} data.number
   * @param {{ code:String, symbol:String }} data.currency
   * @param {{ id:Number, name:String }} data.shop
   * @param {{ id:Number, name:String, phone_number:String, location:Object }} data.vendor
   * @param {Number} [data.items_count]
   * @param {Object[]} [data.items]
   * @param {String} data.reviewed_at
   * @param {Object} data.reviewed_by
   * @param {String} data.created_at
   * @param {String} data.updated_at
   * @param {Object} data.created_by
   * @param {Object} data.updated_by
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.status = data?.status
    if(data?.date) this.date = new Date(data?.date)
    this.number = data?.number
    this.currency = data?.currency
    this.shop = data?.shop
    this.vendor = Vendor.parse(data?.vendor)
    this.itemsCount = data?.items_count
    if (Array.isArray(data?.items)) this.items = data?.items?.map(PurchaseOrderItem.parse)

    if (data?.reviewed_at) this.reviewedAt = new Date(data?.reviewed_at)
    this.reviewedBy = User.parse(data?.reviewed_by)

    if (data?.created_at) this.createdAt = new Date(data.created_at)
    if (data?.updated_at) this.updatedAt = new Date(data.updated_at)
    this.createdBy = User.parse(data?.created_by)
    this.updatedBy = User.parse(data?.updated_by)
  }

  get formattedStatus() {
    return formatPurchaseOrderStatus(this.status)
  }

  get statusColor() {
    return parsePurchaseOrderStatusColor(this.status)
  }

  get calculatedSubtotal() {
    if (!Array.isArray(this.items)) return

    return this.items
      .map(item => item.costPrice * item.quantity) 
      .filter(itemSubtotal => !isNaN(itemSubtotal))
      .reduce((subtotal, itemSubtotal) => subtotal + itemSubtotal, 0)
  }

  async fetchItems() {
    if (!this.id) return Promise.reject()
    
    this.$state.loading = true
    return backend.get(`purchase-orders/${this.id}/items/`)
      .then(response => {
        if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
        this.items = response?.data?.results.map(PurchaseOrderItem.parse)
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }

  async refetch() {
    if (!this.id) return Promise.reject()

    this.$state.loading = true
    return backend.get(`purchase-orders/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }
  
  async markReviewed() {
    this.$state.loading = true
    return backend.post(`purchase-orders/${this.id}/mark_reviewed/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }

  async complete() {
    this.$state.loading = true
    return backend.post(`purchase-orders/${this.id}/complete/`)
      .then(response => {
        if(!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }
}

export class PurchaseOrderUpdates {
  UpdateTypes = Object.freeze({
    ITEM_ADD: 'item_add',
    ITEM_REMOVE: 'item_remove',
    ITEM_UPDATE: 'item_update',
    OTHER: 'other',
  })

  static parse(data) {
    return new PurchaseOrderUpdates(data)
  }

  constructor (data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {Number} data.purchase_order_id
   * @param {String} data.update_type
   * @param {Object} data.prev_value
   * @param {Object} data.new_value
   * @param {String} data.created_at
   * @param {Object} data.created_by
   */
  set raw(data) {
    this.id = data?.id
    this.purchaseOrderId = data?.purchase_order_id
    this.updateType = data?.update_type
    this.prevValue = data?.prev_value
    this.newValue = data?.new_value
    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt
    this.createdBy = User.parse(data?.created_by)
  }

  get updateTexts() {
    return getPurchaseOrderUpdatesTexts(this)
  }
}

export class StockRecount {
  static parse(data) {
    return new StockRecount(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      loading: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.remarks
   * @param {Object[]} data.items
   * @param {String} data.created_at
   * @param {Object} data.created_by
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.remarks = data?.remarks
    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    this.createdBy = User.parse(data?.created_by)
    this.items = data?.items?.map?.(StockRecountItem.parse)
  }

  async refetch() {
    this.$state.loading = true
    backend.get(`stock-recounts/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }
}

export class StockRecountItem {
  static parse(data) {
    return new StockRecountItem(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.stock_id
   * @param {Number} data.expected_quantity
   * @param {Number} data.actual_quantity
   * @param {String} data.remarks
   * @param {String} [data.stock_updated_at]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.stockId = data?.stock_id
    this.expectedQuantity = data?.expected_quantity
    this.actualQuantity = data?.actual_quantity
    this.remarks = data?.remarks
    if (data?.stock_updated_at) this.stockUpdatedAt = new Date(data?.stock_updated_at)
  }

  async fetchStock() {
    if (!this.stockId) return Promise.reject()
    return backend.get(`stocks/${this.stockId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.stock = Stock.parse(response?.data)
      })
  }
}

export class CollectionCondition {
  static fields = {
    price: 'variants__price',
    markupPrice: 'variants__markup_price',
    name: 'name',
    categories: 'categories__name',
    created: 'created_at',
  }

  static fieldOpts = [
    { label: 'Price', value: this.fields.price },
    { label: 'MarkupPrice', value: this.fields.markupPrice },
    { label: 'Name', value: this.fields.name, },
    { label: 'Categories', value: this.fields.categories, },
    { label: 'Created', value: this.fields.created, },
  ]

  static getFieldExpressions(fieldValue) {
    switch(fieldValue) {
      case this.fields.price:
      case this.fields.markupPrice:
        return [
          { label: $t('Equals'), value: '' },
          { label: $t('LessThan'), value: 'lt' },
          { label: $t('GreaterThan'), value: 'gt' },
        ]
      case this.fields.name:
        return [
          { label: $t('Equals'), value: '' },
          { label: $t('Contains'), value: 'contains' },
          { label: $t('StartsWith'), value: 'startswith' },
        ]
      case this.fields.categories:
        return [
          { label: $t('Contains'), value: 'in' },
        ]
      case this.fields.created:
        return [
          { label: $t('Before'), value: 'lt' },
          { label: $t('After'), value: 'gt'},
        ]
      default:
        return []
    }
  }

  static parse(data) {
    return new CollectionCondition(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {String} data.field
   * @param {String} data.expression
   * @param {{ value: any }} data.value
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data }) 

    this.field = data?.field
    this.expression = data?.expression
    this.value = data?.value?.value
  }

  get fieldLabel() {
    return CollectionCondition.fieldOpts.find(fieldOpt => fieldOpt.value == this.field)?.label
  }

  get expressionLabel() {
    return CollectionCondition.getFieldExpressions(this.field)?.find(expressionOpt => {
      return expressionOpt.value == this.expression
    })?.label
  }
}

export class Collection {
  static orderings = {
    price: 'variants__price',
    name: 'name',
    created: 'created_at',
  }

  static parse(data) {
    return new Collection(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.image_url
   * @param {Number} data.name
   * @param {Boolean} data.auto
   * @param {Object[]} data.conditions
   * @param {'all' | 'any'} data.conditions_operand
   * @param {Number} data.products_count
   * @param {String} [data.created_at]
   * @param {Object} [data.created_by]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data }) 
    this.id = data?.id
    this.imageUrl = data?.image_url
    this.name = data?.name
    this.auto = data?.auto
    if (Array.isArray(data?.conditions)) this.conditions = data?.conditions.map(CollectionCondition.parse)
    this.conditionsOperand = data?.conditions_operand
    this.productsCount = data?.products_count

    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) this.createdAt = undefined

    if (data?.created_by) this.createdBy = User.parse(data?.created_by)
  }

  updateData(data) {
    this.raw = data
  }

  async refetch() {
    if (!this.id) return
    this.$state.updating = true
    return backend.get(`products/${this.id}/`, { params })
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }
}


export class BchPrice {
  static parse(data) {
    return new BchPrice(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {{ code:String, symbol: String }} data.currency
   * @param {Number} data.price
   * @param {String | Number} data.timestamp
   * @param {Number} [data.decimals]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.currency = { code: data?.currency?.code, symbol: data?.currency?.symbol }
    this.price = data?.price
    if (data?.timestamp) this.timestamp = new Date(data?.timestamp)
    else if (this.timestamp) delete this.timestamp
  }
}


export class DeliveryAddress {
  static parse(data) {
    return new DeliveryAddress(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.first_name
   * @param {String} data.last_name
   * @param {String} data.phone_number
   * @param {Object} data.location
   * @param {Number} [data.distance]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.firstName = data?.first_name
    this.lastName = data?.last_name
    this.phoneNumber = data?.phone_number
    this.location = Location.parse(data?.location)
    this.distance = data?.distance
  }

  get fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }
}


export class Customer {
  static parse(data) {
    return new Customer(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  } 

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.ref
   * @param {String} data.first_name
   * @param {String} data.last_name
   * @param {String} data.phone_number
   * @param {Object} data.default_location
   * @param {{wallet_hash:String, verifying_pubkey:String, verifying_pubkey_index:Number}} data.paytaca_wallet
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.ref = data?.ref
    this.firstName = data?.first_name
    this.lastName = data?.last_name
    this.phoneNumber = data?.phone_number
    if (data?.default_location) this.defaultLocation = Location.parse(data?.default_location)
    if (data?.paytaca_wallet) this.paytacaWallet = {
      walletHash: data?.paytaca_wallet?.wallet_hash,
      verifyingPubkey: data?.paytaca_wallet?.verifying_pubkey,
      verifyingPubkeyIndex: data?.paytaca_wallet?.verifying_pubkey_index,
    }
  }

  get fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }
}


export class OrderCallSession {
  static parse(data) {
    return new OrderCallSession(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.order_id
   * @param {{ id:Number, type:String, first_name:String, last_name:String }} data.caller
   * @param {String} [data.ended_at]
   * @param {String} data.created_at
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.caller = {
      id: data?.caller?.id,
      type: data?.caller?.type,
      firstName: data?.caller?.first_name,
      lastName: data?.caller?.last_name,
    }
    if (data?.ended_at) this.endedAt = new Date(data?.ended_at)
    else if (this.endedAt) delete this.endedAt

    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt
  }

  get hasEnded() {
    return Boolean(!this.id || this.endedAt)
  }
}


export class OrderItem {
  static parse(data) {
    return new OrderItem(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Object} data.variant
   * @param {Number} data.item_name
   * @param {Number} data.quantity
   * @param {Number} data.price
   * @param {Number} data.markup_price
   * @param {Number} data.cutlery_cost
   * @param {{ schema:Array, data:Object }} [data.properties]
   * @param {Object[]} [data.addons]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.variant = Variant.parse(data?.variant)
    this.itemName = data?.item_name
    this.quantity = data?.quantity
    this.price = data?.price
    this.markupPrice = data?.markup_price
    this.cutleryCost = data?.cutlery_cost
    this.properties = data?.properties
    this.addons = (Array.isArray(data?.addons) ? data.addons: []).map(LineItemAddon.parse)
  }

  get propertiesText() {
    return lineItemPropertiesToText(this.properties?.data)
  }
}


export class Order {
  static DeliveryTypes = Object.freeze({
    LOCAL_DELIVERY: 'local_delivery',
    STORE_PICKUP: 'store_pickup',
    SHIPPING: 'shipping',
  })

  static parse(data) {
    return new Order(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.checkout_id
   * @param {Number} data.storefront_id
   * @param {String} data.status
   * @param {{ code:String, symbol:String }} data.currency
   * @param {Object} data.bch_price
   * @param {Object} [data.customer]
   * @param {'local_delivery' | 'store_pickup' | 'shipping'} data.delivery_type
   * @param {Object} data.delivery_address
   * @param {Object[]} data.items
   * @param {Boolean} data.require_cutlery
   * @param {Number} data.cutlery_subtotal
   * @param {Number} data.subtotal
   * @param {Number} data.markup_subtotal
   * @param {Number} data.total_paid
   * @param {Number} data.total_pending_payment
   * @param {Number} data.total_payments
   * @param {Number} data.total_refunded
   * @param {{ delivery_fee:Number }} data.payment
   * @param {String | Number} data.created_at
   * @param {String | Number} data.updated_at
   * @param {String | Number} [data.preparation_deadline]
   * @param {String | Number} [data.delivery_deadline]
   * @param {Boolean} data.has_ongoing_dispute
   * @param {Object} data.assigned_staff
   * @param {Object} [data.dispute]
  */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.checkoutId = data?.checkout_id
    this.storefrontId = data?.storefront_id
    this.status = data?.status
    this.currency = { code: data?.currency?.code, symbol: data?.currency?.symbol }
    this.bchPrice = BchPrice.parse(data?.bch_price)
    if (data?.customer) this.customer = Customer.parse(data?.customer)
    this.deliveryType = data?.delivery_type
    this.deliveryAddress = DeliveryAddress.parse(data?.delivery_address)
    this.items = data?.items?.map?.(OrderItem.parse)
    this.requireCutlery = data?.require_cutlery
    this.cutlerySubtotal = data?.cutlery_subtotal
    this.subtotal = data?.subtotal
    this.markupSubtotal = data?.markup_subtotal
    this.totalPaid = data?.total_paid
    this.totalPendingPayment = data?.total_pending_payment
    this.totalPayments = data?.total_payments
    this.totalRefunded = data?.total_refunded
    this.payment = {
      deliveryFee: data?.payment?.delivery_fee,
      escrowRefundAddress: data?.payment?.escrow_refund_address,
    }

    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt

    if (data?.updated_at) this.updatedAt = new Date(data?.updated_at)
    else if (this.updatedAt) delete this.updatedAt

    if (data?.preparation_deadline) this.preparationDeadline = new Date(data?.preparation_deadline)
    else if (this.preparationDeadline ) delete this.preparationDeadline

    if (data?.delivery_deadline) this.deliveryDeadline = new Date(data?.delivery_deadline)
    else if (this.deliveryDeadline) delete this.deliveryDeadline

    if (data?.assigned_staff) this.assignedStaff = User.parse(data?.assigned_staff)
    else if (this.assignedStaff) delete this.assignedStaff

    this.hasOngoingDispute = data?.has_ongoing_dispute
    if (data?.dispute) this.dispute = OrderDispute.parse(data?.dispute)
  }

  get isStorePickup() {
    return this.deliveryType === Order.DeliveryTypes.STORE_PICKUP
  }

  get isCancelled() {
    return this.status == 'cancelled'
  }

  get isReadyForPickup() {
    return this.status == 'ready_for_pickup'
  }

  get editable() {
    const nonEditableStatuses = ['on_delivery', 'delivered', 'completed', 'cancelled']
    if (this.isStorePickup) nonEditableStatuses.push('ready_for_pickup')
    return this.id && !nonEditableStatuses.includes(this.status) && !this.isCancelled
  }

  get formattedStatus() {
    return formatOrderStatus(this.status)
  }

  get statusColor() {
    return parseOrderStatusColor(this.status)
  }

  get formattedDeliveryType() {
    if (typeof this.deliveryType !== 'string') return this.deliveryType

    return formatStatusGeneric(this.deliveryType)
  }

  get markupAmount() {
    const markupAmount = parseFloat(this.markupSubtotal - this.subtotal)
    return Math.round(markupAmount * 10 ** 3) / 10 ** 3
  }

  get total() {
    const total = Number(this?.payment?.deliveryFee) + Number(this.markupSubtotal)
    return Math.round(total * 10 ** 3) / 10 ** 3
  }

  get totalUnpaid() {
    const totalPaid = parseFloat(this.totalPaid || 0)
    return Math.max(this.total - totalPaid, 0)
  }

  get totalPaymentsSent() {
    return (parseFloat(this.totalPaid) || 0) + (parseFloat(this.totalPendingPayment) || 0)
  }

  get netPaymentsSent() {
    const totalRefunded = parseFloat(this.totalRefunded) || 0
    return this.totalPaymentsSent - totalRefunded
  }

  get totalPayable() {
    return this.total - this.netPaymentsSent
  }

  get netPaid() {
    return this.totalPaymentsSent - this.totalRefunded
  }

  get paymentStatus() {
    if (this.totalPaid >= this.total) {
      if (this.netPaid <= 0) return 'refunded'
      if (this.netPaid < this.total) return 'partially_refunded'
      return 'paid'
    }
    if (this.totalPendingPayment >= this.totalUnpaid) return 'payment_in_escrow'
    if (this.totalPaid > 0) return 'partially_paid'
    if (this.totalPendingPayment > 0) return 'partial_payment_in_escrow'
    return 'payment_pending'
  }

  get formattedPaymentStatus() {
    switch(this.paymentStatus) {
      case 'partially_refunded':
        return $t('PartiallyRefunded', {}, formatOrderStatus(this.paymentStatus))
      case 'payment_in_escrow':
        return $t('PaymentInEscrow', {}, formatOrderStatus(this.paymentStatus))
      case 'partially_paid':
        return $t('PariallyPaid', {}, formatOrderStatus(this.paymentStatus))
      case 'partial_payment_in_escrow':
        return $t('PartialPaymentInEscrow', {}, formatOrderStatus(this.paymentStatus))
      case 'payment_pending':
        return $t('PaymentPending', {}, formatOrderStatus(this.paymentStatus))
    }
    return formatOrderStatus(this.paymentStatus)
  }

  async fetchDispute() {
    if (!this.id) return Promise.reject()
    return backend.get(`connecta/orders/${this.id}/dispute/`)
    .then(response => {
      if (!response?.data?.id) return Promise.reject({ response })
      this.dispute = OrderDispute.parse(response?.data)
      return response 
    })      
  }

  async fetchStorefront() {
    if (!this.storefrontId) return Promise.reject('No storefront id')

    return backend.get(`connecta/storefronts/${this.storefrontId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.storefront = Storefront.parse(response?.data)
        return response
      })
  }
}

export class OrderDispute {
  static parse(data) {
    return new OrderDispute(data) 
  }

  static get resolveActions() {
    return {
      doNothing: 'do_nothing',
      completeOrder: 'complete_order',
      cancelOrder: 'cancel_order',
    }
  }
  static get resolveActionsList() {
    return Object.getOwnPropertyNames(this.resolveActions).map(name => this.resolveActions[name])
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.order_id
   * @param {String[]} data.reasons
   * @param {String | null} data.resolve_action
   * @param {String | null} data.resolved_at
   * @param {Object} [data.resolved_by]
   * @param {String} data.created_at
   * @param {Object} data.created_by
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.orderId = data?.order_id
    this.reasons = Array.isArray(data?.reasons) ? data?.reasons : []
    this.resolveAction = data?.resolve_action
    if (data?.resolved_at) this.resolvedAt = new Date(data?.resolved_at)
    else if (this.resolvedAt) delete this.resolvedAt

    if (data?.resolved_by) this.resolvedBy = User.parse(data?.resolved_by)
    else if (this.resolvedBy) delete this.resolvedBy

    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt

    if (data?.created_by) this.createdBy = User.parse(data?.created_by)
    else if (this.createdBy) delete this.createdBy
  }
}

export class OrderUpdates {
  UpdateTypes = Object.freeze({
    ITEM_ADD: 'item_add',
    ITEM_REMOVE: 'item_remove',
    ITEM_UPDATE: 'item_update',
    DELIVERY_ADDRESS_UPDATE: 'delivery_address_update',
    STATUS_UPDATE: 'status_update',
  })

  static parse(data) {
    return new OrderUpdates(data)
  }

  constructor (data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {Number} data.order_id
   * @param {String} data.update_type
   * @param {Object} data.prev_value
   * @param {Object} data.new_value
   * @param {String} data.created_at
   * @param {Object} data.created_by
   */
  set raw(data) {
    this.id = data?.id
    this.orderId = data?.order_id
    this.updateType = data?.update_type
    this.prevValue = data?.prev_value
    this.newValue = data?.new_value
    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt
    this.createdBy = User.parse(data?.created_by)
  }

  get updateTexts() {
    return getOrderUpdatesTexts(this)
  }
}


export class Storefront {
  static parse(data) {
    return new Storefront(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {Number} data.shop_id
   * @param {String} data.name
   * @param {String} data.image_url
   * @param {String} [data.phone_number]
   * @param {{ code:String, symbol:String }} data.currency
   * @param {Object} data.location
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.shopId = data?.shop_id
    this.name = data?.name
    this.imageUrl = data?.image_url
    this.phoneNumber = data?.phone_number
    this.currency = {
      code: data?.currency?.code,
      symbol: data?.currency?.symbol,
    }
    if (data?.location) this.location = Location.parse(data?.location)
    else if (this.location) this.location = undefined
  }
}


export class Rider {
  static parse(data) {
    return new Rider(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} [data.profile_picture_url]
   * @param {String} data.first_name
   * @param {String} data.last_name
   * @param {String} data.phone_number
   * @param {String} data.receiving_address
   * @param {Object} data.location
   * @param {Number} data.user_id
   * @param {Number} [data.active_delivery_id]
   * @param {Number} [data.distance]
   * @param {[Number, Number]} [data.current_location]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.profilePictureUrl = data?.profile_picture_url
    this.firstName = data?.first_name
    this.lastName = data?.last_name
    this.phoneNumber = data?.phone_number
    this.receivingAddress = data?.receiving_address
    this.location = Location.parse(data?.location)
    this.userId = data?.user_id

    this.activeDeliveryId = data?.active_delivery_id
    this.distance = data?.distance
    this.currentLocation = data?.current_location
  }

  get fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }
}

export class StorefrontProduct {
  static parse(data) {
    return new StorefrontProduct(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.storefront_id
   * @param {Number} data.product_id
   * @param {Boolean} data.available
   * @param {Boolean} data.require_stocks
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.storefrontId = data?.storefront_id
    this.productId = data?.product_id
    this.available = data?.available
    this.requireStocks = data?.require_stocks
  }
}


export class Delivery {
  static parse(data) {
    return new Delivery(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.order_id
   * @param {{ id: Number, status: String }} data.order
   * @param {Object} data.rider
   * @param {Object} data.active_rider_id
   * @param {Object} data.pickup_location
   * @param {Object} data.delivery_location
   * @param {Number} data.distance
   * @param {String | Number} [data.accepted_at]
   * @param {String | Number} [data.picked_up_at]
   * @param {String | Number} [data.delivered_at]
   * @param {String | Number} [data.completed_at]
   * @param {{ code:String, symbol:String }} data.currency
   * @param {Number} data.subtotal
   * @param {Number} data.fee
   * @param {Boolean} data.is_public
   * @param {String | Number} data.created_at
   * @param {String | Number} data.updated_at
   * @param {Number} [data.pickup_distance]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.orderId = data?.order_id
    this.order = Order.parse(data?.order)
    this.rider = Rider.parse(data?.rider)
    this.activeRiderId = data?.active_rider_id
    this.pickupLocation = Location.parse(data?.pickup_location)
    this.deliveryLocation = Location.parse(data?.delivery_location)
    this.distance = data?.distance
    if (data?.accepted_at) this.acceptedAt = new Date(data?.accepted_at)
    else if (this.acceptedAt) delete this.acceptedAt
    if (data?.picked_up_at) this.pickedUpAt = new Date(data?.picked_up_at)
    else if (this.pickedUpAt) delete this.pickedUpAt
    if (data?.delivered_at) this.deliveredAt = new Date(data?.delivered_at)
    else if (this.deliveredAt) delete this.deliveredAt
    if (data?.completed_at) this.completedAt = new Date(data?.completed_at)
    else if (this.completedAt) delete this.completedAt
    this.currency = { code: data?.currency?.code, symbol: data?.currency?.symbol }
    this.subtotal = data?.subtotal
    this.fee = data?.fee
    this.isPublic = data?.is_public
    this.createdAt = new Date(data?.created_at)
    this.updatedAt = new Date(data?.updated_at)
    this.pickupDistance = data?.pickup_distance
  }
}

export class Payment {
  static parse(data) {
    return new Payment(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.order_id
   * @param {Number} data.checkout_id
   * @param {{ code:String, symbol:String }} data.currency
   * @param {String} data.status
   * @param {Object} data.bch_price
   * * @param {Object[]} data.token_prices
   * @param {Number} data.amount
   * @param {Number} data.delivery_fee
   * @param {Number} data.markup_amount
   * @param {Number} data.total_amount
   * @param {Number} data.total_refunded_amount
   * @param {Number} data.total_refunded_delivery_fee
   * @param {Number} data.total_refunded_markup_amount
   * @param {String} data.transaction_timestamp
   * @param {String} data.created_at
   * @param {String} data.escrow_contract_address
  */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.orderId = data?.order_id
    this.checkoutId = data?.checkout_id
    this.currency = { code: data?.currency?.code, symbol: data?.currency?.symbol }
    this.status = data?.status
    this.bchPrice = BchPrice.parse(data?.bch_price)
    if (Array.isArray(data?.token_prices)) this.tokenPrices = data?.token_prices.map(BchPrice.parse)
    this.amount = data?.amount
    this.deliveryFee = data?.delivery_fee
    this.markupAmount = data?.markup_amount
    this.totalAmount = data?.total_amount
    this.totalRefundedAmount = data?.total_refunded_amount
    this.totalRefundedDeliveryFee = data?.total_refunded_delivery_fee
    this.totalRefundedMarkupAmount = data?.total_refunded_markup_amount

    if (data?.transaction_timestamp) this.transactionTimestamp = new Date(data?.transaction_timestamp)
    else if (this.transactionTimestamp) delete this.transactionTimestamp
    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt
    this.escrowContractAddress = data?.escrow_contract_address
  }

  get bchTotalAmount() {
    const satsPerBch = 10 ** 8
    const bch = this.totalAmount / this.bchPrice.price
    return Math.round(bch * satsPerBch) / satsPerBch
  }

  get isEscrow() {
    return Boolean(this.escrowContractAddress)
  }

  get canRefund() {
    return ['sent', 'received'].indexOf(this?.status) >= 0
  }

  get canReceive() {
    return ['pending', 'sent'].indexOf(this?.status) >= 0
  }

  get refundableAmount() {
    return this.amount - (parseFloat(this.totalRefundedAmount) || 0)
  }

  get refundableDeliveryFee() {
    return this.deliveryFee - (parseFloat(this.totalRefundedDeliveryFee) || 0)
  }

  get refundableMarkupAmount() {
    return this.markupAmount - (parseFloat(this.totalRefundedMarkupAmount) || 0)
  }

  get totalRefunded() {
    return this.refundableAmount + this.refundableDeliveryFee + this.refundableMarkupAmount
  }

  get hasRefundableAmount() {
    return this.totalRefunded > 0
  }

  async fetchEscrowContract() {
    if (!this.escrowContractAddress) return Promise.reject()

    return backend.get(`connecta/escrow/${this.escrowContractAddress}/`)
      .then(response => {
        this.escrowContract = EscrowContract.parse(response?.data)
        return response
      })
  }

  async fetchOrder() {
    if (!this.orderId) return Promise.reject()

    return backend.get(`connecta/orders/${this.orderId}/`)
      .then(response => {
        this.order = Order.parse(response?.data)
        return response
      })
  }

  async fetchRefunds() {
    const params = { payment_id: this?.id || null }
    return backend.get(`connecta/refunds/`, { params })
      .then(response => {
        let results = response?.data?.results
        if (!Array.isArray(results)) results = []
        this.refunds = results.map(Refund.parse)
      })
  }

  async refetch() {
    if (!this.id) return Promise.resolve()

    return backend.get(`connecta/payments/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
  }
}

export class Refund {
  static parse(data) {
    return new Refund(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.payment_id
   * @param {Number} data.amount
   * @param {Number} data.delivery_fee
   * @param {Number} data.markup_amount
   * @param {String} [data.transaction_date]
   * @param {String} data.created_at
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.paymentId = data?.payment_id
    this.amount = data?.amount
    this.deliveryFee = data?.delivery_fee
    this.markupAmount = data?.markup_amount
    if (data?.transaction_date) this.transactionDate = new Date(data?.transaction_date)
    else delete this.transactionDate

    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else delete this.createdAt
  }

  get totalAmount() {
    const amount = parseFloat(this.amount) || 0
    const deliveryFee = parseFloat(this.deliveryFee) || 0
    const markupAmount = parseFloat(this.markupAmount) || 0
    const totalAmount = amount + deliveryFee + markupAmount
    return Math.round(totalAmount * 10 ** 3) / 10 ** 3
  }
}

export class EscrowContract {
  static parse(data) {
    return new EscrowContract(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {String} data.address
   * @param {String} data.buyer_address
   * @param {String} data.seller_address
   * @param {String} data.arbiter_address
   * @param {String} data.servicer_address
   * @param {String} data.delivery_service_address
   * @param {Number} data.amount_sats
   * @param {Number} data.service_fee_sats
   * @param {Number} data.arbitration_fee_sats
   * @param {String} [data.amount_category]
   * @param {String} [data.service_fee_category]
   * @param {String} [data.arbitration_fee_category]
   * @param {Object} [data.delivery_fee_key_nft]
   * @param {Number} data.delivery_fee_key_nft.amount
   * @param {Number} data.delivery_fee_key_nft.nft_id
   * @param {String} data.delivery_fee_key_nft.category
   * @param {String} data.delivery_fee_key_nft.current_address
   * @param {String} data.delivery_fee_key_nft.current_txid
   * @param {Number} data.delivery_fee_key_nft.current_index
   * @param {Object} data.delivery_fee_key_nft.fee_pool_contract
   * @param {String} data.delivery_fee_key_nft.fee_pool_contract.address
   * @param {String} data.delivery_fee_key_nft.fee_pool_contract.key_nft_category
   * @param {String} data.delivery_fee_key_nft.fee_pool_contract.owner_address
   * @param {String} data.timestamp
   * 
   * @param {String} [data.funding_txid]
   * @param {Number} [data.funding_vout]
   * @param {Number} [data.funding_sats]
   * 
   * @param {String} [data.settlement_txid]
   * @param {String} [data.settlement_type]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.address = data?.address
    this.buyerAddress = data?.buyer_address
    this.sellerAddress = data?.seller_address
    this.arbiterAddress = data?.arbiter_address
    this.servicerAddress = data?.servicer_address
    this.deliveryServiceAddress = data?.delivery_service_address

    this.amountSats = data?.amount_sats
    this.serviceFeeSats = data?.service_fee_sats
    this.arbitrationFeeSats = data?.arbitration_fee_sats

    this.amountCategory = data?.amount_category
    this.serviceFeeCategory = data?.service_fee_category
    this.arbitrationFeeCategory = data?.arbitration_fee_category
    this.deliveryFeeKeyNft = {
      amount: data?.delivery_fee_key_nft?.amount,
      nftId: data?.delivery_fee_key_nft?.nft_id,
      category: data?.delivery_fee_key_nft?.category,
      currentAddress: data?.delivery_fee_key_nft?.current_address,
      currentTxid: data?.delivery_fee_key_nft?.current_txid,
      currentIndex: data?.delivery_fee_key_nft?.current_index,
      feePoolContract: {
        address: data?.delivery_fee_key_nft?.fee_pool_contract?.address,
        keyNftCategory: data?.delivery_fee_key_nft?.fee_pool_contract?.key_nft_category,
        ownerAddress: data?.delivery_fee_key_nft?.fee_pool_contract?.owner_address,
      },
    }

    if (data?.timestamp) this.timestamp = new Date(data?.timestamp) * 1
    else if (this.timestamp) delete this.timestamp

    this.fundingTxid = data?.funding_txid
    this.fundingVout = data?.funding_vout
    this.fundingSats = data?.funding_sats
    this.settlementTxid = data?.settlement_txid
    this.settlementType = data?.settlement_type
  }

  get sats() {
    const CASHTOKEN_DUST_SATS = 1000;
    const deliveryFeeAmount = this.deliveryFeeKeyNft?.amount || 0;
    const deliveryFeeCategory = this.deliveryFeeKeyNft?.category;
    return {
      amount: this.amountCategory ? CASHTOKEN_DUST_SATS : this.amountSats,
      serviceFee: this.serviceFeeCategory ? CASHTOKEN_DUST_SATS : this.serviceFeeSats,
      arbitrationFee: this.arbitrationFeeCategory ? CASHTOKEN_DUST_SATS : this.arbitrationFeeSats,
      deliveryFee: (deliveryFeeAmount && deliveryFeeCategory)
        ? CASHTOKEN_DUST_SATS * 2
        : deliveryFeeAmount,
      networkFee: this.requiresTokens ? NaN : 1000,
    }
  }

  get bchAmounts() {
    const SATS_PER_BCH = 10 ** 8
    const toBch = val => Math.round(val) / SATS_PER_BCH
    const data = {
      amount: toBch(this.sats.amount),
      serviceFee: toBch(this.sats.serviceFee),
      arbitrationFee: toBch(this.sats.arbitrationFee),
      deliveryFee: toBch(this.sats.deliveryFee),
      networkFee: toBch(this.sats.networkFee),
      total: toBch(
        this.sats.amount +
        this.sats.serviceFee +
        this.sats.arbitrationFee +
        this.sats.deliveryFee +
        this.sats.networkFee,
      ),
    }

    return data
  }

  get isFunded() {
    return Boolean(this.fundingTxid && this.fundingVout >= 0)
  }
  
  get isSettled() {
    return Boolean(this.settlementTxid)
  }

  get requiresTokens() {
    return Boolean(this.amountCategory || this.serviceFeeCategory || this.arbitrationFeeCategory || this.deliveryFeeKeyNft?.category)
  }

  get fundingTxLink() {
    const txid = this?.fundingTxid
    const index = this?.fundingVout
    const isTestnet = this?.address?.startsWith?.('bchtest:')

    if (!txid) return ''
    if (isNaN(index) || index < 0) return ''

    if (isTestnet) return `https://chipnet.imaginary.cash/tx/${txid}#output-${index}`
    return `https://blockchair.com/bitcoin-cash/transaction/${txid}?o=${index}`
  }

  get settlementTxLink() {
    const txid = this?.settlementTxid
    const isTestnet = this?.address?.startsWith?.('bchtest:')

    if (!txid) return ''

    if (isTestnet) return `https://chipnet.imaginary.cash/tx/${txid}`
    return `https://blockchair.com/bitcoin-cash/transaction/${txid}`
  }
}


export class ChatSession {
  static parse(data) {
    return new ChatSession(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {String} data.ref
   * @param {String} data.title
   * @param {String} data.first_message_at
   * @param {String} data.last_message_at
   * @param {String} data.created_at
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.ref = data?.ref
    this.title = data?.title
    if (data?.first_message_at) this.firstMessageAt = new Date(data?.first_message_at)
    else if (this.firstMessageAt) delete this.firstMessageAt

    if (data?.last_message_at) this.lastMessageAt = new Date(data?.last_message_at)
    else if (this.lastMessageAt) delete this.lastMessageAt

    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt
  }
}


export class ChatMessage {
  static parse(data) {
    return new ChatMessage(data) 
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      fetchingAttachment: false,
      decryptingAttachment: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.chat_session_ref
   * @param {Boolean} data.encrypted
   * @param {String} data.message
   * @param {String} data.attachment_url
   * @param {String} data.encrypted_attachment_url
   * @param {String} data.created_at
   * @param {Object} [data.chat_identity]
   * @param {String} [data.member_nickname]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.chatSessionRef = data?.chat_session_ref
    this.encrypted = data?.encrypted
    this.message = data?.message
    this.attachmentUrl = data?.attachment_url
    this.encryptedAttachmentUrl = data?.encrypted_attachment_url
    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt
    this.chatIdentity = ChatIdentity.parse(data?.chat_identity)
    this.memberNickname = data?.member_nickname
  }

  get user() {
    return this.chatIdentity?.user
  }

  get customer() {
    return this.chatIdentity?.customer
  }

  get name() {
    if (this?.user?.id) {
      return [this.user.firstName, this.user.lastName].filter(Boolean).join(' ')
    }
    if (this?.customer?.fullName) return this?.customer?.fullName
    return this.chatIdentity?.name
  }

  get decryptedMessage() {
    if (!this.encrypted) return this.message
    return this._decryptedMessage
  }

  get hasAttachment() {
    return Boolean(this.attachmentUrl || this.encryptedAttachmentUrl)
  }

  get decryptedAttachmentFile() {
    return this._decryptedAttachmentFile
  }

  set decryptedAttachmentFile(value) {
    try { URL.revokeObjectURL(this._decryptedAttachmentFile) } catch {}
    this._decryptedAttachmentFile = value
    if (this._decryptedAttachmentFile) {
      this._decryptedAttachmentFile.url = URL.createObjectURL(this._decryptedAttachmentFile)
    }
  }
  /**
   * @param {String} value
   */
  set decryptedMessage(value) {
    this._decryptedMessage = value
  }

  async decryptMessage(privkey, tryAllKeys=false) {
    if (!this.encrypted) return
    const parsedEncryptedMessage = decompressEncryptedMessage(this.message)
    const opts = { privkey, tryAllKeys, ...parsedEncryptedMessage}
    this.decryptedMessage = decryptMessage(opts)
  }

  async fetchEncryptedAttachment() {
    if (this.fetchEncryptedAttachmentPromise) return this.fetchEncryptedAttachmentPromise
    this.fetchEncryptedAttachmentPromise = this._fetchEncryptedAttachment()
    return this.fetchEncryptedAttachmentPromise
      .finally(() => {
        delete this.fetchEncryptedAttachmentPromise
      })
  }

  async _fetchEncryptedAttachment() {
    this.$state.fetchingAttachment = true
    try {
      if (!this.encryptedAttachmentUrl) return
      if (this.encryptedAttachmentFile) return
      const response = await fetch(this.encryptedAttachmentUrl, { headers: { 'Accept': 'image/* application/*' } })
      const blob = await response.blob()
      this.encryptedAttachmentFile = new File([blob], this.encryptedAttachmentUrl)
      return this.encryptedAttachmentFile
    } finally {
      this.$state.fetchingAttachment = false
    }
  }

  async decryptAttachment(privkey, tryAllKeys=false) {
    if (this.decryptAttachmentPromise) return this.decryptAttachmentPromise
    this.decryptAttachmentPromise = this._decryptAttachment(privkey, tryAllKeys)
    return this.decryptAttachmentPromise
      .finally(() => {
        delete this.decryptAttachmentPromise
      })
  }

  async _decryptAttachment(privkey, tryAllKeys=false) {
    try {
      if (this?.decryptedAttachmentFile?.url) return this.decryptedAttachmentFile
      if (!this.encryptedAttachmentFile) await this.fetchEncryptedAttachment()
      this.$state.decryptingAttachment = true
      const decryptOpts = await decompressEncryptedImage(this.encryptedAttachmentFile)
      const opts = { privkey, tryAllKeys, ...decryptOpts }
      this.decryptedAttachmentFile = await decryptImage(opts)
      return this.decryptedAttachmentFile
    } finally {
      this.$state.decryptingAttachment = false
    }
  }
}


export class ChatMember {  
  static parse(data) {
    return new ChatMember(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {String} data.chat_session_ref
   * @param {Number} data.unread_count
   * @param {String} data.last_read_timestamp
   * @param {String} data.created_at
   * @param {Object} data.chat_identity
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.chatSessionRef = data?.chat_session_ref
    this.unreadCount = data?.unread_count
    if (data?.last_read_timestamp) this.lastReadTimestamp = new Date(data?.last_read_timestamp)
    else if (this.lastReadTimestamp) delete this.lastReadTimestamp

    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    else if (this.createdAt) delete this.createdAt

    this.chatIdentity = ChatIdentity.parse(data?.chat_identity)
  }

  get name() {
    if (this?.chatIdentity?.user?.id) {
      return [this.chatIdentity.user.firstName, this.chatIdentity.user.lastName].filter(Boolean).join(' ')
    }
    return this?.chatIdentity?.customer?.fullName
  }
}


export class ChatIdentity {
  static parse(data) {
    return new ChatIdentity(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.name
   * @param {String} data.ref
   * @param {{ pubkey:String, device_id:String }[]} data.pubkeys
   * @param {{ id:Number, first_name: String, last_name:String }} [data.user]
   * @param {{ id:Number, first_name: String, last_name:String }} [data.customer]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.name = data?.name
    this.ref = data?.ref
    this.pubkeys = (Array.isArray(data?.pubkeys) ? data?.pubkeys : [])
      .map(pubkeyData => {
        return { pubkey: pubkeyData?.pubkey, deviceId: pubkeyData?.device_id }
      })
 
    this.user = User.parse(data?.user)
    this.customer = Customer.parse(data?.customer)   
  }
}


export class Review {
  static parse(data) {
    return new Review(data) 
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.product_id
   * @param {Number} data.order_id
   * @param {Number | String} data.rating
   * @param {String} data.text
   * @param {String[]} data.images_urls
   * @param {String} data.created_at
   * @param {Object} [data.created_by_user]
   * @param {Object} [data.created_by_customer]
  */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.rating = parseFloat(data?.rating)
    this.text = data?.text
    this.imagesUrls = data?.images_urls
    this.createdAt = new Date(data?.created_at)

    if(data?.created_by_user) this.createdByUser = User.parse(data?.created_by_user)
    else if(this.createdByUser) delete this.createdByUser

    if (data?.created_by_customer) this.createdByCustomer = User.parse(data?.created_by_customer)
    else if(this.createdByCustomer) delete this.createdByCustomer
  }

  get authorName() {
    return this.createdByCustomer?.fullName || this.createdByUser?.fullName
  }
}
